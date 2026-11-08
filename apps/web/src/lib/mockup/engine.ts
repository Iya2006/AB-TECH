import { whenIdle } from '../idle'
import { drawPrint, type PrintImage } from '../print'

/**
 * Maquettes photo réalistes : une vraie photo (personne ou produit détouré), un masque du vêtement,
 * et une zone d'impression. On recolore le tissu en gardant ses plis et ses ombres, puis on
 * « imprime » le visuel du client : il suit les plis (léger déplacement) et prend l'ombrage du tissu.
 */

export interface PrintArea {
  /** Rectangle en coordonnées 0–1 de l'image. */
  x: number
  y: number
  w: number
  h: number
  /** Inclinaison en radians (casquette vue de trois quarts…). */
  rotate?: number
  /** 1 = surface cylindrique (mug, gourde) : le visuel s'enroule. */
  curve?: number
}

export interface MockupBase {
  src: string
  mask: string
  width: number
  height: number
  /** Luminance de référence du tissu (92e centile) : 1 = « blanc » du vêtement. */
  lref: number
  print: PrintArea
}

export interface PrintSpec {
  text: string
  ink: string
  logo?: PrintImage | null
  /** Deuxième ligne, plus petite (slogan, site web). */
  sub?: string
  /** Police du texte (famille CSS et graisse). */
  font?: { family: string; weight: number }
  /** Sans logo : la mire de la marque (par défaut) ou rien, le texte seul. */
  mark?: boolean
  /** Centre du visuel dans la zone (0–1) et taille (1 = toute la zone). */
  place?: { x: number; y: number; s: number }
  /** Broderie : fils en relief au lieu d'une encre à plat. */
  finish?: 'flat' | 'broderie'
}

interface Loaded {
  base: MockupBase
  rgba: Uint8ClampedArray
  mask: Uint8ClampedArray
  /** Luminance normalisée par lref (≈ 1 sur le tissu à plat). */
  shade: Float32Array
  box: { x0: number; y0: number; x1: number; y1: number }
}

const cache = new Map<string, Promise<Loaded>>()

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Image introuvable : ${url}`))
    img.src = url
  })
}

function pixels(img: HTMLImageElement, w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h).data
}

/** Charge (une seule fois) la photo et son masque ; l'analyse des pixels attend un moment de calme. */
export function loadBase(base: MockupBase): Promise<Loaded> {
  let p = cache.get(base.src)
  if (!p) {
    p = Promise.all([loadImage(base.src), loadImage(base.mask)]).then(([photo, maskImg]) => whenIdle(() => {
      const { width: w, height: h } = base
      const rgba = pixels(photo, w, h)
      const m4 = pixels(maskImg, w, h)
      const mask = new Uint8ClampedArray(w * h)
      const shade = new Float32Array(w * h)
      const box = { x0: w, y0: h, x1: 0, y1: 0 }
      for (let i = 0; i < w * h; i++) {
        mask[i] = m4[i * 4]!
        shade[i] = (0.2126 * rgba[i * 4]! + 0.7152 * rgba[i * 4 + 1]! + 0.0722 * rgba[i * 4 + 2]!) / 255 / base.lref
        if (mask[i]! > 8) {
          const x = i % w
          const y = (i - x) / w
          if (x < box.x0) box.x0 = x
          if (x > box.x1) box.x1 = x
          if (y < box.y0) box.y0 = y
          if (y > box.y1) box.y1 = y
        }
      }
      return { base, rgba, mask, shade, box }
    }))
    p.catch(() => cache.delete(base.src))
    cache.set(base.src, p)
  }
  return p
}

const hexRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]

/** Recolore le tissu : multiplication par l'ombrage + reflets ajoutés sur les teintes sombres. */
function recolor(L: Loaded, out: Uint8ClampedArray, color: string) {
  const [cr, cg, cb] = hexRgb(color)
  const dark = 1 - (0.2126 * cr + 0.7152 * cg + 0.0722 * cb)
  const { width: w } = L.base
  const { x0, y0, x1, y1 } = L.box
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x
      const m = L.mask[i]! / 255
      if (m <= 0) continue
      const s = L.shade[i]!
      const shade = Math.min(s, 1.08)
      const t = Math.min(1, Math.max(0, (s - 0.8) / 0.25))
      const hl = t * t * dark * 0.2
      const k = i * 4
      out[k] = out[k]! * (1 - m) + Math.min(1, cr * shade + hl) * 255 * m
      out[k + 1] = out[k + 1]! * (1 - m) + Math.min(1, cg * shade + hl) * 255 * m
      out[k + 2] = out[k + 2]! * (1 - m) + Math.min(1, cb * shade + hl) * 255 * m
    }
  }
}

/** Visuel du client dessiné à plat, à la taille de la zone d'impression. */
function printLayer(area: PrintArea, pw: number, ph: number, spec: PrintSpec) {
  const c = document.createElement('canvas')
  c.width = pw
  c.height = ph
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const place = spec.place ?? { x: 0.5, y: 0.5, s: 1 }
  ctx.save()
  ctx.translate(pw * place.x, ph * place.y)
  if (area.rotate) ctx.rotate(area.rotate)
  ctx.scale(place.s, place.s)
  // Sur un cylindre, la zone couvre toute la face visible : le visuel reste au centre, et il est
  // dessiné en « longueur d'arc » (×2/π) pour garder ses proportions une fois enroulé.
  const inset = area.curve ? 0.62 : 1
  if (area.curve) ctx.scale(2 / Math.PI, 1)
  const dw = (pw * inset) / (area.curve ? 2 / Math.PI : 1)
  drawPrint(ctx, -dw / 2, -ph / 2, dw, ph, spec)
  ctx.restore()
  const img = ctx.getImageData(0, 0, pw, ph)
  if (spec.finish === 'broderie') embroider(img.data, pw, ph)
  return img.data
}

/**
 * Broderie : fils obliques (le point plat) et léger relief sur les bords du motif.
 * Appliqué au calque à plat, avant qu'il ne suive les plis du tissu.
 */
function embroider(d: Uint8ClampedArray, w: number, h: number) {
  const alpha = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3]! / 255
  const period = Math.max(2.5, w / 110)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (alpha[i]! <= 0.02) continue
      // fils : ondulation lumineuse en diagonale ; relief : clair en haut à gauche, sombre en bas à droite
      const thread = 0.86 + 0.14 * Math.sin(((x + y * 0.6) / period) * Math.PI)
      const relief = (alpha[i - w - 1]! - alpha[i + w + 1]!) * -0.35
      const k = Math.max(0.55, Math.min(1.25, thread + relief))
      const o = i * 4
      d[o] = Math.min(255, d[o]! * k + (relief > 0 ? 40 * relief : 0))
      d[o + 1] = Math.min(255, d[o + 1]! * k + (relief > 0 ? 40 * relief : 0))
      d[o + 2] = Math.min(255, d[o + 2]! * k + (relief > 0 ? 40 * relief : 0))
    }
  }
}

/** Pose l'impression : déplacement selon les plis, ombrage du tissu, découpe par le masque. */
function applyPrint(L: Loaded, out: Uint8ClampedArray, spec: PrintSpec) {
  const { width: w, height: h, print: area } = L.base
  const px = Math.round(area.x * w)
  const py = Math.round(area.y * h)
  const pw = Math.max(8, Math.round(area.w * w))
  const ph = Math.max(8, Math.round(area.h * h))
  const layer = printLayer(area, pw, ph, spec)
  const k = w * 0.006 // amplitude du déplacement dans les plis
  for (let y = 0; y < ph; y++) {
    const oy = py + y
    if (oy < 2 || oy >= h - 2) continue
    for (let x = 0; x < pw; x++) {
      const ox = px + x
      if (ox < 2 || ox >= w - 2) continue
      const i = oy * w + ox
      const m = L.mask[i]! / 255
      if (m <= 0) continue
      const gx = L.shade[i + 2]! - L.shade[i - 2]!
      const gy = L.shade[i + 2 * w]! - L.shade[i - 2 * w]!
      let sx = x - gx * k
      const sy = Math.round(y - gy * k)
      let fade = 1
      if (area.curve) {
        // surface cylindrique : le visuel s'enroule et s'estompe sur les bords
        const u = (x / pw) * 2 - 1
        sx = ((Math.asin(Math.max(-1, Math.min(1, u))) / (Math.PI / 2) + 1) / 2) * pw
        fade = Math.min(1, (1 - Math.abs(u)) * 6)
      }
      const ix = Math.round(sx)
      if (ix < 0 || ix >= pw || sy < 0 || sy >= ph) continue
      const j = (sy * pw + ix) * 4
      const a = (layer[j + 3]! / 255) * m * 0.97 * fade
      if (a <= 0) continue
      const shade = Math.min(1.06, Math.max(0.5, L.shade[i]!))
      const o = i * 4
      out[o] = out[o]! * (1 - a) + layer[j]! * shade * a
      out[o + 1] = out[o + 1]! * (1 - a) + layer[j + 1]! * shade * a
      out[o + 2] = out[o + 2]! * (1 - a) + layer[j + 2]! * shade * a
    }
  }
}

export interface RenderOptions {
  /** Couleur du tissu ; null = couleur d'origine de la photo. */
  color: string | null
  print: PrintSpec | null
  /** Fond peint derrière une photo détourée. */
  background?: string
}

/** Dernière teinte calculée par photo : déplacer ou agrandir le visuel ne recolore pas tout le tissu. */
const tinted = new WeakMap<Loaded, { color: string; data: Uint8ClampedArray }>()

function tintedPixels(L: Loaded, color: string | null) {
  if (!color) return new Uint8ClampedArray(L.rgba)
  let t = tinted.get(L)
  if (!t || t.color !== color) {
    const data = new Uint8ClampedArray(L.rgba)
    recolor(L, data, color)
    t = { color, data }
    tinted.set(L, t)
  }
  return new Uint8ClampedArray(t.data)
}

/** Calcule la maquette dans `target` (même résolution que la photo). */
export function renderMockup(target: HTMLCanvasElement, L: Loaded, opts: RenderOptions) {
  const { width: w, height: h } = L.base
  const out = tintedPixels(L, opts.color)
  if (opts.print) applyPrint(L, out, opts.print)
  if (target.width !== w) target.width = w
  if (target.height !== h) target.height = h
  const ctx = target.getContext('2d')!
  const img = new ImageData(out, w, h)
  if (opts.background) {
    const layer = document.createElement('canvas')
    layer.width = w
    layer.height = h
    layer.getContext('2d')!.putImageData(img, 0, 0)
    ctx.fillStyle = opts.background
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(layer, 0, 0)
  } else {
    ctx.putImageData(img, 0, 0)
  }
}

/** Version « hors écran » : un canvas prêt à servir de texture 3D ou d'image. */
export async function mockupCanvas(base: MockupBase, opts: RenderOptions) {
  const L = await loadBase(base)
  const c = document.createElement('canvas')
  renderMockup(c, L, opts)
  return c
}
