import { SERVICES, type Service } from '@atelier/shared'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { requestQuote } from '../lib/actions'
import { api } from '../lib/api'
import { useSection } from '../lib/site'
import { ArrowRight, Kicker, SplitTitle } from '../ui/primitives'
import { useReveal } from '../ui/hooks'

const GROUPS = [
  { domain: 'print' as const, title: 'Impression & branding', dot: 'text-accent' },
  { domain: 'tech' as const, title: 'Informatique & sécurité', dot: 'text-cyan' },
]

export function ServicesIndex() {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref, 0.08)
  const t = useSection('prestations')
  // Le catalogue vient de l'API (base de données) ; à défaut, de la copie embarquée.
  const [services, setServices] = useState<Service[]>(SERVICES)
  useEffect(() => {
    api
      .services()
      .then((rows) => rows.length && setServices(rows))
      .catch(() => {})
  }, [])

  let n = 0
  return (
    <section id="prestations" ref={ref} className="bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <Kicker className="fade-up text-ink/55">
              {/* sur-titre vide : le nombre réel de prestations */}
              <span className="text-cyan">●</span> {t.kicker || `${services.length} prestations`}
            </Kicker>
            <SplitTitle lines={t.title} className="mt-5 font-display text-[clamp(2.46rem,5.38vw,5.04rem)] leading-[0.92]" />
          </div>
          {t.text && (
            <p className="fade-up text-[15.5px] leading-relaxed text-ink/65 md:col-span-4" style={{ '--d': '300ms' } as CSSProperties}>
              {t.text}
            </p>
          )}
        </div>

        <div className="mt-16 grid gap-14 lg:grid-cols-2 lg:gap-10">
          {GROUPS.map((g) => (
            <div key={g.domain}>
              <h3 className="kicker flex items-center gap-2 border-b border-ink/15 pb-4 text-ink/60">
                <span className={g.dot}>●</span> {g.title}
              </h3>
              <ul>
                {services
                  .filter((s) => s.domain === g.domain)
                  .map((s) => {
                    const num = String(++n).padStart(2, '0')
                    return (
                      <li key={s.slug} className="fade-up" style={{ '--d': `${Math.min(n, 8) * 60}ms` } as CSSProperties}>
                        <button
                          onClick={() => requestQuote(s.slug)}
                          className="group grid w-full grid-cols-[2.2rem_1fr_auto] items-start gap-3 border-b border-ink/10 py-5 text-left transition-colors duration-300 hover:bg-ink/[0.025] md:py-6"
                        >
                          <span className="pt-2 font-mono text-[11px] text-ink/40">{num}</span>
                          <span>
                            <span className="block font-display text-[26px] leading-tight transition-transform duration-500 group-hover:translate-x-1 md:text-[30px]">
                              {s.title}
                            </span>
                            <span className="mt-1.5 block max-w-md text-[14px] leading-relaxed text-ink/60">{s.summary}</span>
                          </span>
                          <span className="mt-1.5 grid size-10 place-items-center rounded-full ring-1 ring-ink/15 transition-all duration-300 group-hover:bg-ink group-hover:text-paper">
                            <ArrowRight className="size-4" />
                          </span>
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
