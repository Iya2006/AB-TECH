/**
 * Avancement réel du téléchargement de la façade (modèles, textures, éclairage), de 0 à 1.
 * Alimenté par le gestionnaire de chargement de three.js (dans le module 3D), lu par l'écran de chargement :
 * module minuscule, pour ne pas faire entrer three.js dans le premier fichier du site.
 */
type Listener = (progress: number) => void

let current = 0
const listeners = new Set<Listener>()

export const loading = {
  get: () => current,
  set(progress: number) {
    current = Math.max(current, Math.min(1, progress))
    listeners.forEach((fn) => fn(current))
  },
  subscribe(fn: Listener) {
    listeners.add(fn)
    return () => void listeners.delete(fn)
  },
}

/**
 * Fin des étapes lourdes et indivisibles du démarrage 3D (premières images, reflets de la rue et de l'atelier,
 * mise en place de la façade). L'écran de chargement attend ce signal pour lancer son animation de verre :
 * elle se joue ensuite sans être interrompue (le reste se prépare par petits morceaux).
 */
let booted = false
const bootListeners = new Set<() => void>()

export const boot = {
  done: () => booted,
  set() {
    if (booted) return
    booted = true
    bootListeners.forEach((fn) => fn())
  },
  subscribe(fn: () => void) {
    bootListeners.add(fn)
    return () => void bootListeners.delete(fn)
  },
}
