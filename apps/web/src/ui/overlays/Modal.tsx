import { useEffect, useRef, type ReactNode } from 'react'
import { lockScroll } from '../../lib/scroll'
import { useApp } from '../../lib/store'
import { CloseIcon } from '../primitives'

/** Fenêtre plein écran : fond flouté, Échap pour fermer, défilement de la page bloqué. */
export function Modal({
  children,
  label,
  variant = 'center',
  className,
}: {
  children: ReactNode
  label: string
  variant?: 'center' | 'drawer' | 'full'
  className?: string
}) {
  const close = useApp((s) => s.close)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    lockScroll(true)
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      lockScroll(false)
      previous?.focus?.()
    }
  }, [close])

  const layout =
    variant === 'drawer'
      ? 'drawer-enter ml-auto h-full w-full max-w-md'
      : variant === 'full'
        ? 'panel-enter m-0 h-full w-full md:m-6 md:h-[calc(100%-3rem)] md:rounded-[28px]'
        : 'panel-enter m-auto max-h-[calc(100%-2rem)] w-[calc(100%-1.5rem)] max-w-6xl rounded-[28px]'

  return (
    <div className="overlay-enter fixed inset-0 z-[80] flex bg-ink/55 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={panel} tabIndex={-1} className={`relative flex flex-col overflow-hidden bg-paper text-ink shadow-2xl outline-none ${layout} ${className ?? ''}`} data-lenis-prevent>
        <button onClick={close} className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-white/90 shadow ring-1 ring-ink/10 transition hover:rotate-90 hover:bg-white" aria-label="Fermer">
          <CloseIcon className="size-5" />
        </button>
        {children}
      </div>
    </div>
  )
}
