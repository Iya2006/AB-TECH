import { STATION_SLUGS, type StationSlug } from '@atelier/shared'
import { useMemo, useState } from 'react'
import { useSite } from '../../lib/site'
import { useApp } from '../../lib/store'
import { thumbUrl } from '../img'
import { Kicker } from '../primitives'
import { ProductCard } from '../shop'
import { Modal } from './Modal'

const STATION_LABEL: Record<StationSlug, string> = {
  creation: 'Création',
  impression: 'Impression',
  textile: 'Textile',
  objets: 'Objets & cadeaux',
  evenementiel: 'Événementiel',
  informatique: 'Informatique',
  securite: 'Sécurité',
}

export function Catalogue({ tab: initialTab = 'realisations', station: initialStation }: { tab?: 'realisations' | 'produits'; station?: string }) {
  const realisations = useSite((s) => s.realisations)
  const products = useSite((s) => s.products)
  const [tab, setTab] = useState(initialTab)
  const [station, setStation] = useState<StationSlug | 'tous'>((initialStation as StationSlug) ?? 'tous')
  const [query, setQuery] = useState('')

  const shownRealisations = useMemo(() => realisations.filter((r) => station === 'tous' || r.station === station), [realisations, station])
  const shownProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter(
      (p) => (station === 'tous' || p.station === station) && (!q || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q)),
    )
  }, [products, station, query])

  const counts = useMemo(() => {
    const source = tab === 'realisations' ? realisations : products
    const c: Record<string, number> = { tous: source.length }
    source.forEach((x) => (c[x.station] = (c[x.station] ?? 0) + 1))
    return c
  }, [tab, realisations, products])

  return (
    <Modal label="Catalogue" variant="full">
      <header className="border-b border-ink/10 px-5 pb-4 pt-6 md:px-10">
        <Kicker className="text-accent">Catalogue</Kicker>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4 pr-14">
          <h2 className="font-display text-4xl md:text-5xl">
            Tout ce que nous <em>faisons.</em>
          </h2>
          <div className="flex rounded-full bg-ink/[0.06] p-1">
            {(['realisations', 'produits'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2 text-[14px] font-semibold transition ${tab === t ? 'bg-ink text-paper' : 'text-ink/70'}`}>
                {t === 'realisations' ? 'Réalisations' : 'Produits'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(['tous', ...STATION_SLUGS] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStation(s)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${station === s ? 'bg-accent text-paper' : 'bg-white text-ink/70 ring-1 ring-ink/10 hover:ring-ink/30'}`}
            >
              {s === 'tous' ? 'Tout' : STATION_LABEL[s]} <span className="opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
          {tab === 'produits' && (
            <input className="field ml-auto max-w-xs !py-2" placeholder="Rechercher un produit…" value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-10">
        {tab === 'realisations' ? (
          shownRealisations.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shownRealisations.map((r) => (
                <button
                  key={r.id}
                  onClick={() => useApp.getState().open({ type: 'realisation', id: r.id })}
                  className="group overflow-hidden rounded-[22px] bg-white text-left ring-1 ring-ink/[0.07] transition-shadow duration-500 hover:shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#eef2f7]">
                    <img src={thumbUrl(r.images[0] ?? '', 700)} alt={r.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    {r.images.length > 1 && <span className="kicker absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 !text-[10px] text-paper">{r.images.length} photos</span>}
                  </div>
                  <div className="p-4">
                    <p className="kicker text-accent">{STATION_LABEL[r.station]}</p>
                    <p className="mt-1 font-semibold">{r.title}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-20 text-center text-ink/50">Les réalisations de ce poste arrivent bientôt.</p>
          )
        ) : shownProducts.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shownProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="py-20 text-center text-ink/50">Aucun produit ne correspond.</p>
        )}
      </div>
    </Modal>
  )
}
