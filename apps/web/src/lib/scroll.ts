import Lenis from 'lenis'

/**
 * Progression (0 → 1) dans le parcours 3D.
 * Objet mutable lu à chaque frame par la caméra : aucun re-render React.
 */
export const journey = { progress: 0, top: 0, height: 1 }

type Listener = (progress: number) => void
const listeners = new Set<Listener>()
let journeyEl: HTMLElement | null = null
let lenis: Lenis | null = null

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function measure() {
  if (!journeyEl) return
  journey.top = journeyEl.getBoundingClientRect().top + window.scrollY
  journey.height = journeyEl.offsetHeight
}

function tick() {
  const span = Math.max(1, journey.height - window.innerHeight)
  const p = clamp01((window.scrollY - journey.top) / span)
  if (p !== journey.progress) {
    journey.progress = p
    listeners.forEach((fn) => fn(p))
  }
}

export function initScroll() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const instance = reduceMotion ? null : new Lenis({ lerp: 0.08, wheelMultiplier: 0.85 })
  lenis = instance
  // Une seule boucle, propre à cette instance : Lenis d'abord, puis la progression du parcours.
  let frame = 0
  const loop = (time: number) => {
    instance?.raf(time)
    tick()
    frame = requestAnimationFrame(loop)
  }
  frame = requestAnimationFrame(loop)
  window.addEventListener('resize', measure)

  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', measure)
    instance?.destroy()
    if (lenis === instance) lenis = null
  }
}

export function registerJourney(el: HTMLElement | null) {
  journeyEl = el
  if (!el) return
  measure()
  const ro = new ResizeObserver(measure)
  ro.observe(el)
  return () => ro.disconnect()
}

export function onJourneyProgress(fn: Listener) {
  listeners.add(fn)
  fn(journey.progress)
  return () => {
    listeners.delete(fn)
  }
}

export function lockScroll(locked: boolean) {
  if (locked) lenis?.stop()
  else lenis?.start()
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

/** Défile vers une position du parcours 3D (0 → 1). */
export function scrollToJourney(progress: number, immediate = false) {
  measure()
  const y = journey.top + clamp01(progress) * Math.max(1, journey.height - window.innerHeight)
  scrollToY(y, immediate)
}

export function scrollToElement(selector: string) {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return
  scrollToY(el.getBoundingClientRect().top + window.scrollY)
}

function scrollToY(y: number, immediate = false) {
  if (lenis) {
    const distance = Math.abs(y - window.scrollY)
    // Plus le trajet est long, plus on prend le temps : la caméra traverse l'atelier.
    const duration = immediate ? 0 : Math.min(4.5, 1.2 + distance / 4000)
    lenis.scrollTo(y, { duration, immediate, easing: (t) => 1 - Math.pow(1 - t, 4) })
  } else {
    window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' })
  }
}
