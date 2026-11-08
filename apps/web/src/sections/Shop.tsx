import type { StationSlug } from '@atelier/shared'
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useSection, useSite } from '../lib/site'
import { useApp } from '../lib/store'
import { useReveal } from '../ui/hooks'
import { ArrowRight, Kicker, SplitTitle } from '../ui/primitives'
import { FeaturedProduct, ProductCard } from '../ui/shop'

const TABS: Array<{ station: StationSlug; label: string; icon: string }> = [
  { station: 'informatique', label: 'Informatique', icon: 'M4 5h16v10H4zM2 19h20' },
  { station: 'securite', label: 'Sécurité', icon: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3Z' },
  { station: 'textile', label: 'Textile', icon: 'M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3c-.5 1.6-2 2.6-4 2.6S8.5 4.6 8 3Z' },
  { station: 'objets', label: 'Objets & cadeaux', icon: 'M5 6h11v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6Zm11 3h2a2 2 0 0 1 0 4h-2' },
]

/** Le parcours d'une commande, tel qu'il se passe vraiment (le prix et la livraison sont confirmés par téléphone). */
const HOW = ['Ajoutez au panier', 'Validez la commande', 'Nous vous rappelons pour confirmer']

/** Boutique : les produits gérés dans l'espace pro, un produit à la une par rayon, ajout au panier, commande. */
export function Shop() {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref, 0.08)
  const t = useSection('boutique')
  const products = useSite((s) => s.products)
  const [station, setStation] = useState<StationSlug>('informatique')
  const list = useMemo(() => products.filter((p) => p.station === station), [products, station])
  const [featured, ...rest] = list
  const grid = rest.slice(0, 6)

  // indicateur qui glisse sous le rayon choisi
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const bar = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState({ x: 0, w: 0 })
  useLayoutEffect(() => {
    const el = tabs.current[TABS.findIndex((t) => t.station === station)]
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth })
  }, [station, products.length])

  return (
    <section id="boutique" ref={ref} className="bg-[#f4f7fb] text-ink">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Kicker className="fade-up text-ink/55">
              <span className="text-accent">●</span> {t.kicker}
            </Kicker>
            <SplitTitle lines={t.title} className="mt-5 font-display text-[clamp(2.46rem,5.38vw,5.04rem)] leading-[0.92]" />
            {t.text && (
              <p className="fade-up mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink/65" style={{ '--d': '300ms' } as CSSProperties}>
                {t.text}
              </p>
            )}
          </div>
          <ol className="fade-up grid gap-2 md:col-span-5" style={{ '--d': '300ms' } as CSSProperties}>
            {HOW.map((h, i) => (
              <li key={h} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-[14.5px] font-semibold ring-1 ring-ink/[0.06]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[12px] text-accent">{i + 1}</span>
                {h}
              </li>
            ))}
          </ol>
        </div>

        <div ref={bar} role="tablist" aria-label="Rayons" className="fade-up relative mt-12 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 ring-1 ring-ink/[0.07] [scrollbar-width:none] sm:inline-flex" style={{ '--d': '350ms' } as CSSProperties}>
          <span aria-hidden className="absolute inset-y-1.5 left-0 rounded-xl bg-ink transition-[transform,width] duration-500 ease-[var(--ease-expo)]" style={{ width: pill.w, transform: `translateX(${pill.x}px)` }} />
          {TABS.map((t, i) => {
            const on = station === t.station
            const n = products.filter((p) => p.station === t.station).length
            return (
              <button
                key={t.station}
                ref={(el) => {
                  tabs.current[i] = el
                }}
                role="tab"
                aria-selected={on}
                onClick={() => setStation(t.station)}
                className={`relative z-10 flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-colors duration-300 ${on ? 'text-white' : 'text-ink/65 hover:text-ink'}`}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
                <span className={`rounded-full px-1.5 text-[11.5px] ${on ? 'bg-white/15' : 'bg-ink/[0.06]'}`}>{n}</span>
              </button>
            )
          })}
        </div>

        {featured ? (
          // clé = rayon : les cartes réapparaissent en cascade à chaque changement
          <div key={station} className="mt-8 grid gap-5 lg:grid-cols-12">
            <div className="shop-enter lg:col-span-5">
              <FeaturedProduct product={featured} />
            </div>
            {grid.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:col-span-7 lg:grid-cols-3">
                {grid.map((p, i) => (
                  <div key={p.id} className="shop-enter" style={{ animationDelay: `${80 + i * 60}ms` }}>
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-10 rounded-[22px] bg-white p-10 text-center text-ink/50 ring-1 ring-ink/[0.07]">Les produits de cette catégorie arrivent bientôt.</p>
        )}

        <button className="btn btn-ghost mt-10" onClick={() => useApp.getState().open({ type: 'catalogue', tab: 'produits', station })}>
          Voir tout le rayon {TABS.find((t) => t.station === station)?.label.toLowerCase()} ({list.length}) <ArrowRight className="size-4" />
        </button>
      </div>
    </section>
  )
}
