import { useEffect, useState, type RefObject } from 'react'

/** Ajoute `.is-revealed` à l'élément la première fois qu'il entre à l'écran. */
export function useReveal(ref: RefObject<HTMLElement | null>, threshold = 0.2) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add('is-revealed')
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, threshold])
}

/** Visibilité d'un élément (avec marge d'anticipation). */
export function useInView(ref: RefObject<HTMLElement | null>, rootMargin = '200px') {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
  return inView
}
