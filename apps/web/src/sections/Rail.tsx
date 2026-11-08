import type { Product } from '@atelier/shared'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ClothingRailHero, type ClothingRailDetailTheme, type ClothingRailHeroLabels } from '../components/ui/product-rail-gallery'
import { useCart } from '../lib/cart'
import { RAIL_MODELS, useRailGarments } from '../lib/rail'
import { lockScroll, scrollToElement } from '../lib/scroll'
import { useSection, useSite } from '../lib/site'
import { useApp } from '../lib/store'
import { useReveal } from '../ui/hooks'
import { ArrowRight, CheckIcon, Kicker, SplitTitle } from '../ui/primitives'

const LABELS: ClothingRailHeroLabels = { front: 'Devant', back: 'Dos', close: 'Fermer', show: 'Voir', prev: 'Pièces précédentes', next: 'Pièces suivantes' }

/* ------------------------------------------------------------------ */
/* Ambiances du portant                                                */
/* ------------------------------------------------------------------ */

type SceneId = 'boutique' | 'nuit' | 'atelier'

interface Scene {
  label: string
  /** Fond de la section. */
  bg: string
  /** Jetons de couleur du composant (barre, étiquettes, légende). */
  vars: CSSProperties
  dark: boolean
  /** Grand nom en filigrane derrière le portant. */
  word: string
}

const SCENES: Record<SceneId, Scene> = {
  boutique: {
    label: 'Boutique',
    bg: 'radial-gradient(ellipse 80% 60% at 50% 0%, #ffffff, #e7eef8 70%)',
    vars: {},
    dark: false,
    word: 'linear-gradient(180deg, rgba(10,16,32,.075), rgba(10,16,32,.02))',
  },
  nuit: {
    label: 'Nuit',
    bg: 'radial-gradient(60% 55% at 16% 96%, rgba(217,70,239,.42), transparent 70%), radial-gradient(55% 60% at 86% 92%, rgba(37,99,235,.6), transparent 70%), linear-gradient(180deg, #060a1a, #0b1230 62%, #0a0f26)',
    vars: {
      '--color-foreground': '#eef3fb',
      '--color-muted-foreground': '#a3aecb',
      '--color-card': '#131c38',
      '--color-card-foreground': '#eef3fb',
      '--color-border': 'rgba(255,255,255,.16)',
      '--color-ring': '#7cb4ff',
    } as CSSProperties,
    dark: true,
    word: 'linear-gradient(90deg, rgba(217,70,239,.34), rgba(59,130,246,.34))',
  },
  atelier: {
    label: 'Atelier',
    bg: 'radial-gradient(42% 52% at 10% 100%, rgba(251,146,60,.5), transparent 72%), radial-gradient(42% 52% at 92% 100%, rgba(134,239,172,.6), transparent 72%), linear-gradient(180deg, #fdf6f0, #f7e9df)',
    vars: { '--color-muted-foreground': '#8a6f60', '--color-card': '#fffaf6' } as CSSProperties,
    dark: false,
    word: 'linear-gradient(180deg, rgba(120,72,40,.1), rgba(120,72,40,.03))',
  },
}
const SCENE_IDS = Object.keys(SCENES) as SceneId[]
const STORAGE = 'abtech-portant-ambiance'

/** Vue détaillée : toujours une scène sombre et feutrée, la pièce éclairée au centre. */
const DETAIL: ClothingRailDetailTheme = {
  backdrop: 'radial-gradient(70% 62% at 50% 36%, #1a2a52 0%, #0c1429 52%, #060a17 100%)',
  style: {
    '--color-foreground': '#eef3fb',
    '--color-muted-foreground': '#a3aecb',
    '--color-border': 'rgba(255,255,255,.16)',
    '--color-ring': '#7cb4ff',
    '--detail-glow': 'rgba(110,150,255,.3)',
    '--detail-accent': '#8cc0ff',
  } as CSSProperties,
}

function initialScene(): SceneId {
  try {
    const saved = localStorage.getItem(STORAGE)
    if (saved && saved in SCENES) return saved as SceneId
  } catch {
    // stockage indisponible (navigation privée) : ambiance selon l'heure
  }
  return useApp.getState().mood === 'night' ? 'nuit' : 'boutique'
}

/* ------------------------------------------------------------------ */

function DetailActions({ product }: { product: Product }) {
  const add = useCart((s) => s.add)
  const [added, setAdded] = useState(false)
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
      <button
        type="button"
        disabled={product.stock === 'rupture'}
        onClick={() => (add(product.id), setAdded(true))}
        className="btn h-11 bg-accent px-5 text-[14px] text-white hover:bg-white hover:text-ink disabled:opacity-40"
      >
        {added ? (
          <>
            <CheckIcon className="size-4" /> Ajouté au panier
          </>
        ) : (
          'Ajouter au panier'
        )}
      </button>
      <button
        type="button"
        onClick={() => useApp.getState().open({ type: 'product', id: product.id })}
        className="btn h-11 bg-white/10 px-5 text-[14px] text-white ring-1 ring-white/20 hover:bg-white/20"
      >
        Voir la fiche
      </button>
    </div>
  )
}

/**
 * Le portant de la boutique : tous les T-shirts, polos, sweats et pulls de l'espace pro, sur un vrai portant.
 * On survole une pièce pour la tourner vers soi, on fait défiler les cintres, on la décroche pour la voir en grand.
 */
export function RailSection() {
  const all = useSite((s) => s.products)
  const products = useMemo(() => all.filter((p) => p.station === 'textile' && RAIL_MODELS.includes(p.model)), [all])
  // monté seulement quand les produits sont là (l'apparition au défilement observe la section dès son montage)
  return products.length > 0 ? <Rail products={products} /> : null
}

function Rail({ products }: { products: Product[] }) {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref, 0.08)
  const t = useSection('portant')
  const items = useRailGarments(products)
  const [scene, setScene] = useState<SceneId>(initialScene)
  // ambiance qui s'ouvre en cercle depuis le bouton choisi, par-dessus l'actuelle
  const [reveal, setReveal] = useState<{ id: SceneId; x: number; y: number } | null>(null)
  const layer = useRef<HTMLDivElement>(null)
  const current = SCENES[scene]

  const pick = (id: SceneId, from: HTMLElement) => {
    if (id === scene || reveal) return
    const section = ref.current
    if (!section) return
    const a = from.getBoundingClientRect()
    const b = section.getBoundingClientRect()
    setReveal({ id, x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top })
    try {
      localStorage.setItem(STORAGE, id)
    } catch {
      // sans stockage : le choix vaut pour la visite
    }
  }

  useEffect(() => {
    const el = layer.current
    if (!reveal || !el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const at = `${reveal.x}px ${reveal.y}px`
    const anim = el.animate([{ clipPath: `circle(0px at ${at})` }, { clipPath: `circle(150% at ${at})` }], {
      duration: reduced ? 1 : 1100,
      easing: 'cubic-bezier(.65,0,.25,1)',
      fill: 'forwards',
    })
    // les couleurs du portant basculent à mi-chemin, quand le cercle couvre déjà le portant
    const swap = window.setTimeout(() => setScene(reveal.id), reduced ? 0 : 420)
    anim.onfinish = () => setReveal(null)
    return () => {
      window.clearTimeout(swap)
      anim.cancel()
    }
  }, [reveal])

  return (
    <section
      id="portant"
      ref={ref}
      // classe fixe : useReveal y ajoute la sienne (changer className l'effacerait) ; la couleur passe par le style
      className="relative isolate overflow-hidden transition-colors duration-700"
      style={{ background: current.bg, color: current.dark ? '#f6f8fc' : '#0a1020', ...current.vars }}
    >
      {reveal && <div ref={layer} aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: SCENES[reveal.id].bg, clipPath: 'circle(0px at 0 0)' }} />}
      {/* grand nom en filigrane, comme une enseigne peinte au mur de la boutique */}
      <p
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[9%] -z-10 select-none text-center font-display text-[clamp(6rem,21vw,20rem)] leading-none tracking-[-0.05em] text-transparent [-webkit-background-clip:text] [background-clip:text]"
        style={{ backgroundImage: current.word }}
      >
        AB-TECH
      </p>

      <div className="mx-auto max-w-7xl px-5 pt-24 md:px-10 md:pt-28">
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <Kicker className="fade-up opacity-60">
              <span className="text-accent">●</span> {t.kicker}
            </Kicker>
            <SplitTitle lines={t.title} className="mt-5 font-display text-[clamp(2.46rem,5.38vw,5.04rem)] leading-[0.92]" />
          </div>
          {t.text && (
            <p className="fade-up text-[15.5px] leading-relaxed opacity-70 md:col-span-4" style={{ '--d': '300ms' } as CSSProperties}>
              {t.text}
            </p>
          )}
        </div>
      </div>
      <ClothingRailHero
        aria-label="Le portant : T-shirts, polos, sweats et pulls"
        // fond transparent et sans le dégradé décoratif du composant : il se fond dans l'ambiance de la section
        className="fade-up mt-6 !bg-transparent pb-10 [&>div[aria-hidden='true']]:hidden"
        items={items}
        autoplay
        interval={2800}
        hanger="wood"
        labels={LABELS}
        caption={`${items.length} pièces · survolez, glissez ou touchez`}
        detailTheme={DETAIL}
        onOpenChange={(index) => lockScroll(index !== null)}
        detailAction={(_, index) => (products[index] ? <DetailActions product={products[index]} /> : null)}
        action={
          <div className="flex flex-col items-center gap-5">
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => useApp.getState().open({ type: 'catalogue', tab: 'produits', station: 'textile' })}
                className={`btn h-11 px-5 text-[14px] ${current.dark ? 'bg-white text-ink hover:bg-accent hover:text-white' : 'btn-ink'}`}
              >
                Tout le textile <ArrowRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToElement('#studio')}
                className={`btn h-11 px-5 text-[14px] ${current.dark ? 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20' : 'btn-ghost'}`}
              >
                Essayer avec mon logo
              </button>
            </div>
            <div role="group" aria-label="Ambiance du portant" className="flex flex-wrap items-center justify-center gap-2">
              <span className="kicker mr-1 opacity-50">Ambiance</span>
              {SCENE_IDS.map((id) => {
                const on = id === scene
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={(e) => pick(id, e.currentTarget)}
                    className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold ring-1 transition-colors ${
                      on
                        ? current.dark
                          ? 'bg-white text-ink ring-white'
                          : 'bg-ink text-white ring-ink'
                        : current.dark
                          ? 'text-white/80 ring-white/25 hover:bg-white/10'
                          : 'text-ink/70 ring-ink/15 hover:bg-ink/5'
                    }`}
                  >
                    <span className="size-2 rounded-full" style={{ background: id === 'nuit' ? '#6d5cff' : id === 'atelier' ? '#fb923c' : '#2563eb' }} />
                    {SCENES[id].label}
                  </button>
                )
              })}
            </div>
          </div>
        }
      />
    </section>
  )
}
