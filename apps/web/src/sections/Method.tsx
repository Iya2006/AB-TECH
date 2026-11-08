import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { requestQuote } from '../lib/actions'
import { useSection } from '../lib/site'
import { useReveal } from '../ui/hooks'
import { ArrowRight, Kicker, SplitTitle } from '../ui/primitives'

/* Illustrations au trait (dessinées à l'apparition), couleurs process de l'imprimeur en accent. */
const draw = 'method-draw'

function BriefArt() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect className={draw} x="46" y="40" width="150" height="92" rx="18" stroke="currentColor" strokeWidth="3" pathLength={1} />
      <path className={draw} d="M78 132l-14 26 34-26" stroke="currentColor" strokeWidth="3" pathLength={1} />
      <path className={draw} d="M72 74h96M72 98h62" stroke="var(--color-cyan)" strokeWidth="4" pathLength={1} />
      <rect className={draw} x="150" y="110" width="128" height="78" rx="18" stroke="currentColor" strokeWidth="3" pathLength={1} style={{ animationDelay: '.25s' }} />
      <path className={draw} d="M246 188l12 22-30-22" stroke="currentColor" strokeWidth="3" pathLength={1} style={{ animationDelay: '.25s' }} />
      <path className={draw} d="M174 140h80M174 160h48" stroke="var(--color-magenta)" strokeWidth="4" pathLength={1} style={{ animationDelay: '.4s' }} />
    </g>
  )
}

function ProofArt() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect className={draw} x="70" y="30" width="150" height="190" rx="10" stroke="currentColor" strokeWidth="3" pathLength={1} />
      <circle className={draw} cx="145" cy="96" r="34" stroke="var(--color-cyan)" strokeWidth="4" pathLength={1} />
      <path className={draw} d="M145 52v88M101 96h88" stroke="currentColor" strokeWidth="2" pathLength={1} style={{ animationDelay: '.2s' }} />
      <path className={draw} d="M96 160h98M96 182h60" stroke="currentColor" strokeWidth="3" pathLength={1} style={{ animationDelay: '.3s' }} />
      <g className="method-stamp">
        <rect x="186" y="150" width="96" height="46" rx="10" stroke="var(--color-magenta)" strokeWidth="4" transform="rotate(-10 234 173)" />
        <text x="234" y="181" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--color-magenta)" transform="rotate(-10 234 173)" fontFamily="'Plus Jakarta Sans Variable', sans-serif">
          BAT ✓
        </text>
      </g>
    </g>
  )
}

function PressArt() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect className={draw} x="50" y="70" width="220" height="92" rx="16" stroke="currentColor" strokeWidth="3" pathLength={1} />
      <path className={draw} d="M86 70V40h148v30" stroke="currentColor" strokeWidth="3" pathLength={1} />
      <circle cx="232" cy="104" r="6" fill="var(--color-yellow)" />
      <path className={draw} d="M90 162v52h140v-52" stroke="currentColor" strokeWidth="3" pathLength={1} style={{ animationDelay: '.2s' }} />
      <g className="method-sheet">
        {['var(--color-cyan)', 'var(--color-magenta)', 'var(--color-yellow)', '#f6f8fc'].map((c, i) => (
          <rect key={c} x={104 + i * 30} y="180" width="22" height="18" rx="3" fill={c} opacity={i === 3 ? 0.9 : 1} />
        ))}
      </g>
    </g>
  )
}

function HandoverArt() {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path className={draw} d="M160 40l100 40v96l-100 40-100-40V80l100-40Z" stroke="currentColor" strokeWidth="3" pathLength={1} />
      <path className={draw} d="M60 80l100 40 100-40M160 120v96" stroke="currentColor" strokeWidth="3" pathLength={1} style={{ animationDelay: '.2s' }} />
      <path className={draw} d="M110 60l100 40" stroke="var(--color-yellow)" strokeWidth="5" pathLength={1} style={{ animationDelay: '.35s' }} />
      <circle className={draw} cx="232" cy="190" r="26" stroke="var(--color-cyan)" strokeWidth="4" pathLength={1} style={{ animationDelay: '.45s' }} />
      <path className={draw} d="M220 190l9 9 16-18" stroke="var(--color-cyan)" strokeWidth="4" pathLength={1} style={{ animationDelay: '.6s' }} />
    </g>
  )
}

const STEPS: Array<{ n: string; color: string; title: string; text: string; points: string[]; art: ReactNode }> = [
  {
    n: '01',
    color: 'var(--color-cyan)',
    title: 'Le brief',
    text: 'Vous nous expliquez votre besoin — support, quantité, délai — par téléphone, WhatsApp ou via le formulaire.',
    points: ['Téléphone', 'WhatsApp', 'Formulaire en ligne'],
    art: <BriefArt />,
  },
  {
    n: '02',
    color: 'var(--color-magenta)',
    title: 'Création & BAT',
    text: 'Nous créons ou adaptons votre visuel, puis vous validez le bon à tirer avant toute impression.',
    points: ['Création ou adaptation', 'Bon à tirer validé par vous'],
    art: <ProofArt />,
  },
  {
    n: '03',
    color: 'var(--color-yellow)',
    title: 'Production',
    text: 'Impression et personnalisation réalisées à l’atelier, avec un contrôle des couleurs à chaque étape.',
    points: ['Réalisé à l’atelier', 'Contrôle des couleurs'],
    art: <PressArt />,
  },
  {
    n: '04',
    color: '#a5b4fc',
    title: 'Remise',
    text: 'Votre commande vous est remise prête à l’emploi. Simple, net, à l’heure.',
    points: ['Prêt à l’emploi', 'Installation et mise en service (sécurité, réseau)'],
    art: <HandoverArt />,
  },
]

/**
 * Notre méthode, racontée au défilement : à gauche l'illustration de l'étape en cours (elle se redessine
 * à chaque étape), à droite les quatre étapes qui s'allument une à une le long d'une ligne de progression.
 */
export function Method() {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref, 0.12)
  const t = useSection('methode')
  const items = useRef<Array<HTMLLIElement | null>>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step))
      },
      { rootMargin: '-48% 0px -48% 0px' },
    )
    items.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  const step = STEPS[active]!
  return (
    <section id="methode" ref={ref} className="relative bg-ink text-paper">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 size-[38rem] rounded-full opacity-25 blur-3xl transition-colors duration-1000" style={{ background: step.color }} />
      </div>
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-24 md:px-10 md:py-32 lg:grid-cols-12">
        <div className="self-start lg:sticky lg:top-28 lg:col-span-5">
          <Kicker className="fade-up text-paper/50">
            <span className="text-yellow">●</span> {t.kicker}
          </Kicker>
          <SplitTitle lines={t.title} className="mt-5 font-display text-[clamp(2.46rem,4.6vw,4.6rem)] leading-[0.94]" />
          {t.text && (
            <p className="fade-up mt-6 max-w-md text-[15.5px] leading-relaxed text-paper/65" style={{ '--d': '300ms' } as CSSProperties}>
              {t.text}
            </p>
          )}

          {/* illustration de l'étape en cours */}
          <div className="fade-up relative mt-10 hidden aspect-[16/11] overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#16213f,#0d1530)] ring-1 ring-white/10 lg:block" style={{ '--d': '400ms' } as CSSProperties}>
            <span className="absolute left-6 top-5 font-display text-[5.5rem] leading-none text-white/[0.06]">{step.n}</span>
            <svg key={step.n} viewBox="0 0 320 240" className="absolute inset-0 m-auto h-[82%] w-[82%] text-white/85" aria-hidden>
              {step.art}
            </svg>
            <div className="absolute inset-x-6 bottom-5 flex gap-1.5">
              {STEPS.map((s, i) => (
                <span key={s.n} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full transition-transform duration-700 ease-[var(--ease-expo)]" style={{ background: s.color, transform: `scaleX(${i <= active ? 1 : 0})`, transformOrigin: 'left' }} />
                </span>
              ))}
            </div>
          </div>

          <button onClick={() => requestQuote()} className="fade-up btn mt-8 h-12 bg-white px-6 text-[14.5px] text-ink hover:bg-accent hover:text-white" style={{ '--d': '500ms' } as CSSProperties}>
            Démarrer mon projet <ArrowRight className="size-4" />
          </button>
        </div>

        <ol className="relative lg:col-span-6 lg:col-start-7">
          {/* ligne de progression */}
          <span aria-hidden className="absolute bottom-10 left-[19px] top-10 w-px bg-white/10" />
          <span
            aria-hidden
            className="absolute left-[19px] top-10 w-px origin-top bg-linear-to-b from-cyan via-magenta to-yellow transition-transform duration-700 ease-[var(--ease-expo)]"
            style={{ height: 'calc(100% - 80px)', transform: `scaleY(${(active + 0.5) / STEPS.length})` }}
          />
          {STEPS.map((s, i) => {
            const on = i === active
            return (
              <li
                key={s.n}
                ref={(el) => {
                  items.current[i] = el
                }}
                data-step={i}
                className={`relative flex gap-6 py-10 transition-opacity duration-500 lg:min-h-[46vh] lg:items-center ${on ? 'opacity-100' : 'lg:opacity-35'}`}
              >
                <span
                  className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full font-mono text-[13px] font-bold ring-1 transition-all duration-500"
                  style={on ? { background: s.color, color: '#0a1020', boxShadow: `0 0 0 6px color-mix(in oklab, ${s.color} 22%, transparent)` } : { background: '#0a1020', color: 'rgba(246,248,252,.6)', borderColor: 'rgba(255,255,255,.15)' }}
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="font-display text-[clamp(2rem,3.4vw,3rem)] leading-none">{s.title}</h3>
                  <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-paper/70">{s.text}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {s.points.map((p) => (
                      <li key={p} className="rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-semibold text-paper/80 ring-1 ring-white/10">
                        {p}
                      </li>
                    ))}
                  </ul>
                  {/* sur mobile, l'illustration accompagne chaque étape */}
                  <svg viewBox="0 0 320 240" className="mt-6 h-40 w-auto text-white/80 lg:hidden" aria-hidden>
                    {s.art}
                  </svg>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
