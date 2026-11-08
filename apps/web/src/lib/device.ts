export type Quality = 'high' | 'medium' | 'low'

/**
 * Niveau de qualité 3D de départ, ajusté ensuite en direct selon les FPS.
 * Beaucoup de visiteurs viendront d'un smartphone : on protège les appareils modestes.
 */
export function detectQuality(): Quality {
  // Forçage possible pour comparer les rendus : ?q=low | medium | high
  const forced = new URLSearchParams(window.location.search).get('q')
  if (forced === 'low' || forced === 'medium' || forced === 'high') return forced
  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const memory = nav.deviceMemory ?? 8
  const cores = nav.hardwareConcurrency ?? 8
  const { renderer } = probeGpu()
  // rendu logiciel (pas de carte graphique utilisable) : le strict minimum
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return 'low'
  // téléphones et tablettes : qualité basse sauf appareil nettement puissant (la baisse automatique veille ensuite)
  if (coarse && (memory < 6 || cores < 8)) return 'low'
  if (coarse || memory <= 4 || cores <= 4) return 'medium'
  // puces graphiques intégrées (la plupart des portables) : sans occlusion ambiante ni ombres douces,
  // sinon la visite saccade avant que la baisse automatique n'intervienne
  if (INTEGRATED.test(renderer) && !DISCRETE.test(renderer)) return 'medium'
  return 'high'
}

const INTEGRATED = /intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega \d|mali|adreno|powervr|apple gpu/i
const DISCRETE = /nvidia|geforce|quadro|rtx|gtx|radeon rx|radeon pro|apple m\d/i

type Gpu = { webgl: boolean; renderer: string }
let gpu: Gpu | null = null

const GPU_KEY = 'abt-gpu'

/**
 * WebGL disponible, et nom de la carte graphique annoncé par le navigateur (vide s'il est masqué).
 * Mesuré une fois par onglet : ouvrir un contexte WebGL pour le lire coûte plus d'un dixième de seconde.
 */
export function probeGpu() {
  if (gpu) return gpu
  try {
    const saved = JSON.parse(sessionStorage.getItem(GPU_KEY) ?? 'null') as Gpu | null
    if (saved && typeof saved.webgl === 'boolean' && typeof saved.renderer === 'string') return (gpu = saved)
  } catch {
    // stockage indisponible : on mesure
  }
  gpu = { webgl: false, renderer: '' }
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      gpu = { webgl: true, renderer: String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '') }
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    // pas de WebGL
  }
  try {
    sessionStorage.setItem(GPU_KEY, JSON.stringify(gpu))
  } catch {
    // stockage indisponible
  }
  return gpu
}

export const hasWebGL = () => probeGpu().webgl

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
