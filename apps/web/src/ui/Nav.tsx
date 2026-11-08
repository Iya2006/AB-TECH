import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { CHAPTERS, chapterAnchor } from '../journey/chapters'
import { requestQuote } from '../lib/actions'
import { useCart } from '../lib/cart'
import { journey, lockScroll, onJourneyProgress, scrollToElement, scrollToJourney } from '../lib/scroll'
import { useApp } from '../lib/store'
import { AccountMenu } from './AccountMenu'
import { ArrowRight, Logo } from './primitives'

const WELCOME = CHAPTERS.find((c) => c.kind === 'welcome')!

/** Liens de la barre (comme une boutique en ligne : on va droit au but). `id` : section suivie par la pastille. */
const LINKS: Array<{ label: string; action: () => void; id?: string }> = [
  { label: 'L’atelier', action: () => scrollToJourney(chapterAnchor(WELCOME)), id: 'atelier' },
  { label: 'Le portant', action: () => scrollToElement('#portant'), id: 'portant' },
  { label: 'Boutique', action: () => scrollToElement('#boutique'), id: 'boutique' },
  { label: 'Studio', action: () => scrollToElement('#studio'), id: 'studio' },
  { label: 'Catalogue', action: () => useApp.getState().open({ type: 'catalogue' }) },
  { label: 'Avis', action: () => scrollToElement('#avis'), id: 'avis' },
  { label: 'Contact', action: () => scrollToElement('#contact'), id: 'contact' },
]
const TRACKED = LINKS.flatMap((l) => (l.id ? [l.id] : []))

/** Section au milieu de l'écran (null entre deux sections suivies). */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const seen = new Map<string, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting))
        setActive(TRACKED.find((id) => seen.get(id)) ?? null)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    // les sections arrivent avec le contenu de l'espace pro : on réessaie un peu plus tard
    const watch = () => TRACKED.forEach((id) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    watch()
    const retry = setTimeout(watch, 2500)
    return () => {
      clearTimeout(retry)
      io.disconnect()
    }
  }, [])
  return active
}

/** Avancée dans la page, de 0 à 1 (trait lumineux sous la barre). */
function useScrollLine(line: RefObject<HTMLSpanElement | null>) {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    let raf = 0
    // hauteur de la page mesurée seulement quand elle change : la lire à chaque image du défilement
    // forçait le navigateur à recalculer toute la mise en page
    let max = 0
    const measure = () => {
      max = document.documentElement.scrollHeight - window.innerHeight
    }
    const update = () => {
      raf = 0
      // position tenue par la boucle de défilement (lire window.scrollY ici forçait un recalcul de la page)
      const y = journey.scrollY
      if (line.current) line.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`
      setCompact(y > 40)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const onResize = () => {
      measure()
      onScroll()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(document.body)
    measure()
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [line])
  return compact
}

const MORE: Array<{ label: string; action: () => void }> = [
  { label: 'Prestations', action: () => scrollToElement('#prestations') },
  { label: 'Demander un devis', action: () => scrollToElement('#devis') },
]

// un peu plus serrés sur les petits téléphones (360 px) : logo + 4 boutons tiennent sans déborder
const iconBtn = 'relative grid size-9 place-items-center rounded-xl text-white/85 transition hover:bg-white/10 hover:text-white min-[400px]:size-10'

/** Bascule jour / nuit (le site suit l'heure du visiteur par défaut). */
function MoodToggle() {
  const mood = useApp((s) => s.mood)
  const toggle = useApp((s) => s.toggleMood)
  const night = mood === 'night'
  return (
    <button onClick={toggle} className={iconBtn} aria-label={night ? 'Passer en mode jour' : 'Passer en mode nuit'} title={night ? 'Mode jour' : 'Mode nuit'}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        {night ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  )
}

function CartButton() {
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0))
  return (
    <button onClick={() => useApp.getState().open({ type: 'cart' })} className={iconBtn} aria-label={`Panier (${count} article${count > 1 ? 's' : ''})`}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 8h14l-1.2 12H6.2L5 8Zm4 0V6a3 3 0 0 1 6 0v2" />
      </svg>
      {count > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-[18px] text-white">{count}</span>}
    </button>
  )
}

export function Nav() {
  const ready = useApp((s) => s.ready)
  const chapter = useApp((s) => s.chapter)
  const [inJourney, setInJourney] = useState(true)
  const [open, setOpen] = useState(false)
  const current = CHAPTERS[chapter]
  const line = useRef<HTMLSpanElement>(null)
  const compact = useScrollLine(line)
  const active = useActiveSection()
  // pastille qui glisse sous le lien de la section en cours
  const links = useRef<Array<HTMLButtonElement | null>>([])
  const navRef = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const i = LINKS.findIndex((l) => l.id && l.id === active)
    const el = links.current[i]
    const nav = navRef.current
    if (!el || !nav) return setPill(null)
    const a = el.getBoundingClientRect()
    const b = nav.getBoundingClientRect()
    setPill({ x: a.left - b.left, w: a.width })
  }, [active, compact])

  useEffect(() => onJourneyProgress((p) => setInJourney(p < 0.995)), [])
  useEffect(() => {
    if (!ready) return
    lockScroll(open)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, ready])

  const go = (action: () => void) => {
    setOpen(false)
    // laisse le menu se refermer avant de lancer le défilement
    setTimeout(action, 80)
  }

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 px-3 pt-3 transition-[opacity,transform] duration-500 md:px-5 ${ready ? 'opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'}`}>
        {/* bleu nuit opaque (pas de flou d'arrière-plan : il ralentirait la 3D dessous) */}
        <div
          className={`relative mx-auto flex max-w-[1440px] items-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#121b36,#0a1124)] pl-4 pr-2 text-white shadow-[0_18px_50px_-24px_rgba(5,10,24,0.9)] ring-1 ring-white/[0.09] transition-[height] duration-500 md:pl-5 ${
            compact ? 'h-14' : 'h-16'
          }`}
        >
          {/* lisière lumineuse et avancée dans la page */}
          <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white/25 to-transparent" />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.06]">
            <span ref={line} className="block h-full origin-left bg-linear-to-r from-accent via-accent-2 to-[#a78bfa]" style={{ transform: 'scaleX(0)' }} />
          </span>
          <button onClick={() => go(() => scrollToJourney(0))} aria-label="Retour à l'accueil" className="shrink-0">
            <Logo onDark />
          </button>
          {inJourney && current?.number && (
            <span className="hidden items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-[12.5px] font-bold text-[#9cc5ff] ring-1 ring-accent/30 xl:inline-flex">
              {current.number} · {current.nav}
            </span>
          )}
          <nav ref={navRef} className="relative mx-auto hidden items-center gap-0.5 xl:flex" aria-label="Navigation principale">
            <span
              aria-hidden
              className={`absolute inset-y-0 rounded-xl bg-white/[0.09] ring-1 ring-white/10 transition-[transform,width,opacity] duration-500 ease-[var(--ease-expo)] ${pill ? 'opacity-100' : 'opacity-0'}`}
              style={{ width: pill?.w ?? 0, transform: `translateX(${pill?.x ?? 0}px)` }}
            />
            {LINKS.map((l, i) => {
              const on = !!l.id && l.id === active
              return (
                <button
                  key={l.label}
                  ref={(el) => {
                    links.current[i] = el
                  }}
                  onClick={() => go(l.action)}
                  aria-current={on ? 'true' : undefined}
                  className={`relative rounded-xl px-3.5 py-2 text-[14.5px] font-semibold transition-colors ${on ? 'text-white' : 'text-white/65 hover:text-white'}`}
                >
                  {l.label}
                </button>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-0.5 min-[400px]:gap-1 xl:ml-0">
            <MoodToggle />
            <CartButton />
            <AccountMenu className={iconBtn} />
            <button
              onClick={() => requestQuote()}
              className="btn ml-1 hidden h-11 rounded-xl bg-linear-to-r from-accent to-[#1d9bf0] px-5 text-[14px] font-semibold text-white shadow-[0_10px_28px_-10px_rgba(37,99,235,0.95)] hover:brightness-110 sm:inline-flex"
            >
              Devis gratuit
            </button>
            <button onClick={() => setOpen((o) => !o)} className={`${iconBtn} xl:hidden`} aria-expanded={open} aria-controls="menu" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}>
              <span className="relative block h-3 w-5">
                <span className={`absolute left-0 h-0.5 w-full rounded bg-current transition-transform duration-300 ${open ? 'top-[5px] rotate-45' : 'top-0'}`} />
                <span className={`absolute left-0 h-0.5 w-full rounded bg-current transition-transform duration-300 ${open ? 'top-[5px] -rotate-45' : 'top-2.5'}`} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Menu plein écran (mobile et tablette) */}
      <div
        id="menu"
        className={`fixed inset-0 z-40 overflow-y-auto bg-[radial-gradient(ellipse_at_80%_0%,#16224a,#0a1020_65%)] text-paper transition-[clip-path] duration-500 ease-[var(--ease-quart)] ${
          open ? '[clip-path:inset(0_0_0_0)]' : 'pointer-events-none [clip-path:inset(0_0_100%_0)]'
        }`}
        data-lenis-prevent
      >
        <div className={`mx-auto grid min-h-full max-w-7xl gap-10 px-5 pb-12 pt-28 md:grid-cols-2 md:px-10 ${open ? 'is-revealed' : ''}`}>
          <div>
            <p className="kicker mb-5 text-paper/50">L’atelier</p>
            <ul className="space-y-1">
              {CHAPTERS.filter((c) => c.kind === 'station').map((c, i) => (
                <li key={c.id} className="split-line">
                  <button
                    onClick={() => go(() => scrollToJourney(chapterAnchor(c)))}
                    className="split-word group flex items-baseline gap-4 text-left font-display text-[2.1rem] leading-tight md:text-5xl"
                    style={{ '--i': i } as CSSProperties}
                  >
                    <span className="text-sm font-bold text-accent">{c.number}</span>
                    <span className="transition-transform duration-300 group-hover:translate-x-2 group-hover:text-accent">{c.nav}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="kicker mb-5 text-paper/50">Le site</p>
            <ul className="space-y-1">
              {[...LINKS.slice(1), ...MORE].map((s, i) => (
                <li key={s.label} className="split-line">
                  <button onClick={() => go(s.action)} className="split-word group flex items-center gap-3 font-display text-[2.1rem] leading-tight md:text-5xl" style={{ '--i': i + 3 } as CSSProperties}>
                    {s.label}
                    <ArrowRight className="size-6 text-accent opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
