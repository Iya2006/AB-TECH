import { useMemo } from 'react'
import { requestQuote } from '../../lib/actions'
import { MACHINES, type MachineId } from '../../lib/machines'
import { realisationsOf, useSite } from '../../lib/site'
import { useApp } from '../../lib/store'
import { thumbUrl } from '../img'
import { ArrowRight, CheckIcon, Kicker } from '../primitives'
import { Modal } from './Modal'

/** Pictogrammes au trait des équipements (illustration de la fiche, et blocs de l'espace pro). */
export const MACHINE_ICON: Record<MachineId, string> = {
  'poste-creation': 'M3 4h18v12H3zM8 20h8M12 16v4M7 12l3-4 3 3 2-2 2 3',
  'grand-format': 'M2 8h20v7H2zM5 8V5h14v3M5 15v5h14v-5M17 11.5h2',
  decoupe: 'M2 9h20v5H2zM6 14l-1 5M18 14l1 5M10 9V6h4v3M12 14v2',
  copieur: 'M5 3h14v6H5zM4 9h16v11H4zM8 14h8M8 17h5',
  massicot: 'M3 19h18M6 19V9l12-3v13M6 12l12-3M15 4l3 2',
  'presse-chaud': 'M3 19h18M6 19v-3h12v3M8 16V9l9-3v4M10 9h7',
  carrousel: 'M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4',
  'baie-reseau': 'M6 2h12v20H6zM9 6h6M9 9h6M9 12h6M9 15h6M12 19h0',
  videosurveillance: 'M3 8h12v7H3zM15 10.5l6-3v8l-6-3M7 15v4h6',
}

/** Fiche d'un équipement de l'atelier : ce qu'il fabrique, les réalisations du poste, le devis. */
export function MachineModal({ id }: { id: MachineId }) {
  // texte de l'espace pro s'il a été modifié, sinon celui par défaut
  const custom = useSite((s) => s.settings.machines?.[id])
  const merged = { ...MACHINES[id], ...custom }
  const m = { ...merged, makes: merged.makes.filter((x) => x.trim()) }
  const all = useSite((s) => s.realisations)
  const realisations = useMemo(() => realisationsOf(all, m.station).slice(0, 6), [all, m.station])
  const open = useApp((s) => s.open)
  return (
    <Modal label={m.name}>
      <div className="grid min-h-0 overflow-y-auto md:grid-cols-[1.05fr_1fr]">
        {/* illustration et réalisations du poste */}
        <div className="relative flex min-h-[18rem] flex-col justify-end overflow-hidden p-6 text-white md:p-8" style={{ background: `linear-gradient(150deg, ${m.from}, ${m.to})` }}>
          <svg viewBox="0 0 24 24" className="absolute -right-10 -top-6 size-[26rem] opacity-[0.13]" fill="none" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={MACHINE_ICON[id]} />
          </svg>
          <svg viewBox="0 0 24 24" className="relative mb-auto size-16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={MACHINE_ICON[id]} />
          </svg>
          {realisations.length > 0 && (
            <div className="relative mt-10">
              <p className="kicker mb-3 text-white/70">Sorti de ce poste</p>
              <div className="grid grid-cols-3 gap-2">
                {realisations.map((r) => (
                  <button key={r.id} onClick={() => open({ type: 'realisation', id: r.id })} className="group aspect-square overflow-hidden rounded-xl ring-1 ring-white/20" aria-label={r.title}>
                    <img src={thumbUrl(r.images[0] ?? '', 300)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col p-6 md:p-10">
          <Kicker className="text-ink/55">
            <span className="text-accent">●</span> {m.kicker}
          </Kicker>
          <h2 className="mt-4 font-display text-[clamp(2rem,3.4vw,2.8rem)] leading-[1.02]">{m.name}</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink/70">{m.text}</p>
          <p className="kicker mt-7 text-ink/50">Ce que nous réalisons avec</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {m.makes.map((x) => (
              <li key={x} className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-[14px] font-semibold ring-1 ring-ink/[0.07]">
                <CheckIcon className="size-4 shrink-0 text-accent" /> {x}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-3 pt-8">
            <button
              onClick={() => {
                useApp.getState().close()
                requestQuote(m.service)
              }}
              className="btn h-12 bg-accent px-6 text-[14.5px] text-white hover:bg-ink"
            >
              Demander un devis <ArrowRight className="size-4" />
            </button>
            <button onClick={() => open({ type: 'catalogue', tab: 'realisations', station: m.station })} className="btn btn-ghost h-12 px-5 text-[14.5px]">
              Voir les réalisations
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
