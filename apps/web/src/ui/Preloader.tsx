import gsap from 'gsap'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { GlassIconReveal } from '../components/ui/glass-icon-reveal'
import { boot, loading } from '../lib/loading'
import { lockScroll } from '../lib/scroll'
import { useSite } from '../lib/site'
import { useApp } from '../lib/store'
import { thumbUrl } from './img'
import { Wordmark } from './primitives'

/** Fond de l'écran de chargement : le verre le peint aussi, les deux doivent être identiques. */
export const PRELOADER_BACKDROP = '#e8ecf3'
const BACKDROP = PRELOADER_BACKDROP
/** Symbole AB-TECH aux couleurs de la marque (cercle et croix bleu nuit, point bleu). */
export const PRELOADER_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="9" fill="none" stroke="#0a1020" stroke-width="2.1"/><path d="M16 3v26M3 16h26" stroke="#0a1020" stroke-width="1.6"/><circle cx="16" cy="16" r="3.2" fill="#2563eb"/></svg>`
const MARK = PRELOADER_MARK
/** La révélation dure un peu moins que celle d'origine : le verre tient le logo 2 s. */
const TUNING = { present: 2 }
/** Le nom monte quand le verre a relâché le logo (la plaque s'est presque effacée), jamais par-dessus. */
const TITLE_AT = TUNING.present + 0.45
/** Dernier logo connu (celui de l'espace pro) : la visite suivante commence directement avec lui. */
const LOGO_KEY = 'abt-logo'
/** Déjà vu dans cet onglet : la révélation passe plus vite. */
const SEEN_KEY = 'abt-intro-vue'
/** Au-delà, on montre quand même le site (connexion très lente). */
const FAILSAFE = 25000
const SLOW_HINT = 7000
/** Attente maximale du démarrage 3D avant de lancer le verre (connexion lente, 3D indisponible…). */
const BOOT_WAIT = 3000

const store = {
  get(storage: 'local' | 'session', key: string) {
    try {
      return (storage === 'local' ? localStorage : sessionStorage).getItem(key)
    } catch {
      return null
    }
  },
  set(storage: 'local' | 'session', key: string, value: string) {
    try {
      ;(storage === 'local' ? localStorage : sessionStorage).setItem(key, value)
    } catch {
      /* stockage indisponible */
    }
  },
}

// La première image 3D (compilation des shaders) peut bloquer le navigateur un instant :
// on veut que la sortie de l'écran de chargement suive le temps réel, sans « rattrapage » ralenti.
gsap.ticker.lagSmoothing(0)

/**
 * Écran d'arrivée : le logo apparaît derrière une plaque de verre qui le plie en couleurs puis le relâche,
 * le nom et la signature montent, et la façade s'ouvre depuis le centre, comme si l'on traversait le verre.
 */
export function Preloader({ loaded }: { loaded: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  const counter = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const footer = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const progress = useRef({ v: 0 })
  const leaving = useRef(false)
  const site = useSite((s) => s.settings)
  const siteLoaded = useSite((s) => s.loaded)
  const [speed] = useState(() => (store.get('session', SEEN_KEY) ? 1.5 : 1))
  // logo du verre : celui de l'espace pro (en cache ou dès qu'il arrive), sinon le symbole AB-TECH
  const [logo, setLogo] = useState<string | null>(() => {
    const cached = store.get('local', LOGO_KEY)
    return cached === null ? null : cached ? thumbUrl(cached, 640) : MARK
  })
  const [titled, setTitled] = useState(false)
  const [ended, setEnded] = useState(false)
  // Le verre attend la fin des étapes lourdes du démarrage 3D (BOOT_WAIT au plus) : il se joue ensuite d'une
  // traite, sans à-coup. Pendant ce temps, l'écran reste calme (barre de progression).
  const [started, setStarted] = useState(() => boot.done())
  useEffect(() => {
    if (started) return
    const off = boot.subscribe(() => setStarted(true))
    const id = setTimeout(() => setStarted(true), BOOT_WAIT)
    return () => {
      off()
      clearTimeout(id)
    }
  }, [started])
  const [gone, setGone] = useState(false)
  const [forced, setForced] = useState(false)
  const [slow, setSlow] = useState(false)

  // le compteur suit la valeur animée ; la barre, elle, glisse par une transition CSS (animée par le compositeur
  // du navigateur : elle reste fluide même quand la page prépare la 3D)
  const render = () => {
    if (counter.current) counter.current.textContent = `${Math.round(progress.current.v)} %`
  }
  const barTo = (v: number, seconds: number) => {
    if (!bar.current) return
    bar.current.style.transitionDuration = `${seconds}s`
    bar.current.style.transform = `scaleX(${v / 100})`
  }

  // première visite : on attend un court instant le logo de l'espace pro avant de lancer le verre
  useEffect(() => {
    if (siteLoaded) store.set('local', LOGO_KEY, site.logo)
    if (logo !== null) return
    if (siteLoaded) return setLogo(site.logo ? thumbUrl(site.logo, 640) : MARK)
    const id = setTimeout(() => setLogo((l) => l ?? MARK), 700)
    return () => clearTimeout(id)
  }, [siteLoaded, site.logo, logo])

  useEffect(() => {
    lockScroll(true)
    // la barre suit le vrai téléchargement de la façade (les 6 derniers % : sa première image)
    const follow = (p: number) => {
      if (leaving.current) return
      barTo(6 + p * 88, 0.6)
      gsap.to(progress.current, { v: 6 + p * 88, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: render })
    }
    follow(loading.get())
    const off = loading.subscribe(follow)
    const hint = setTimeout(() => setSlow(true), SLOW_HINT)
    const failsafe = setTimeout(() => setForced(true), FAILSAFE)
    // le verre ne doit jamais retenir le site (logo illisible, carte graphique perdue…)
    const glassSafe = setTimeout(() => setEnded(true), 9000)
    return () => {
      off()
      gsap.killTweensOf(progress.current)
      clearTimeout(hint)
      clearTimeout(failsafe)
      clearTimeout(glassSafe)
    }
  }, [])

  useEffect(() => {
    if (!((loaded && ended) || forced)) return
    if (!root.current) return
    leaving.current = true
    gsap.killTweensOf(progress.current)
    store.set('session', SEEN_KEY, '1')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    barTo(100, 0.3)
    const tl = gsap
      .timeline({ onComplete: () => setGone(true) })
      .to(progress.current, { v: 100, duration: 0.3, ease: 'power2.out', onUpdate: render })
      .to([caption.current, footer.current], { opacity: 0, y: -8, duration: 0.3, ease: 'power2.in' }, '+=0.15')
      .add(() => {
        useApp.getState().setReady(true)
        lockScroll(false)
      })
    // la façade apparaît par une ouverture ronde qui part du logo et s'élargit jusqu'aux bords
    if (reduce) tl.to(root.current, { opacity: 0, duration: 0.5, ease: 'power2.inOut' })
    else tl.to(root.current, { '--iris': 1, duration: 1.05, ease: 'power3.inOut' }, '-=0.05')
    return () => {
      tl.kill()
    }
  }, [loaded, ended, forced])

  if (gone) return null

  return (
    <div
      ref={root}
      className="preloader-iris fixed inset-0 z-[100] flex items-center justify-center overflow-hidden text-ink"
      style={{ background: BACKDROP, '--iris': 0 } as CSSProperties}
      role="status"
      aria-label={`Chargement — ${site.name}`}
    >
      <div className="relative grid size-[min(560px,100vw,80svh)] place-items-center">
        {logo && (
          <GlassIconReveal
            logo={logo}
            look="light"
            background={BACKDROP}
            originalColors
            loop={false}
            speed={speed}
            paused={!started}
            tuning={TUNING}
            label={site.name}
            className="absolute inset-0 cursor-default"
            cueAt={TITLE_AT}
            onCue={() => setTitled(true)}
            onEnd={() => setEnded(true)}
          />
        )}
        {/* le nom et la signature montent quand le verre relâche le logo */}
        {/* sous le logo : sa demi-hauteur finale vaut 0,137 × la taille du verre (plafonnée par la tuile de 256 px) */}
        <div ref={caption} className="pointer-events-none absolute inset-x-0 top-[calc(50%+min(448px,100vw,80svh)*0.137+22px)] flex flex-col items-center gap-3 px-6 text-center">
          {logo === MARK && (
            <span className="split-line">
              <span className={`split-word ${titled ? 'preloader-in' : ''}`}>
                <Wordmark className="text-[clamp(2.3rem,7vw,3.4rem)]" />
              </span>
            </span>
          )}
          <p className={`preloader-fade text-[14.5px] font-medium text-ink/55 ${titled ? 'is-in' : ''}`} style={{ transitionDelay: logo === MARK ? '220ms' : '0ms' }}>
            {site.tagline}
          </p>
        </div>
      </div>

      <div ref={footer} className="absolute inset-x-0 bottom-[max(2.5rem,6svh)] mx-auto w-[min(300px,72vw)]">
        <div className="h-1 overflow-hidden rounded-full bg-ink/[0.08]">
          <div
            ref={bar}
            className="h-full origin-left rounded-full bg-gradient-to-r from-accent to-accent-2"
            style={{ transform: 'scaleX(0)', transitionProperty: 'transform', transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </div>
        <p className="mt-3 flex justify-between text-[12.5px] font-semibold text-ink/45">
          <span>{slow ? 'Connexion lente, l’atelier arrive…' : 'Ouverture de l’atelier…'}</span>
          <span ref={counter} className="tabular-nums">
            0 %
          </span>
        </p>
      </div>

      <style>{`
        .preloader-iris {
          -webkit-mask-image: radial-gradient(circle at 50% 50%, transparent calc(var(--iris) * 82vmax - 140px), #000 calc(var(--iris) * 82vmax));
          mask-image: radial-gradient(circle at 50% 50%, transparent calc(var(--iris) * 82vmax - 140px), #000 calc(var(--iris) * 82vmax));
        }
        .preloader-in { transform: translateY(0); transition-duration: .9s; }
        .preloader-fade { opacity: 0; transform: translateY(10px); transition: opacity .7s var(--ease-expo), transform .7s var(--ease-expo); }
        .preloader-fade.is-in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          .preloader-fade, .preloader-in { transition: none !important; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}
