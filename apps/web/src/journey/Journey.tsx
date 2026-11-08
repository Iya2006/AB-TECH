import type { StationSlug } from '@atelier/shared'
import gsap from 'gsap'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { requestQuote } from '../lib/actions'
import { hasWebGL } from '../lib/device'
import { onJourneyProgress, registerJourney, scrollToElement, scrollToJourney } from '../lib/scroll'
import { useSite } from '../lib/site'
import { useApp } from '../lib/store'
import { ArrowDown, ArrowRight, Kicker, Logo, SplitTitle } from '../ui/primitives'
import { CHAPTERS, chapterAnchor, chapterAt, lastChapterAt, type Chapter } from './chapters'

// Téléchargement lancé dès l'ouverture de la page, en même temps que les polices et le contenu de l'espace pro
// (et non après eux) : le moteur 3D et les ressources de la façade arrivent en parallèle.
const sceneModule = hasWebGL() ? import('../three/JourneyScene') : null
const JourneyScene = lazy(() => sceneModule!.then((m) => ({ default: m.JourneyScene })))

export function Journey({ fontsReady, onLoaded }: { fontsReady: boolean; onLoaded: () => void }) {
  const sectionRef = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(true)
  const webgl = useMemo(hasWebGL, [])
  const siteLoaded = useSite((s) => s.loaded)
  // La 3D se met en pause derrière une fenêtre ouverte (galerie, fiche produit…).
  const overlayOpen = useApp((s) => s.overlay !== null)
  const mood = useApp((s) => s.mood)
  // la scène n'apparaît (en fondu) qu'une fois la façade réellement dessinée : jamais d'image à moitié chargée
  const [shown, setShown] = useState(false)
  const onSceneLoaded = useCallback(() => {
    setShown(true)
    onLoaded()
  }, [onLoaded])

  useEffect(() => registerJourney(sectionRef.current), [])
  useEffect(() => {
    if (!webgl) onLoaded()
  }, [webgl, onLoaded])
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { rootMargin: '10% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section id="atelier" ref={sectionRef} className="relative h-[1100vh]" aria-label="Visite de l'atelier">
      {/* fond clair : jamais d'écran noir, même avant la première image 3D */}
      <div className="sticky top-0 h-svh w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#ffffff,#e4ebf5_75%)]">
        {/* la façade en image (vrai rendu de la scène) : repli sans WebGL, et fond le jour tant que la 3D n'est pas prête */}
        {(!webgl || mood === 'day') && (
          <img
            src="/media/atelier-facade.webp"
            srcSet="/media/atelier-facade-800.webp 800w, /media/atelier-facade.webp 1600w"
            sizes="100vw"
            alt={webgl ? '' : 'La façade de l’atelier'}
            fetchPriority={webgl ? 'low' : 'high'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {webgl ? (
          // La scène attend les polices (textes dessinés en 3D) et le contenu de l'espace pro.
          fontsReady &&
          siteLoaded && (
            <div className={`absolute inset-0 transition-opacity duration-700 ${shown ? 'opacity-100' : 'opacity-0'}`}>
              <Suspense fallback={null}>
                <JourneyScene active={inView && !overlayOpen} onLoaded={onSceneLoaded} />
              </Suspense>
            </div>
          )
        ) : (
          // sans 3D : la façade reste à l'écran, assombrie en bas pour la lisibilité des panneaux
          <div className="absolute inset-0 bg-linear-to-t from-ink/70 via-ink/10 to-transparent" />
        )}
        <ChapterOverlays />
        <ProgressRail />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function ChapterOverlays() {
  const [active, setActive] = useState(0)
  const ready = useApp((s) => s.ready)
  useEffect(
    () =>
      onJourneyProgress((p) => {
        setActive(chapterAt(p))
        useApp.getState().setChapter(lastChapterAt(p))
      }),
    [],
  )
  return (
    <>
      {CHAPTERS.map((c, i) => (
        <ChapterPanel key={c.id} chapter={c} active={ready && i === active} />
      ))}
    </>
  )
}

/** Compteur qui s'anime de 0 à sa valeur quand il devient visible. */
function Counter({ value, active }: { value: number; active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!active || !ref.current) return
    const obj = { v: 0 }
    const tween = gsap.to(obj, {
      v: value,
      duration: 1.6,
      delay: 0.5,
      ease: 'power3.out',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = String(Math.round(obj.v))
      },
    })
    return () => {
      tween.kill()
    }
  }, [active, value])
  return <span ref={ref}>0</span>
}

/** Les trois pôles de l'atelier, présentés dans le message d'accueil. */
const PILLARS = [
  { label: 'Impression & branding', color: 'var(--color-cyan)' },
  { label: 'Textile & objets', color: 'var(--color-magenta)' },
  { label: 'Informatique & sécurité', color: 'var(--color-accent)' },
]

/**
 * Accueil dans l'atelier : une carte soignée en bas à gauche (la 3D reste visible), textes réglés dans l'espace pro.
 * Les chiffres sont réels (postes de l'atelier, contenu de l'espace pro) ; un chiffre nul n'est pas affiché.
 */
function Welcome({ active, base }: { chapter: Chapter; active: boolean; base: string }) {
  const realisations = useSite((s) => s.realisations.length)
  const products = useSite((s) => s.products.length)
  const welcome = useSite((s) => s.settings.welcome)
  const stats = [
    { value: STATIONS.length, label: 'postes' },
    { value: realisations, label: 'réalisations' },
    { value: products, label: 'produits' },
  ].filter((s) => s.value > 0)
  const first = STATIONS[0]
  return (
    <div className={`${base} inset-x-0 bottom-0 px-3 pb-3 md:px-12 md:pb-12`}>
      <article className="max-w-[31rem] rounded-[26px] bg-white/[0.96] p-6 text-ink shadow-[0_40px_90px_-40px_rgba(10,16,32,0.55)] ring-1 ring-ink/[0.06] md:p-7">
        <div className="fade-up flex items-center gap-3">
          <Logo className="origin-left scale-[0.82]" />
          <span className="h-5 w-px bg-ink/15" />
          <span className="kicker text-accent">Bienvenue</span>
        </div>
        <SplitTitle lines={welcome.title} italicLine={1} className="mt-5 font-display text-[clamp(1.9rem,2.9vw,2.7rem)] leading-[1.02]" />
        <p className="fade-up mt-3 text-[15px] leading-relaxed text-ink/70" style={{ '--d': '260ms' } as CSSProperties}>
          {welcome.text}
        </p>
        <ul className="fade-up mt-5 flex flex-wrap gap-1.5" style={{ '--d': '360ms' } as CSSProperties}>
          {PILLARS.map((p) => (
            <li key={p.label} className="flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink/75 ring-1 ring-ink/[0.06]">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.label}
            </li>
          ))}
        </ul>
        {stats.length > 0 && (
          <dl className="fade-up mt-5 grid grid-cols-3 border-y border-ink/[0.07] py-3" style={{ '--d': '440ms' } as CSSProperties}>
            {stats.map((s, i) => (
              <div key={s.label} className={i ? 'border-l border-ink/[0.07] pl-4' : ''}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-[1.75rem] leading-none text-ink">
                  <Counter value={s.value} active={active} />
                </dd>
                <span className="text-[12.5px] font-semibold text-ink/50">{s.label}</span>
              </div>
            ))}
          </dl>
        )}
        <div className="fade-up mt-5 flex flex-wrap items-center gap-2" style={{ '--d': '520ms' } as CSSProperties}>
          {first && (
            <button onClick={() => scrollToJourney(chapterAnchor(first))} className="btn h-11 bg-ink px-5 text-[14px] text-white hover:bg-accent">
              Commencer la visite <ArrowDown className="size-4" />
            </button>
          )}
          <button onClick={() => requestQuote()} className="btn btn-ghost h-11 px-5 text-[14px]">
            Devis gratuit
          </button>
        </div>
        <p className="fade-up mt-4 hidden items-center gap-2 text-[12.5px] font-semibold text-ink/55 sm:flex" style={{ '--d': '600ms' } as CSSProperties}>
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          Cliquez sur les machines, les cadres et les produits
        </p>
      </article>
    </div>
  )
}

function ChapterPanel({ chapter: c, active }: { chapter: Chapter; active: boolean }) {
  const settings = useSite((s) => s.settings)
  const station = useSite((s) => s.stations.find((st) => st.slug === c.id))
  const state = active ? 'is-active visible opacity-100' : 'invisible opacity-0 pointer-events-none'
  const base = `absolute z-10 transition-[opacity,visibility] duration-700 ${state}`

  if (c.kind === 'hero') {
    return (
      <div className={`${base} inset-x-0 bottom-0 px-5 pb-10 md:px-12 md:pb-14`}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[150%] bg-gradient-to-t from-ink/85 via-ink/45 to-transparent" />
        <div className="max-w-5xl text-paper">
          <Kicker className="fade-up mb-6 text-paper/70">
            <span className="colorbar inline-block h-2 w-8" /> {settings.tagline}
          </Kicker>
          <SplitTitle
            as="h1"
            lines={settings.heroTitle}
            className="font-display text-[clamp(2.5rem,6.2vw,6.2rem)] leading-[0.98] text-balance"
          />
          <p className="fade-up mt-6 max-w-md text-[15px] leading-relaxed text-paper/75" style={{ '--d': '500ms' } as CSSProperties}>
            {settings.heroText}
          </p>
        </div>
        <button
          onClick={() => scrollToJourney(chapterAnchor(CHAPTERS[1]!))}
          className="fade-up kicker absolute bottom-14 right-28 hidden items-center gap-3 text-paper/80 md:flex"
          style={{ '--d': '800ms' } as CSSProperties}
        >
          Défilez pour entrer
          <span className="relative grid size-11 place-items-center rounded-full border border-paper/30">
            <ArrowDown className="size-4 animate-bounce" />
          </span>
        </button>
      </div>
    )
  }

  if (c.kind === 'welcome') return <Welcome chapter={c} active={active} base={base} />

  if (c.kind === 'final') {
    return (
      <div className={`${base} inset-0 grid place-items-center px-5 text-center text-paper`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_50%_50%,rgba(14,14,16,0.72),transparent)]" />
        <div className="relative">
          <SplitTitle lines={c.title} className="font-display text-[clamp(2.5rem,6vw,5.8rem)] leading-[0.98]" />
          <div className="fade-up mt-10 flex flex-wrap justify-center gap-3" style={{ '--d': '500ms' } as CSSProperties}>
            <button className="btn btn-paper" onClick={() => useApp.getState().open({ type: 'catalogue' })}>
              Voir tout le catalogue <ArrowRight className="size-4" />
            </button>
            <button className="btn bg-accent text-paper hover:bg-ink" onClick={() => scrollToElement('#boutique')}>
              La boutique
            </button>
            <button className="btn btn-ink ring-1 ring-paper/20" onClick={() => requestQuote()}>
              Demander un devis
            </button>
          </div>
        </div>
      </div>
    )
  }

  const content = station ?? { kicker: c.kicker ?? '', title: c.title, body: c.body ?? '', tags: c.tags ?? [], service: c.service }
  const isShop = c.id === 'informatique' || c.id === 'securite'
  const dark = c.theme === 'dark'
  const sideClass = c.side === 'left' ? 'md:left-[5vw] md:right-auto' : 'md:right-[calc(5vw+28px)] md:left-auto'
  return (
    <div className={`${base} inset-x-3 bottom-3 md:inset-x-auto md:bottom-auto md:top-1/2 md:w-[min(450px,38vw)] md:-translate-y-1/2 ${sideClass}`}>
      {/* carte opaque (pas de flou d'arrière-plan : il ralentit la 3D à chaque image) */}
      <article
        className={`rounded-3xl p-6 shadow-[0_30px_80px_-40px_rgba(10,16,32,0.55)] md:p-8 ${dark ? 'bg-ink/90 text-paper ring-1 ring-paper/10' : 'bg-white/[0.96] text-ink ring-1 ring-ink/[0.06]'}`}
      >
        <Kicker className={`fade-up ${dark ? 'text-paper/60' : 'text-ink/55'}`}>
          <span className="text-accent">{c.number}</span>
          <span className="h-px w-6 bg-current opacity-40" />
          {content.kicker}
        </Kicker>
        <SplitTitle lines={content.title} className="mt-4 font-display text-[clamp(1.85rem,2.9vw,2.75rem)] leading-[1.04]" />
        <p className={`fade-up mt-4 text-[15.5px] leading-relaxed ${dark ? 'text-paper/80' : 'text-ink/75'}`} style={{ '--d': '300ms' } as CSSProperties}>
          {content.body}
        </p>
        <ul className="fade-up mt-5 hidden flex-wrap gap-1.5 sm:flex" style={{ '--d': '420ms' } as CSSProperties}>
          {content.tags.map((t) => (
            <li key={t} className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${dark ? 'bg-paper/10' : 'bg-accent-soft text-accent'}`}>
              {t}
            </li>
          ))}
        </ul>
        <div className="fade-up mt-6 flex flex-wrap items-center gap-x-5 gap-y-3" style={{ '--d': '520ms' } as CSSProperties}>
          <button
            onClick={() =>
              c.id === 'textile'
                ? scrollToElement('#portant')
                : useApp.getState().open(
                    isShop
                      ? { type: 'catalogue', tab: 'produits', station: c.id as StationSlug }
                      : { type: 'catalogue', tab: 'realisations', station: c.id as StationSlug },
                  )
            }
            className="btn h-10 bg-accent px-4 text-[13.5px] text-paper hover:bg-ink"
          >
            {c.id === 'textile' ? 'Voir le portant' : isShop ? 'Voir la boutique' : 'Voir le catalogue'}
          </button>
          <button onClick={() => requestQuote(content.service)} className="group inline-flex items-center gap-2 text-[14px] font-semibold">
            <span className="border-b border-current pb-0.5">Demander un devis</span>
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </article>
    </div>
  )
}

/* ------------------------------------------------------------------ */

const STATIONS = CHAPTERS.filter((c) => c.kind === 'station')

function ProgressRail() {
  const fill = useRef<HTMLDivElement>(null)
  const chapter = useApp((s) => s.chapter)
  const ready = useApp((s) => s.ready)
  const current = CHAPTERS[chapter]
  const dark = current?.theme !== 'light'
  useEffect(
    () =>
      onJourneyProgress((p) => {
        if (fill.current) fill.current.style.transform = `scaleY(${p})`
      }),
    [],
  )
  return (
    <nav
      aria-label="Postes de l'atelier"
      className={`absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 transition-opacity duration-700 md:block ${ready ? 'opacity-100' : 'opacity-0'} ${
        dark ? 'text-paper' : 'text-ink'
      }`}
    >
      <div className="relative flex flex-col items-center gap-3.5 py-2">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current opacity-15" />
        <div ref={fill} className="absolute inset-y-0 left-1/2 w-px origin-top -translate-x-1/2 bg-accent" style={{ transform: 'scaleY(0)' }} />
        {STATIONS.map((c) => {
          const on = current?.id === c.id
          return (
            <button key={c.id} onClick={() => scrollToJourney(chapterAnchor(c))} className="group relative grid size-6 place-items-center" aria-label={c.nav} aria-current={on}>
              <span className={`block rounded-full transition-all duration-500 ${on ? 'size-2.5 bg-accent' : 'size-1.5 bg-current opacity-50 group-hover:opacity-100'}`} />
              <span className="kicker pointer-events-none absolute right-8 whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                {c.number} {c.nav}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
