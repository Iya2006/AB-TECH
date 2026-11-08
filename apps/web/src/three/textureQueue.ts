import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

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

const uploads: THREE.Texture[] = []

export function makeTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  uploads.push(tex)
  // texture libérée avant son tour : on la retire de la file
  tex.addEventListener('dispose', () => {
    const i = uploads.indexOf(tex)
    if (i >= 0) uploads.splice(i, 1)
  })
  return tex
}

/** À placer une fois dans la scène : envoie les textures en attente, une par image. */
export function TextureWarmup() {
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    const tex = uploads.shift()
    if (tex && tex.image) gl.initTexture(tex)
  })
  return null
}
