import { DEFAULT_STATIONS } from '@atelier/shared'
import { useEffect, useRef, useState } from 'react'
import { requestQuote } from '../../lib/actions'
import { useSite } from '../../lib/site'
import { useApp } from '../../lib/store'
import { thumbUrl } from '../img'
import { ArrowRight, Kicker } from '../primitives'
import { Modal } from './Modal'

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

/** Galerie d'une réalisation : grande image animée, miniatures, clavier et glissement du doigt. */
export function Lightbox({ id, startIndex = 0 }: { id: string; startIndex?: number }) {
  const r = useSite((s) => s.realisations.find((x) => x.id === id))
  const stations = useSite((s) => s.stations)
  const [index, setIndex] = useState(startIndex)
  const touchX = useRef<number | null>(null)
  const count = r?.images.length ?? 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % count)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count])

  if (!r) return null
  const station = stations.find((s) => s.slug === r.station) ?? DEFAULT_STATIONS.find((s) => s.slug === r.station)
  const go = (d: number) => setIndex((i) => (i + d + count) % count)

  return (
    <Modal label={r.title} variant="full">
      <div className="grid h-full min-h-0 lg:grid-cols-[1fr_380px]">
        <div
          className="relative flex min-h-[55vh] items-center justify-center overflow-hidden bg-ink"
          onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const start = touchX.current
            const end = e.changedTouches[0]?.clientX
            if (start !== null && end !== undefined && Math.abs(end - start) > 40) go(end < start ? 1 : -1)
            touchX.current = null
          }}
        >
          <img key={index} src={thumbUrl(r.images[index] ?? '', 1800)} alt={`${r.title} — image ${index + 1}`} className="image-enter max-h-full max-w-full object-contain" />
          {count > 1 && (
            <>
              <button onClick={() => go(-1)} className="absolute left-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition hover:scale-110" aria-label="Image précédente">
                <Chevron dir="left" />
              </button>
              <button onClick={() => go(1)} className="absolute right-4 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition hover:scale-110" aria-label="Image suivante">
                <Chevron dir="right" />
              </button>
              <p className="kicker absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/60 px-3 py-1 text-paper">
                {index + 1} / {count}
              </p>
            </>
          )}
        </div>
        <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto p-6 md:p-8">
          <Kicker className="text-accent">{station?.kicker ?? r.station}</Kicker>
          <h2 className="font-display text-4xl leading-tight">{r.title}</h2>
          {r.description && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink/70">{r.description}</p>}
          {count > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {r.images.map((img, i) => (
                <button key={img + i} onClick={() => setIndex(i)} className={`aspect-square overflow-hidden rounded-xl ring-2 transition ${i === index ? 'ring-accent' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={thumbUrl(img, 240)} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              className="btn btn-ink justify-center"
              onClick={() => {
                useApp.getState().close()
                requestQuote(station?.service)
              }}
            >
              Je veux la même chose <ArrowRight className="size-4" />
            </button>
            <button className="btn btn-ghost justify-center" onClick={() => useApp.getState().open({ type: 'catalogue', tab: 'realisations', station: r.station })}>
              Voir le catalogue
            </button>
          </div>
        </aside>
      </div>
    </Modal>
  )
}
