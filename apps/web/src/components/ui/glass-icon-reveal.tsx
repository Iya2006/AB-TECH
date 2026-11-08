import * as React from 'react'

import { cn } from '@/lib/utils'

/*
 * Glass Reveal (21st.dev) : le logo s'attarde en grand contre le bord d'une plaque de verre clair,
 * le verre le plie en couleurs dans les angles, puis le relâche et laisse le logo seul.
 * Autonome : une seule passe WebGL2, aucune dépendance.
 * Shader et ressorts portés de zanwei/glass-icon-reveal (licence MIT) :
 * https://github.com/zanwei/glass-icon-reveal
 *
 * Adaptations AB-TECH : TypeScript strict (accès indexés vérifiés), composant exporté,
 * `onEnd` appelé quand la révélation est terminée (aussi en mouvement réduit et sans WebGL2).
 */

import { BOX, LOOKS, runEngine, TEX, type EngineHost, type EngineLive, type GlassTuning, type Look, type Settings } from './glass-engine'
import type { FromWorker, ToWorker } from './glass-worker'

export { revealDuration } from './glass-engine'

/* ------------------------------------------------------------------ *
 * Logo → texture + signed distance field
 * ------------------------------------------------------------------ */

interface LogoData {
  canvas: HTMLCanvasElement
  sdf: Float32Array
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('GlassIconReveal: the logo could not be loaded'))
    img.src = src
  })
}

function isMarkup(logo: string) {
  return logo.trimStart().startsWith('<')
}

// SVG markup → data URL rendered at texture size; currentColor turns white (only the shape matters).
function svgToUrl(text: string) {
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('GlassIconReveal: the SVG could not be read')
  let w = parseFloat(svg.getAttribute('width') || '')
  let h = parseFloat(svg.getAttribute('height') || '')
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  if (vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) [w, h] = [vb[2]!, vb[3]!]
  if (!(w > 0 && h > 0)) w = h = 100
  const s = TEX / Math.max(w, h)
  svg.setAttribute('width', String(Math.round(w * s)))
  svg.setAttribute('height', String(Math.round(h * s)))
  const out = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, '#ffffff')
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out)
}

const logoUrl = (logo: string) => (isMarkup(logo) ? svgToUrl(logo) : logo)

// Draws the source into a TEX×TEX canvas, cropped to its visible pixels and fitted into the logo box.
// Opaque images (JPG, flat PNG) get their corner colour keyed out so the mark becomes the shape.
function fitToTexture(source: CanvasImageSource, sw: number, sh: number) {
  const tmp = document.createElement('canvas')
  tmp.width = tmp.height = TEX
  const tc = tmp.getContext('2d', { willReadFrequently: true })!
  const s0 = Math.min(TEX / sw, TEX / sh)
  const dx0 = (TEX - sw * s0) / 2
  const dy0 = (TEX - sh * s0) / 2
  tc.drawImage(source, dx0, dy0, sw * s0, sh * s0)
  const d = tc.getImageData(0, 0, TEX, TEX).data

  let opaque = true
  for (let i = 3; i < d.length; i += 4 * 97) if (d[i]! < 250) { opaque = false; break }
  const key = [d[0]!, d[1]!, d[2]!] as const
  const keyAlpha = (r: number, g: number, b: number) =>
    Math.min(1, Math.max(0, (Math.hypot(r - key[0], g - key[1], b - key[2]) / 441 - 0.08) / 0.2))

  let x0 = TEX, y0 = TEX, x1 = -1, y1 = -1
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const i = (y * TEX + x) * 4
      const a = opaque ? keyAlpha(d[i]!, d[i + 1]!, d[i + 2]!) * 255 : d[i + 3]!
      if (a > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) throw new Error('GlassIconReveal: the logo is empty')
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const s = (TEX * BOX) / Math.max(bw, bh)

  const out = document.createElement('canvas')
  out.width = out.height = TEX
  const oc = out.getContext('2d', { willReadFrequently: true })!
  oc.imageSmoothingQuality = 'high'
  oc.drawImage(source, TEX / 2 - (x0 + bw / 2 - dx0) * s, TEX / 2 - (y0 + bh / 2 - dy0) * s, sw * s0 * s, sh * s0 * s)
  if (opaque) {
    const im = oc.getImageData(0, 0, TEX, TEX)
    const e = im.data
    for (let i = 0; i < e.length; i += 4) e[i + 3] = Math.round(e[i + 3]! * keyAlpha(e[i]!, e[i + 1]!, e[i + 2]!))
    oc.putImageData(im, 0, 0)
  }
  return out
}

// Signed distance field from alpha (TinySDF method): + outside, − inside, in texture units.
function buildSdf(canvas: HTMLCanvasElement) {
  const n = TEX * TEX
  const alpha = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, TEX, TEX).data
  const INF = 1e20
  const outer = new Float64Array(n)
  const inner = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = alpha[i * 4 + 3]! / 255
    if (a >= 1) { outer[i] = 0; inner[i] = INF }
    else if (a <= 0) { outer[i] = INF; inner[i] = 0 }
    else {
      const dd = 0.5 - a
      outer[i] = dd > 0 ? dd * dd : 0
      inner[i] = dd < 0 ? dd * dd : 0
    }
  }
  const f = new Float64Array(TEX)
  const z = new Float64Array(TEX + 1)
  const v = new Uint16Array(TEX)
  edt(outer, f, v, z, INF)
  edt(inner, f, v, z, INF)
  const sdf = new Float32Array(n)
  for (let i = 0; i < n; i++) sdf[i] = (Math.sqrt(outer[i]!) - Math.sqrt(inner[i]!)) / TEX
  return sdf
}

function edt(grid: Float64Array, f: Float64Array, v: Uint16Array, z: Float64Array, INF: number) {
  for (let x = 0; x < TEX; x++) edt1d(grid, x, TEX, f, v, z, INF)
  for (let y = 0; y < TEX; y++) edt1d(grid, y * TEX, 1, f, v, z, INF)
}

function edt1d(grid: Float64Array, offset: number, stride: number, f: Float64Array, v: Uint16Array, z: Float64Array, INF: number) {
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  f[0] = grid[offset]!
  for (let q = 1, k = 0, s = 0; q < TEX; q++) {
    f[q] = grid[offset + q * stride]!
    const q2 = q * q
    do {
      const r = v[k]!
      s = (f[q]! - f[r]! + q2 - r * r) / (q - r) / 2
    } while (s <= z[k]! && --k > -1)
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  for (let q = 0, k = 0; q < TEX; q++) {
    while (z[k + 1]! < q) k++
    const r = v[k]!
    const qr = q - r
    grid[offset + q * stride] = f[r]! + qr * qr
  }
}

// One SDF per logo for the whole page: building it takes ~100 ms, remounts and twins reuse it.
const logoCache = new Map<string, Promise<LogoData>>()

function loadLogo(logo: string) {
  let job = logoCache.get(logo)
  if (!job) {
    job = loadImage(logoUrl(logo)).then((img) => {
      const canvas = fitToTexture(img, img.naturalWidth || TEX, img.naturalHeight || TEX)
      return { canvas, sdf: buildSdf(canvas) }
    })
    logoCache.set(logo, job)
    job.catch(() => logoCache.delete(logo))
  }
  return job
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */
export interface GlassIconRevealProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** SVG markup (`<svg …>…</svg>`) or an image URL. Only the shape is used unless `originalColors` is on */
  logo: string
  /** Starting preset: light glass over a pale backdrop, or dark glass with an icon plate */
  look?: Look
  /** Backdrop colour (hex). Match it to the page: the canvas paints it */
  background?: string
  logoColor?: string
  /** Colour of the tile behind the logo while `iconPlate` is on */
  plateColor?: string
  iconPlate?: boolean
  /** End on the flat icon plate (an app icon, a badge) instead of the bare logo */
  keepPlate?: boolean
  /** Keep the logo's own colours instead of `logoColor` */
  originalColors?: boolean
  /** Largest tile size in px; it shrinks to fit the container */
  tileSize?: number
  /** Logo half size relative to the tile's half size */
  logoScale?: number
  /** Logo size once the glass is gone, relative to `logoScale` */
  finalScale?: number
  /** Shift of the logo's centre, in tile half sizes (y up) */
  logoOffset?: [number, number]
  loop?: boolean
  /** Seconds the finished logo stays before the next loop */
  hold?: number
  speed?: number
  /** Freeze the reveal at this many seconds instead of playing it (scroll-driven or static use) */
  time?: number
  /** Ready but held at its first frame until false (e.g. while the rest of the page does heavy work) */
  paused?: boolean
  /** Fine-tune the glass and the motion */
  tuning?: Partial<GlassTuning>
  /** Accessible name of the logo */
  label?: string
  /** Appelé quand la révélation commence (logo prêt) */
  onStart?: () => void
  /** Instant de la révélation (secondes, temps de l'animation) où appeler `onCue` — suit l'animation même si elle prend du retard */
  cueAt?: number
  onCue?: () => void
  /** Appelé une fois la révélation terminée (sans boucle), aussi en mouvement réduit et sans WebGL2 */
  onEnd?: () => void
}

export function GlassIconReveal({
  logo,
  look = 'light',
  background,
  logoColor,
  plateColor,
  iconPlate,
  keepPlate,
  originalColors,
  tileSize,
  logoScale,
  finalScale,
  logoOffset,
  loop = true,
  hold,
  speed = 1,
  time,
  paused = false,
  tuning,
  label = 'Logo',
  onStart,
  cueAt,
  onCue,
  onEnd,
  className,
  style,
  onClick,
  ...props
}: GlassIconRevealProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const engineRef = React.useRef<ReturnType<typeof startEngine> | null>(null)
  const [fallback, setFallback] = React.useState(false)

  // Objects and arrays go through JSON so inline literals don't restart the memo every render.
  const tuningKey = JSON.stringify(tuning ?? {})
  const offsetKey = logoOffset ? logoOffset.join(',') : ''
  const settings = React.useMemo<Settings>(() => {
    const own = { background, logoColor, plateColor, iconPlate, keepPlate, originalColors, tileSize, logoScale, finalScale, hold }
    const set: Partial<Settings> = Object.fromEntries(Object.entries(own).filter(([, v]) => v !== undefined))
    if (offsetKey) set.logoOffset = offsetKey.split(',').map(Number) as [number, number]
    return { ...LOOKS[look], ...set, ...(JSON.parse(tuningKey) as Partial<GlassTuning>) }
  }, [look, background, logoColor, plateColor, iconPlate, keepPlate, originalColors, tileSize, logoScale, finalScale, hold, offsetKey, tuningKey])

  const live = React.useRef<Live>({ settings, loop, speed, time, paused, onStart, cueAt, onCue, onEnd })
  live.current = { settings, loop, speed, time, paused, onStart, cueAt, onCue, onEnd }

  React.useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    // shader refused by the graphics card (seen only once compiled): fixed logo, like without WebGL2
    const engine = startEngine(wrap, live, () => setFallback(true))
    if (!engine) {
      setFallback(true)
      return
    }
    engineRef.current = engine
    return () => {
      engineRef.current = null
      engine.dispose()
    }
  }, [])

  React.useEffect(() => {
    engineRef.current?.invalidate()
  }, [settings, loop, speed, time, paused])

  React.useEffect(() => {
    let cancelled = false
    loadLogo(logo).then(
      (data) => {
        if (cancelled) return
        engineRef.current?.setLogo(data)
      },
      (err) => {
        console.error(err)
        // logo illisible : on ne bloque pas la suite
        if (!cancelled) live.current.onEnd?.()
      },
    )
    return () => {
      cancelled = true
    }
  }, [logo])

  // sans WebGL2 : logo fixe, la suite peut venir tout de suite
  React.useEffect(() => {
    if (!fallback) return
    live.current.onStart?.()
    live.current.onCue?.()
    live.current.onEnd?.()
  }, [fallback])

  const fallbackUrl = React.useMemo(() => (fallback ? logoUrl(logo) : ''), [fallback, logo])
  // logo fixe à la taille qu'il a en fin de révélation : tuile = min(tileSize, côté / 1.75), logo = tuile × logoScale × finalScale
  const fallbackSize = `calc(min(${settings.tileSize}px, 100cqmin / 1.75) * ${settings.logoScale * settings.finalScale})`

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={label}
      className={cn('relative isolate cursor-pointer overflow-hidden select-none', className)}
      style={{ backgroundColor: settings.background, ...(fallback ? { containerType: 'size' } : null), ...style }}
      onClick={(e) => {
        engineRef.current?.replay()
        onClick?.(e)
      }}
      {...props}
    >
      {fallback &&
        (settings.originalColors ? (
          <img src={fallbackUrl} alt="" aria-hidden className="absolute inset-0 m-auto block max-h-[40%] max-w-[40%] object-contain" style={{ width: fallbackSize, height: fallbackSize }} />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 m-auto block"
            style={{
              width: fallbackSize,
              height: fallbackSize,
              maxWidth: '40%',
              maxHeight: '40%',
              backgroundColor: settings.logoColor,
              maskImage: `url("${fallbackUrl}")`,
              WebkitMaskImage: `url("${fallbackUrl}")`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          />
        ))}
    </div>
  )
}

interface Live extends EngineLive {
  onStart?: () => void
  onCue?: () => void
  onEnd?: () => void
}

interface EngineApi {
  setLogo(data: LogoData): void
  replay(): void
  invalidate(): void
  setVisible(on: boolean): void
  resize(): void
  dispose(): void
}

/**
 * Dessin dans un worker (OffscreenCanvas) : l'animation ne dépend plus du fil principal, qui prépare la visite 3D
 * pendant l'écran de chargement. Safari reste sur la page (WebGL dans un worker trop récent chez lui).
 */
const OFF_THREAD =
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  'transferControlToOffscreen' in HTMLCanvasElement.prototype &&
  !/^((?!chrome|android).)*safari/i.test(navigator.userAgent)

const snapshot = (live: Live): EngineLive => ({
  settings: live.settings,
  loop: live.loop,
  speed: live.speed,
  time: live.time,
  paused: live.paused,
  cueAt: live.cueAt,
})

function inWorker(canvas: HTMLCanvasElement, host: EngineHost): EngineApi | null {
  let worker: Worker
  try {
    worker = new Worker(new URL('./glass-worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return null
  }
  let offscreen: OffscreenCanvas
  try {
    offscreen = canvas.transferControlToOffscreen()
  } catch {
    worker.terminate()
    return null
  }
  const post = (message: ToWorker, transfer: Transferable[] = []) => worker.postMessage(message, transfer)
  const calls: Record<FromWorker, () => void> = { start: host.onStart, cue: host.onCue, end: host.onEnd, fail: host.onFail }
  worker.onmessage = (e: MessageEvent<FromWorker>) => calls[e.data]?.()
  // worker introuvable ou en panne : logo fixe, la page continue
  worker.onerror = () => host.onFail()
  post({ type: 'init', canvas: offscreen, live: host.live(), size: host.size(), reduceMotion: host.reduceMotion }, [offscreen])
  return {
    setLogo(data) {
      // copies (le logo et son champ de distance restent en cache pour les autres montages)
      const sdf = data.sdf.slice()
      createImageBitmap(data.canvas, { premultiplyAlpha: 'premultiply' }).then(
        (image) => post({ type: 'logo', image, sdf }, [image, sdf.buffer]),
        () => host.onFail(),
      )
    },
    replay: () => post({ type: 'replay' }),
    invalidate: () => post({ type: 'live', live: host.live() }),
    setVisible: (on) => post({ type: 'visible', visible: on }),
    resize: () => post({ type: 'size', size: host.size() }),
    dispose() {
      post({ type: 'dispose' })
      setTimeout(() => worker.terminate(), 1000)
    },
  }
}

function onPage(canvas: HTMLCanvasElement, host: EngineHost): EngineApi | null {
  const engine = runEngine(canvas, host)
  if (!engine) return null
  const onLost = (e: Event) => {
    e.preventDefault()
    engine.contextLost()
  }
  const onRestored = () => engine.contextRestored()
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  return {
    setLogo: (data) => engine.setLogo({ image: data.canvas, sdf: data.sdf }),
    replay: engine.replay,
    invalidate: engine.invalidate,
    setVisible: engine.setVisible,
    resize: engine.invalidate,
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      engine.dispose()
    },
  }
}

// Owns the canvas: a fresh one per mount (a lost context can never be revived on the same element).
function startEngine(wrap: HTMLDivElement, live: React.RefObject<Live>, onFail: () => void) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  wrap.appendChild(canvas)

  const host: EngineHost = {
    live: () => snapshot(live.current),
    size: () => ({ cw: canvas.clientWidth, ch: canvas.clientHeight, dpr: window.devicePixelRatio || 1 }),
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onStart: () => live.current.onStart?.(),
    onCue: () => live.current.onCue?.(),
    onEnd: () => live.current.onEnd?.(),
    onFail,
  }
  const api = (OFF_THREAD && inWorker(canvas, host)) || onPage(canvas, host)
  if (!api) {
    canvas.remove()
    return null
  }

  const io = new IntersectionObserver(([entry]) => api.setVisible(!!entry?.isIntersecting))
  io.observe(wrap)
  const ro = new ResizeObserver(() => api.resize())
  ro.observe(wrap)

  return {
    setLogo: api.setLogo,
    replay: api.replay,
    invalidate: api.invalidate,
    dispose() {
      io.disconnect()
      ro.disconnect()
      api.dispose()
      canvas.remove()
    },
  }
}

export default GlassIconReveal
