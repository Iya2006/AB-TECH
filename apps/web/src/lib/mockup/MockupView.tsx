import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { loadBase, renderMockup, type MockupBase, type PrintSpec } from './engine'

/**
 * Affiche une maquette photo (vêtement recoloré + marquage), recalculée à chaque changement.
 * Le canvas a la résolution de la photo : net sur écran Retina.
 */
export function MockupView({
  base,
  color,
  print,
  background,
  className = '',
  canvasRef,
}: {
  base: MockupBase
  color: string | null
  print: PrintSpec | null
  background?: string
  className?: string
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadBase>> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let off = false
    setFailed(false)
    loadBase(base)
      .then((L) => !off && setLoaded(L))
      .catch(() => !off && setFailed(true))
    return () => {
      off = true
    }
  }, [base])

  // réglages lus un par un : un objet `print` recréé à chaque rendu ne relance pas le calcul
  const text = print?.text
  const ink = print?.ink
  const logo = print?.logo
  const sub = print?.sub
  const family = print?.font?.family
  const weight = print?.font?.weight
  const mark = print?.mark
  const px = print?.place?.x
  const py = print?.place?.y
  const ps = print?.place?.s
  const finish = print?.finish
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !loaded || loaded.base !== base) return
    const spec: PrintSpec | null = print
      ? {
          text: text ?? '',
          ink: ink ?? '#000',
          logo,
          sub,
          font: family ? { family, weight: weight ?? 800 } : undefined,
          mark,
          place: ps !== undefined ? { x: px ?? 0.5, y: py ?? 0.5, s: ps } : undefined,
          finish,
        }
      : null
    const frame = requestAnimationFrame(() => renderMockup(canvas, loaded, { color, print: spec, background }))
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, base, color, text, ink, logo, sub, family, weight, mark, px, py, ps, finish, background, print === null])

  useEffect(() => {
    if (canvasRef) canvasRef.current = ref.current
  })

  const ready = loaded?.base === base
  return (
    <>
      <canvas ref={ref} className={`${className} transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
      {!ready && !failed && <span className="absolute inset-0 m-auto size-8 animate-spin rounded-full border-2 border-ink/15 border-t-accent" aria-hidden />}
      {failed && <span className="absolute inset-0 grid place-items-center text-[13px] text-ink/50">Aperçu indisponible</span>}
    </>
  )
}
