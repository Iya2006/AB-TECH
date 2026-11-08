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
