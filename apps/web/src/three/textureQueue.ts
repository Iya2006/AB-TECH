import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useApp } from '../lib/store'

/**
 * Chargement économe des photos de l'atelier :
 * - décodage asynchrone et réduction à la taille utile (une photo produit fait ~200 px à l'écran) ;
 * - au plus 6 téléchargements à la fois ;
 * - envoi à la carte graphique une texture par image, en tâche de fond : pas d'à-coup quand on arrive
 *   devant un poste, et pas de pic de mémoire qui ferait « décrocher » la carte graphique.
 */

const MAX_PARALLEL = 6
let running = 0
const waiting: Array<() => void> = []

async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await job()
  } finally {
    running--
    waiting.shift()?.()
  }
}

export function loadImage(url: string) {
  return slot(
    () =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        // (img.decode() peut ne jamais aboutir pour une image hors de la page : on s'en tient à onload,
        // avec un délai de garde pour que la file ne reste jamais bloquée)
        const img = new Image()
        const timer = setTimeout(() => reject(new Error(`Délai dépassé : ${url}`)), 15000)
        img.crossOrigin = 'anonymous'
        img.decoding = 'async'
        img.onload = () => (clearTimeout(timer), resolve(img))
        img.onerror = () => (clearTimeout(timer), reject(new Error(`Image introuvable : ${url}`)))
        img.src = url
      }),
  )
}

/** Copie réduite (côté le plus long ≤ max) : c'est elle qui part sur la carte graphique. */
export function downscale(source: HTMLImageElement | HTMLCanvasElement, max: number) {
  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height
  const s = Math.min(1, max / Math.max(w, h))
  if (s === 1 && source instanceof HTMLCanvasElement) return source
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * s))
  c.height = Math.max(1, Math.round(h * s))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, c.width, c.height)
  return c
}

/**
 * Safari ignore longtemps les options de createImageBitmap (image à l'envers) : on y garde le canvas,
 * comme le fait Three.js pour les modèles 3D.
 */
const OFF_THREAD = typeof createImageBitmap === 'function' && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent)

async function viaCanvas(url: string, max: number, flip: boolean) {
  const img = await loadImage(url)
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * s))
  c.height = Math.max(1, Math.round(img.naturalHeight * s))
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  if (flip) {
    ctx.translate(0, c.height)
    ctx.scale(1, -1)
  }
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return createImageBitmap(c)
}

/**
 * Image décodée hors du fil principal (fichier → createImageBitmap), réduite à `max` px de côté au plus.
 * Une balise <img> dessinée dans un canvas se décode, elle, sur le fil principal, au moment du dessin :
 * c'était un à-coup par photo, pendant le défilement. `flip` : retournée pour servir telle quelle de texture
 * (sinon, à l'endroit pour être dessinée dans un canvas).
 */
export function loadBitmap(url: string, max: number, flip = true): Promise<ImageBitmap> {
  if (!OFF_THREAD) return viaCanvas(url, max, flip)
  return slot(async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    try {
      const res = await fetch(url, { signal: ctrl.signal, mode: 'cors', credentials: 'omit' })
      if (!res.ok) throw new Error(`Image introuvable : ${url}`)
      const blob = await res.blob()
      // pour une texture : couleurs non prémultipliées (bords nets des photos détourées), comme les modèles 3D
      const options: ImageBitmapOptions = flip ? { imageOrientation: 'flipY', premultiplyAlpha: 'none' } : {}
      const full = await createImageBitmap(blob, options)
      const s = Math.min(1, max / Math.max(full.width, full.height))
      if (s === 1) return full
      // trop grande (adresse sans redimensionnement à la volée) : réduite, toujours hors du fil principal
      const small = await createImageBitmap(full, {
        resizeWidth: Math.max(1, Math.round(full.width * s)),
        resizeHeight: Math.max(1, Math.round(full.height * s)),
        resizeQuality: 'high',
        ...(flip ? { premultiplyAlpha: 'none' as const } : {}),
      })
      full.close()
      return small
    } finally {
      clearTimeout(timer)
    }
  })
}

const uploads: THREE.Texture[] = []

function queue(tex: THREE.Texture) {
  uploads.push(tex)
  // texture libérée avant son tour : on la retire de la file
  tex.addEventListener('dispose', () => {
    const i = uploads.indexOf(tex)
    if (i >= 0) uploads.splice(i, 1)
  })
  return tex
}

export function makeTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return queue(tex)
}

/** Texture d'une image de loadBitmap (déjà retournée) ; l'image est libérée avec la texture. */
export function makeBitmapTexture(bitmap: ImageBitmap) {
  const tex = new THREE.Texture(bitmap)
  tex.flipY = false
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  tex.addEventListener('dispose', () => bitmap.close())
  return queue(tex)
}

/** Textures d'un groupe en préparation (voir Warm) : envoyées dans l'ordre, puis `done`. */
const batches: Array<{ list: THREE.Texture[]; done: () => void }> = []

/** Envoie ces textures à la carte graphique au rythme de TextureWarmup ; résolu quand tout est envoyé. */
export function uploadSoon(list: THREE.Texture[]) {
  return new Promise<void>((done) => batches.push({ list: [...list], done }))
}

/** Pas encore sur la carte graphique (une texture déjà envoyée ne coûte rien). */
const pending = (gl: THREE.WebGLRenderer, tex: THREE.Texture) =>
  !!tex.image && tex.version > 0 && (gl.properties.get(tex) as { __version?: number }).__version !== tex.version

/**
 * À placer une fois dans la scène : envoie les textures en attente, une seule nouvelle par image
 * (une photo de 2 000 px bloque l'image plusieurs millisecondes : jamais deux d'un coup).
 * Tant que l'écran de chargement couvre la scène, rien de ce qu'elle dessine n'est visible (et le verre tourne
 * à part, dans un worker) : trois par image, la façade est prête plus tôt.
 */
export function TextureWarmup() {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    let budget = useApp.getState().ready ? 1 : 3
    for (;;) {
      const batch = batches[0]
      const tex = batch ? batch.list.shift() : uploads.shift()
      if (batch && !tex) {
        batches.shift()
        batch.done()
        continue
      }
      if (!tex) return
      if (pending(gl, tex)) {
        gl.initTexture(tex)
        if (--budget <= 0) return
      }
    }
  })
  return null
}
