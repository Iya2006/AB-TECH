import type { Customization, ProductKind, Wearer } from '@atelier/shared'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { WebGLRenderer } from 'three'
import { BRAND } from '../config/brand'
import { CARD_STYLES, cardRef } from '../lib/cards'
import { PHOTO, STUDIO_BG, tint, type PhotoModel } from '../lib/mockup/catalog'
import { mockupCanvas, type MockupBase, type PrintSpec } from '../lib/mockup/engine'
import { MockupView } from '../lib/mockup/MockupView'
import { FONT } from '../lib/print'
import { scrollToElement } from '../lib/scroll'
import { useSection } from '../lib/site'
import { useApp } from '../lib/store'
import { useInView, useReveal } from '../ui/hooks'
import { ArrowRight, CheckIcon, CloseIcon, Kicker, SplitTitle, UploadIcon } from '../ui/primitives'

/* ------------------------------------------------------------------ */
/* Données                                                             */
/* ------------------------------------------------------------------ */

type Swatch = { c: string; n: string }
const S = {
  blanc: { c: '#f5f3ee', n: 'Blanc' },
  noir: { c: '#17171a', n: 'Noir' },
  marine: { c: '#1f2a44', n: 'Bleu marine' },
  bleu: { c: '#2563eb', n: 'Bleu roi' },
  rouge: { c: '#b3262e', n: 'Rouge' },
  sable: { c: '#d9c9a8', n: 'Sable' },
  vert: { c: '#2f5d50', n: 'Vert forêt' },
  gris: { c: '#9aa0a8', n: 'Gris chiné' },
  bordeaux: { c: '#6b1f2a', n: 'Bordeaux' },
  kaki: { c: '#5b6b3a', n: 'Kaki' },
  naturel: { c: '#ece3cf', n: 'Naturel' },
  creme: { c: '#f7f5f0', n: 'Blanc' },
} satisfies Record<string, Swatch>

type Garment = Exclude<ProductKind, 'carte'>
type Place = { x: number; y: number; s: number }
type Preset = { id: string; label: string; place: Place }

const CENTER: Place = { x: 0.5, y: 0.45, s: 0.72 }
const TEXTILE_PRESETS: Preset[] = [
  { id: 'coeur', label: 'Cœur', place: { x: 0.73, y: 0.24, s: 0.34 } },
  { id: 'centre', label: 'Centre poitrine', place: CENTER },
  { id: 'grand', label: 'Grand format', place: { x: 0.5, y: 0.5, s: 1 } },
]

const PRODUCTS: Record<Garment, { label: string; service: string; colors: Swatch[]; techniques: string[]; sizes: string[]; presets: Preset[] }> = {
  tshirt: {
    label: 'T-shirt',
    service: 'textile',
    colors: [S.blanc, S.noir, S.marine, S.bleu, S.rouge, S.sable, S.vert],
    techniques: ['Sérigraphie', 'Broderie', 'Transfert numérique', 'Flex'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    presets: TEXTILE_PRESETS,
  },
  polo: {
    label: 'Polo',
    service: 'textile',
    colors: [S.blanc, S.marine, S.noir, S.bleu, S.rouge, S.vert],
    techniques: ['Broderie', 'Sérigraphie', 'Transfert numérique', 'Flex'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    presets: TEXTILE_PRESETS,
  },
  sweat: {
    label: 'Sweat',
    service: 'textile',
    colors: [S.blanc, S.noir, S.gris, S.marine, S.bordeaux, S.sable],
    techniques: ['Sérigraphie', 'Broderie', 'Transfert numérique', 'Flex'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    presets: TEXTILE_PRESETS,
  },
  casquette: {
    label: 'Casquette',
    service: 'casquettes',
    colors: [S.blanc, S.noir, S.marine, S.rouge, S.sable, S.kaki],
    techniques: ['Broderie', 'Transfert numérique'],
    sizes: ['Taille unique'],
    presets: [
      { id: 'centre', label: 'Face avant', place: { x: 0.5, y: 0.5, s: 0.82 } },
      { id: 'petit', label: 'Discret', place: { x: 0.5, y: 0.55, s: 0.5 } },
    ],
  },
  mug: {
    label: 'Mug',
    service: 'objets-cadeaux',
    colors: [S.creme, S.noir, S.marine, S.rouge],
    techniques: ['Sublimation', 'Transfert numérique'],
    sizes: ['Quantité'],
    presets: [
      { id: 'centre', label: 'Centre', place: { x: 0.5, y: 0.5, s: 0.8 } },
      { id: 'grand', label: 'Grand', place: { x: 0.5, y: 0.5, s: 1 } },
    ],
  },
  tote: {
    label: 'Tote bag',
    service: 'sacs-accessoires',
    colors: [S.naturel, S.noir, S.marine, S.vert],
    techniques: ['Sérigraphie', 'Transfert numérique', 'Broderie'],
    sizes: ['Quantité'],
    presets: [
      { id: 'centre', label: 'Centre', place: { x: 0.5, y: 0.45, s: 0.75 } },
      { id: 'grand', label: 'Grand format', place: { x: 0.5, y: 0.5, s: 1 } },
      { id: 'bas', label: 'En bas', place: { x: 0.5, y: 0.74, s: 0.48 } },
    ],
  },
}
const KINDS: ProductKind[] = ['tshirt', 'polo', 'sweat', 'casquette', 'mug', 'tote', 'carte']
const LABEL = (k: ProductKind) => (k === 'carte' ? 'Carte de visite' : PRODUCTS[k].label)
const KIND_ICON: Record<ProductKind, string> = {
  tshirt: 'M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3c-.5 1.6-2 2.6-4 2.6S8.5 4.6 8 3Z',
  polo: 'M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3-2 3-2-3-2 3-2-3Zm4 3v5',
  sweat: 'M8 4 3 7l1 12h3V10v11h10V10v9h3l1-12-5-3c0 2-2 3.5-4 3.5S8 6 8 4Zm2 9h4',
  casquette: 'M3 15c0-5 4-9 9-9s9 4 9 9H3Zm9 0h9c1.5 0 2 1.5 1 2.5L20 19H12',
  mug: 'M5 6h11v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6Zm11 3h2a2 2 0 0 1 0 4h-2',
  tote: 'M5 9h14l-1 12H6L5 9Zm4 0V7a3 3 0 0 1 6 0v2',
  carte: 'M3 6h18v12H3zM6 10h6M6 13h4M15 10h3',
}

const TECH_NOTE: Record<string, string> = {
  Sérigraphie: 'Encre posée au cadre : couleurs franches, idéale en série.',
  Broderie: 'Fils cousus : rendu haut de gamme, très résistant.',
  'Transfert numérique': 'Toutes les couleurs, dégradés et photos.',
  Flex: 'Lettrage découpé : noms, numéros, textes courts.',
  Sublimation: 'Impression dans la matière : couleurs vives, lavable.',
}
const ADVICE = 'Conseillez-moi'

const CAP_STYLES: Array<{ model: PhotoModel; label: string }> = [
  { model: 'casquette', label: 'Classique' },
  { model: 'snapback', label: 'Visière plate' },
  { model: 'trucker', label: 'Trucker (filet)' },
]

const WEARERS: Array<{ id: Wearer; label: string }> = [
  { id: 'homme', label: 'Homme' },
  { id: 'femme', label: 'Femme' },
  { id: 'seul', label: 'Produit seul' },
]

const INKS = [
  { c: '#0e0e10', n: 'Noir' },
  { c: '#ffffff', n: 'Blanc' },
  { c: '#2563eb', n: 'Bleu' },
  { c: '#e5007d', n: 'Magenta' },
  { c: '#ffd400', n: 'Jaune' },
  { c: '#c8a24a', n: 'Or' },
]

const FONTS: Array<{ id: string; label: string; family: string; weight: number; load: string }> = [
  { id: 'moderne', label: 'Moderne', family: FONT.display, weight: 800, load: '800 40px "Plus Jakarta Sans Variable"' },
  { id: 'neutre', label: 'Neutre', family: FONT.sans, weight: 600, load: '600 40px "Inter Tight Variable"' },
  { id: 'elegant', label: 'Élégant', family: '"Instrument Serif", Georgia, serif', weight: 400, load: '400 40px "Instrument Serif"' },
  { id: 'technique', label: 'Technique', family: FONT.mono, weight: 600, load: '600 40px "JetBrains Mono Variable"' },
]

const CARD_QTY = [100, 250, 500, 1000]
const MAX_LOGO = 5 * 1024 * 1024
const STORAGE = 'abtech-studio-v2'

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}
/** Encre lisible sur le support : si le contraste est trop faible, on bascule noir ↔ blanc. */
const readableInk = (base: string, ink: string) => (Math.abs(lum(base) - lum(ink)) > 0.3 ? ink : lum(base) > 0.5 ? '#0e0e10' : '#ffffff')
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** Le visuel reste entièrement dans la zone d'impression. */
const fitPlace = (p: Place): Place => {
  const s = clamp(p.s, 0.2, 1)
  return { s, x: clamp(p.x, s / 2, 1 - s / 2), y: clamp(p.y, s / 2, 1 - s / 2) }
}

interface Logo {
  file: File
  image: ImageBitmap
  preview: string
}

/** Création en cours, gardée d'une visite à l'autre (sauf le fichier du logo). */
interface Saved {
  kind: ProductKind
  base: string
  ink: string
  text: string
  sub: string
  font: string
  place: Place
  presetId: string
  technique: string
  qty: Record<string, number>
}

function loadSaved(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? '{}') as Partial<Saved>
  } catch {
    return {}
  }
}

const CardStudio3D = lazy(() => import('./CardStudio3D'))

/* ------------------------------------------------------------------ */
/* Petits éléments                                                     */
/* ------------------------------------------------------------------ */

function SwatchButton({ color, label, selected, onClick }: { color: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={`relative size-9 rounded-full ring-1 ring-ink/15 transition-transform duration-300 hover:scale-110 ${selected ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-white' : ''}`}
      style={{ background: color }}
    />
  )
}

function Segmented<T extends string>({ label, items, value, onChange, disabled }: { label: string; items: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void; disabled?: (id: T) => boolean }) {
  return (
    <div className="flex rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-ink/10" role="radiogroup" aria-label={label}>
      {items.map((it) => {
        const off = disabled?.(it.id)
        return (
          <button
            key={it.id}
            role="radio"
            aria-checked={value === it.id}
            disabled={off}
            onClick={() => onChange(it.id)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${value === it.id ? 'bg-ink text-paper' : 'text-ink/70 hover:text-ink'}`}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="kicker text-ink/55">{label}</span>
        {hint && <span className="text-[12px] text-ink/45">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-2 ring-1 ring-ink/[0.08]">
      <span className="text-[12.5px] font-bold text-ink/70">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="grid size-7 place-items-center rounded-full bg-ink/[0.06] text-ink hover:bg-ink/10" aria-label={`Retirer une pièce ${label}`}>
          −
        </button>
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(clamp(parseInt(e.target.value.replace(/\D/g, '') || '0', 10), 0, 9999))}
          className="w-10 bg-transparent text-center font-mono text-[14px] font-semibold outline-none"
          aria-label={`Quantité ${label}`}
        />
        <button type="button" onClick={() => onChange(Math.min(9999, value + 1))} className="grid size-7 place-items-center rounded-full bg-ink text-white hover:bg-accent" aria-label={`Ajouter une pièce ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

/* ------------------------------------------------------------------ */
/* Zone d'impression : le visuel se déplace et s'agrandit sur la photo */
/* ------------------------------------------------------------------ */

/** Rectangle de la photo affichée dans son cadre (object-fit cover ou contain, marges comprises). */
function imageBox(el: HTMLElement, base: MockupBase, fit: 'cover' | 'contain') {
  const cs = getComputedStyle(el)
  const pl = parseFloat(cs.paddingLeft) || 0
  const pr = parseFloat(cs.paddingRight) || 0
  const pt = parseFloat(cs.paddingTop) || 0
  const pb = parseFloat(cs.paddingBottom) || 0
  const cw = el.clientWidth - pl - pr
  const ch = el.clientHeight - pt - pb
  const k = fit === 'cover' ? Math.max(cw / base.width, ch / base.height) : Math.min(cw / base.width, ch / base.height)
  const w = base.width * k
  const h = base.height * k
  return { x: pl + (cw - w) / 2, y: pt + (ch - h) / 2, w, h }
}

function PrintZone({ base, fit, canvas, place, onPlace, zoom, active }: { base: MockupBase; fit: 'cover' | 'contain'; canvas: HTMLCanvasElement | null; place: Place; onPlace: (p: Place) => void; zoom: number; active: boolean }) {
  const [zone, setZone] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    if (!canvas) return
    const measure = () => {
      const r = imageBox(canvas, base, fit)
      const a = base.print
      setZone({ x: r.x + a.x * r.w, y: r.y + a.y * r.h, w: a.w * r.w, h: a.h * r.h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [canvas, base, fit])

  const drag = useRef<{ mode: 'move' | 'size'; x: number; y: number; start: Place } | null>(null)
  if (!zone) return null
  const down = (mode: 'move' | 'size') => (e: ReactPointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, x: e.clientX, y: e.clientY, start: place }
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.x) / zoom / zone.w
    const dy = (e.clientY - d.y) / zoom / zone.h
    onPlace(fitPlace(d.mode === 'move' ? { ...d.start, x: d.start.x + dx, y: d.start.y + dy } : { ...d.start, s: d.start.s + (dx + dy) }))
  }
  const up = () => (drag.current = null)
  const rotate = base.print.rotate ? `rotate(${base.print.rotate}rad)` : undefined
  const bw = place.s * zone.w
  const bh = place.s * zone.h

  return (
    <div className="pointer-events-none absolute" style={{ left: zone.x, top: zone.y, width: zone.w, height: zone.h, transform: rotate }}>
      {/* contour de la zone imprimable */}
      <div className={`absolute inset-0 rounded-md border border-dashed transition-opacity duration-300 ${active ? 'border-accent/70 opacity-100' : 'border-ink/30 opacity-0 group-hover/stage:opacity-100'}`} />
      {/* le visuel : on le fait glisser, la poignée l'agrandit */}
      <div
        className={`pointer-events-auto absolute cursor-grab touch-none rounded-sm outline-1 outline-accent transition-[outline-color] active:cursor-grabbing ${active ? 'outline' : 'outline-transparent hover:outline'}`}
        style={{ left: place.x * zone.w - bw / 2, top: place.y * zone.h - bh / 2, width: bw, height: bh }}
        onPointerDown={down('move')}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label="Déplacer le visuel"
        role="presentation"
      >
        <span
          className={`absolute -bottom-2 -right-2 size-4 cursor-nwse-resize rounded-full border-2 border-white bg-accent shadow transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
          onPointerDown={down('size')}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

type Tab = 'visuel' | 'couleurs' | 'commande'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'visuel', label: '1 · Visuel' },
  { id: 'couleurs', label: '2 · Couleurs' },
  { id: 'commande', label: '3 · Commande' },
]

export function Studio() {
  const section = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  useReveal(section, 0.1)
  const t = useSection('studio')
  const near = useInView(stage, '400px')
  const visible = useInView(stage, '0px')
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (near) setMounted(true)
  }, [near])

  const saved = useMemo(loadSaved, [])
  const [kind, setKind] = useState<ProductKind>(saved.kind && KINDS.includes(saved.kind) ? saved.kind : 'tshirt')
  const [capStyle, setCapStyle] = useState<PhotoModel>('casquette')
  const [wearer, setWearer] = useState<Wearer>('homme')
  const [base, setBase] = useState(saved.base ?? PRODUCTS.tshirt.colors[0]!.c)
  const [ink, setInk] = useState(saved.ink ?? '#0e0e10')
  const [text, setText] = useState(saved.text ?? BRAND.name)
  const [sub, setSub] = useState(saved.sub ?? '')
  const [fontId, setFontId] = useState(saved.font && FONTS.some((f) => f.id === saved.font) ? saved.font : 'moderne')
  const [place, setPlace] = useState<Place>(saved.place ? fitPlace(saved.place) : CENTER)
  const [presetId, setPresetId] = useState(saved.presetId ?? 'centre')
  const [technique, setTechnique] = useState(saved.technique ?? ADVICE)
  const [qty, setQty] = useState<Record<string, number>>(saved.qty ?? {})
  const [logo, setLogo] = useState<Logo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attached, setAttached] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('visuel')
  const [zoom, setZoom] = useState(false)
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const setPrefill = useApp((s) => s.setPrefill)

  // Carte de visite
  const [cardIndex, setCardIndex] = useState(0)
  const [side, setSide] = useState<'recto' | 'verso'>('recto')
  const [card, setCard] = useState({ name: 'Votre nom', title: 'Fonction', phone: BRAND.phones[0] ?? '', email: BRAND.email })
  const drag = useRef(0)
  const gl = useRef<WebGLRenderer | null>(null)

  useEffect(() => () => {
    if (logo) URL.revokeObjectURL(logo.preview)
  }, [logo])

  // la création est gardée pour la prochaine visite
  useEffect(() => {
    try {
      const data: Saved = { kind, base, ink, text, sub, font: fontId, place, presetId, technique, qty }
      localStorage.setItem(STORAGE, JSON.stringify(data))
    } catch {
      // stockage indisponible : rien à garder
    }
  }, [kind, base, ink, text, sub, fontId, place, presetId, technique, qty])

  const changed = () => setAttached(false)
  const isCard = kind === 'carte'
  const product = isCard ? null : PRODUCTS[kind]
  const model: PhotoModel | null = isCard ? null : kind === 'casquette' ? capStyle : kind
  const entry = model ? PHOTO[model] : null
  const canWear = !!entry?.homme
  const shownWearer: Wearer = canWear ? wearer : 'seul'
  const mockBase = entry ? (shownWearer === 'seul' ? entry.produit : entry[shownWearer] ?? entry.produit) : null
  const fit = shownWearer === 'seul' ? 'contain' : 'cover'
  const style = CARD_STYLES[cardIndex]!
  const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0]!
  const techniques = product ? [ADVICE, ...product.techniques] : []
  const sizes = isCard ? ['Cartes'] : product!.sizes
  const total = sizes.reduce((n, s) => n + (qty[s] ?? 0), 0)

  const choose = (k: ProductKind) => {
    setKind(k)
    setZoom(false)
    if (k === 'carte') {
      setBase(CARD_STYLES[cardIndex]!.bases[0]!)
      setInk(CARD_STYLES[cardIndex]!.ink)
    } else {
      const p = PRODUCTS[k]
      setBase(p.colors[0]!.c)
      setInk((i) => readableInk(p.colors[0]!.c, i))
      const preset = p.presets.find((x) => x.id === 'centre') ?? p.presets[0]!
      setPlace(preset.place)
      setPresetId(preset.id)
      if (!p.techniques.includes(technique)) setTechnique(ADVICE)
    }
    setQty({})
    changed()
  }
  const chooseBase = (c: string) => {
    setBase(c)
    setInk((i) => readableInk(c, i))
    changed()
  }
  const goCard = (i: number) => {
    const next = (i + CARD_STYLES.length) % CARD_STYLES.length
    setCardIndex(next)
    setBase(CARD_STYLES[next]!.bases[0]!)
    setInk(CARD_STYLES[next]!.ink)
    setSide('recto')
    changed()
  }
  const movePlace = useCallback((p: Place) => {
    setPlace(p)
    setPresetId('perso')
    setAttached(false)
  }, [])
  const pickFont = async (id: string) => {
    const f = FONTS.find((x) => x.id === id)
    if (!f) return
    // la police doit être chargée avant d'être dessinée sur la maquette
    await document.fonts.load(f.load).catch(() => {})
    setFontId(id)
    changed()
  }

  const onFile = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Formats acceptés : PNG, JPG ou WEBP.')
    if (file.size > MAX_LOGO) return setError('Fichier trop lourd (5 Mo maximum).')
    try {
      const image = await createImageBitmap(file)
      setLogo({ file, image, preview: URL.createObjectURL(file) })
      changed()
    } catch {
      setError('Impossible de lire cette image.')
    }
  }

  const print = useMemo<PrintSpec>(
    () => ({
      text,
      sub,
      ink,
      logo: logo?.image ?? null,
      mark: false,
      font: { family: font.family, weight: font.weight },
      place,
      finish: technique === 'Broderie' ? 'broderie' : 'flat',
    }),
    [text, sub, ink, logo, font, place, technique],
  )
  const cardData = useMemo(() => ({ ...card, brand: BRAND.name, logo: logo?.image ?? null }), [card, logo])

  /** Glisser sur la scène des cartes : la carte suit le doigt, puis on passe au style voisin. */
  const pointer = useRef<{ x: number; t: number } | null>(null)
  const onDown = (e: ReactPointerEvent) => {
    // les boutons posés sur la scène (flèches, recto/verso) gardent leur clic
    if ((e.target as HTMLElement).closest('button')) return
    pointer.current = { x: e.clientX, t: performance.now() }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!pointer.current || !stage.current) return
    drag.current = -(e.clientX - pointer.current.x) / (stage.current.clientWidth * 0.45)
  }
  const onUp = (e: ReactPointerEvent) => {
    if (!pointer.current) return
    const dx = e.clientX - pointer.current.x
    const d = drag.current
    pointer.current = null
    drag.current = 0
    if (Math.abs(dx) < 6) return setSide((s) => (s === 'recto' ? 'verso' : 'recto'))
    if (Math.abs(d) > 0.22) goCard(cardIndex + Math.sign(d) * Math.max(1, Math.round(Math.abs(d))))
  }

  const capture = async (): Promise<Blob | null> => {
    if (isCard) {
      const r = gl.current
      return r ? new Promise((res) => r.domElement.toBlob(res, 'image/jpeg', 0.9)) : null
    }
    if (!mockBase || !entry) return null
    const c = await mockupCanvas(mockBase, { color: tint(entry, mockBase, base), print, background: STUDIO_BG })
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9))
  }

  const download = async () => {
    const blob = await capture().catch(() => null)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${BRAND.name}-maquette-${LABEL(kind).toLowerCase().replace(/\s+/g, '-')}.jpg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const presetLabel = product?.presets.find((p) => p.id === presetId)?.label ?? `Personnalisé · ${Math.round(place.s * 100)} %`

  const attach = async () => {
    setBusy(true)
    try {
      const blob = await capture().catch(() => null)
      const service = isCard ? 'cartes-de-visite' : product!.service
      const quantities = Object.fromEntries(Object.entries(qty).filter(([k, v]) => v > 0 && sizes.includes(k)))
      const customization: Customization = {
        product: kind,
        text: isCard ? '' : text.trim(),
        baseColor: base,
        inkColor: ink,
        style: isCard ? cardRef(style) : kind === 'casquette' ? CAP_STYLES.find((c) => c.model === capStyle)?.label : undefined,
        wearer: isCard || !canWear ? undefined : shownWearer,
        card: isCard ? card : undefined,
        sub: isCard ? undefined : sub.trim() || undefined,
        font: isCard ? undefined : font.label,
        placement: isCard ? undefined : presetLabel,
        technique: isCard || technique === ADVICE ? undefined : technique,
        quantities: Object.keys(quantities).length ? quantities : undefined,
      }
      setPrefill({ service, customization, mockup: blob ?? undefined, mockupPreview: blob ? URL.createObjectURL(blob) : undefined, logo: logo?.file })
      setAttached(true)
      scrollToElement('#devis')
    } finally {
      setBusy(false)
    }
  }

  const colors = isCard ? style.bases.map((c) => ({ c, n: c })) : product!.colors
  const zoomScale = zoom ? 2 : 1
  const area = mockBase?.print
  // zoom centré sur la zone d'impression
  const zoomOrigin = area ? `${(area.x + area.w / 2) * 100}% ${(area.y + area.h / 2) * 100}%` : '50% 45%'

  return (
    <section id="studio" ref={section} className="relative bg-[radial-gradient(ellipse_90%_60%_at_80%_0%,#eaf1ff,#f6f8fc_60%)] text-ink">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-32">
        <header className="grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Kicker className="fade-up text-ink/55">
              <span className="text-accent">●</span> {t.kicker}
            </Kicker>
            <SplitTitle lines={t.title} className="mt-5 font-display text-[clamp(2.46rem,5.38vw,5.04rem)] leading-[0.92]" />
          </div>
          {t.text && (
            <p className="fade-up text-[15.5px] leading-relaxed text-ink/70 md:col-span-5" style={{ '--d': '300ms' } as CSSProperties}>
              {t.text}
            </p>
          )}
        </header>

        {/* choix du produit */}
        <div role="tablist" aria-label="Produit" className="fade-up mt-12 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" style={{ '--d': '350ms' } as CSSProperties}>
          {KINDS.map((k) => {
            const on = kind === k
            return (
              <button
                key={k}
                role="tab"
                aria-selected={on}
                onClick={() => choose(k)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold ring-1 transition-all duration-300 ${
                  on ? 'bg-ink text-white ring-ink shadow-[0_12px_30px_-14px_rgba(10,16,32,0.7)]' : 'bg-white text-ink/75 ring-ink/10 hover:ring-ink/25'
                }`}
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={KIND_ICON[k]} />
                </svg>
                {LABEL(k)}
              </button>
            )
          })}
        </div>

        <div className="fade-up mt-5 grid gap-6 lg:grid-cols-12" style={{ '--d': '400ms' } as CSSProperties}>
          {/* Aperçu */}
          <div className="lg:col-span-7">
            <div
              ref={stage}
              className="group/stage relative aspect-[4/5] touch-pan-y overflow-hidden rounded-[28px] shadow-[0_40px_80px_-50px_rgba(10,16,32,0.55)] ring-1 ring-ink/[0.06] sm:aspect-[5/5.4]"
              style={{ background: 'radial-gradient(circle at 50% 38%, #f7f9fc, #d9e1ec)' }}
              {...(isCard ? { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp } : {})}
            >
              {!isCard && mockBase && entry && (
                <div className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-expo)]" style={{ transform: `scale(${zoomScale})`, transformOrigin: zoomOrigin }}>
                  <MockupView
                    key={`${kind}-${model}-${shownWearer}`}
                    base={mockBase}
                    color={tint(entry, mockBase, base)}
                    print={print}
                    canvasRef={canvasRef}
                    className={`absolute inset-0 h-full w-full ${fit === 'contain' ? 'object-contain p-[8%]' : 'object-cover'}`}
                  />
                  <CanvasProbe from={canvasRef} onCanvas={setCanvasEl} deps={[kind, model, shownWearer]} />
                  <PrintZone base={mockBase} fit={fit} canvas={canvasEl} place={place} onPlace={movePlace} zoom={zoomScale} active={tab === 'visuel'} />
                </div>
              )}
              {isCard && mounted && (
                <Suspense fallback={null}>
                  <CardStudio3D index={cardIndex} side={side} data={cardData} base={base} ink={ink} drag={drag} active={visible} onGl={(r) => (gl.current = r)} />
                </Suspense>
              )}

              {/* Contrôles posés sur l'aperçu */}
              <div className="absolute inset-x-4 top-4 flex flex-wrap items-start justify-between gap-2">
                {kind === 'casquette' && (
                  <Segmented label="Type de casquette" items={CAP_STYLES.map((c) => ({ id: c.model, label: c.label }))} value={capStyle} onChange={(v) => (setCapStyle(v), changed())} />
                )}
                {!isCard && kind !== 'mug' && kind !== 'tote' && (
                  <Segmented label="Porté par" items={WEARERS} value={shownWearer} onChange={(v) => (setWearer(v), changed())} disabled={(id) => id !== 'seul' && !canWear} />
                )}
                {isCard && <span className="rounded-full bg-white/90 px-4 py-2 font-mono text-[12px] font-semibold tracking-wide shadow-sm ring-1 ring-ink/10">Réf. {style.ref} · {style.label}</span>}
              </div>
              {!isCard && (
                <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Emplacement du marquage">
                    {product!.presets.map((p) => (
                      <button
                        key={p.id}
                        role="radio"
                        aria-checked={presetId === p.id}
                        onClick={() => (setPlace(p.place), setPresetId(p.id), changed())}
                        className={`rounded-full px-3.5 py-2 text-[12.5px] font-semibold shadow-sm ring-1 transition ${presetId === p.id ? 'bg-ink text-white ring-ink' : 'bg-white/95 text-ink/75 ring-ink/10 hover:text-ink'}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setZoom((z) => !z)} className="grid size-10 place-items-center rounded-full bg-white/95 shadow-sm ring-1 ring-ink/10 hover:bg-white" aria-pressed={zoom} aria-label={zoom ? 'Vue d’ensemble' : 'Zoomer sur le marquage'} title={zoom ? 'Vue d’ensemble' : 'Zoomer sur le marquage'}>
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                        <circle cx="11" cy="11" r="6.5" />
                        <path d={zoom ? 'M8 11h6M16 16l4.5 4.5' : 'M8 11h6M11 8v6M16 16l4.5 4.5'} />
                      </svg>
                    </button>
                    <button onClick={download} className="grid size-10 place-items-center rounded-full bg-white/95 shadow-sm ring-1 ring-ink/10 hover:bg-white" aria-label="Télécharger l’aperçu" title="Télécharger l’aperçu">
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              {isCard && (
                <>
                  <button onClick={() => goCard(cardIndex - 1)} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-ink/10 hover:bg-white" aria-label="Style précédent">
                    <Chevron dir="left" />
                  </button>
                  <button onClick={() => goCard(cardIndex + 1)} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow ring-1 ring-ink/10 hover:bg-white" aria-label="Style suivant">
                    <Chevron dir="right" />
                  </button>
                  <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-3">
                    <div className="flex gap-1.5" role="tablist" aria-label="Styles de carte">
                      {CARD_STYLES.map((s, i) => (
                        <button key={s.ref} role="tab" aria-selected={i === cardIndex} aria-label={`${s.ref} ${s.label}`} onClick={() => goCard(i)} className={`h-1.5 rounded-full transition-all ${i === cardIndex ? 'w-6 bg-ink' : 'w-1.5 bg-ink/25'}`} />
                      ))}
                    </div>
                    <button onClick={() => setSide((s) => (s === 'recto' ? 'verso' : 'recto'))} className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper">
                      Voir le {side === 'recto' ? 'verso' : 'recto'}
                    </button>
                  </div>
                </>
              )}
            </div>
            <p className="kicker mt-3 text-ink/45">
              {isCard ? 'Glissez pour changer de style · touchez la carte pour la retourner' : 'Faites glisser le visuel, la poignée bleue l’agrandit · photo réelle, aperçu non contractuel'}
            </p>
          </div>

          {/* Réglages */}
          <div className="flex flex-col rounded-[28px] bg-white/80 p-2 ring-1 ring-ink/[0.07] lg:col-span-5">
            <div role="tablist" aria-label="Étapes" className="grid grid-cols-3 gap-1 rounded-[22px] bg-ink/[0.04] p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-[18px] px-2 py-2.5 text-[13.5px] font-semibold transition ${tab === t.id ? 'bg-white text-ink shadow-sm ring-1 ring-ink/[0.06]' : 'text-ink/55 hover:text-ink'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div key={tab} className="shop-enter flex flex-1 flex-col gap-7 p-4 md:p-6">
              {tab === 'visuel' && (
                <>
                  <Field label="Votre logo" hint="PNG détouré conseillé">
                    {logo ? (
                      <div className="flex items-center gap-4 rounded-2xl bg-paper p-3 ring-1 ring-ink/10">
                        <img src={logo.preview} alt="" className="size-14 rounded-lg bg-[#ebe6da] object-contain p-1" />
                        <span className="min-w-0 flex-1 truncate text-[14px]">{logo.file.name}</span>
                        <button type="button" onClick={() => (setLogo(null), changed())} className="grid size-9 place-items-center rounded-full hover:bg-ink/10" aria-label="Retirer le logo">
                          <CloseIcon className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-ink/25 p-4 transition-colors hover:border-accent hover:bg-accent-soft/40">
                        <span className="grid size-11 place-items-center rounded-full bg-ink text-paper">
                          <UploadIcon className="size-5" />
                        </span>
                        <span className="text-[14px] leading-snug">
                          Importer un fichier
                          <span className="block text-ink/50">JPG, PNG ou WEBP · 5 Mo max</span>
                        </span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
                      </label>
                    )}
                    {error && <p className="mt-2 text-[13px] text-accent">{error}</p>}
                  </Field>

                  {isCard ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(
                        [
                          ['name', 'Nom', 60],
                          ['title', 'Fonction', 60],
                          ['phone', 'Téléphone', 40],
                          ['email', 'E-mail', 80],
                        ] as const
                      ).map(([key, label, max]) => (
                        <label key={key} className="block">
                          <span className="kicker text-ink/55">{label}</span>
                          <input className="field mt-1" value={card[key]} maxLength={max} onChange={(e) => (setCard((c) => ({ ...c, [key]: e.target.value })), changed())} />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4">
                        <label className="block">
                          <span className="kicker text-ink/55">Votre texte</span>
                          <input className="field mt-1 text-2xl font-semibold" style={{ fontFamily: font.family }} value={text} maxLength={24} onChange={(e) => (setText(e.target.value), changed())} placeholder="Nom, marque…" />
                        </label>
                        <label className="block">
                          <span className="kicker text-ink/55">Deuxième ligne (facultatif)</span>
                          <input className="field mt-1" value={sub} maxLength={40} onChange={(e) => (setSub(e.target.value), changed())} placeholder="Slogan, site web, téléphone…" />
                        </label>
                      </div>
                      <Field label="Police">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {FONTS.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => pickFont(f.id)}
                              aria-pressed={fontId === f.id}
                              className={`rounded-2xl px-2 py-2.5 ring-1 transition ${fontId === f.id ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10 hover:ring-ink/30'}`}
                            >
                              <span className="block text-[19px] leading-tight" style={{ fontFamily: f.family, fontWeight: f.weight }}>
                                Aa
                              </span>
                              <span className="mt-0.5 block text-[11.5px] font-semibold opacity-70">{f.label}</span>
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Field label="Taille du marquage" hint={`${Math.round(place.s * 100)} % de la zone`}>
                        <input
                          type="range"
                          min={20}
                          max={100}
                          value={Math.round(place.s * 100)}
                          onChange={(e) => movePlace(fitPlace({ ...place, s: Number(e.target.value) / 100 }))}
                          className="w-full accent-[var(--color-accent)]"
                          aria-label="Taille du marquage"
                        />
                      </Field>
                    </>
                  )}
                </>
              )}

              {tab === 'couleurs' && (
                <>
                  <Field label={isCard ? 'Couleur du papier' : 'Couleur du support'}>
                    <div className="flex flex-wrap gap-3">
                      {colors.map(({ c, n }) => (
                        <SwatchButton key={c} color={c} label={n} selected={base === c} onClick={() => chooseBase(c)} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Couleur d’impression" hint="ajustée si elle ne ressort pas">
                    <div className="flex flex-wrap items-center gap-3">
                      {INKS.map(({ c, n }) => (
                        <SwatchButton key={c} color={c} label={n} selected={ink === c} onClick={() => (setInk(c), changed())} />
                      ))}
                      {/* teinte libre : la couleur exacte de la charte du client */}
                      <label className="relative grid size-9 cursor-pointer place-items-center rounded-full bg-[conic-gradient(#e5007d,#ffd400,#00a0dc,#22c55e,#e5007d)] ring-1 ring-ink/15" title="Autre couleur">
                        <span className="size-4 rounded-full bg-white" />
                        <input type="color" value={ink} onChange={(e) => (setInk(e.target.value), changed())} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Autre couleur d’impression" />
                      </label>
                    </div>
                  </Field>
                  {!isCard && (
                    <p className="rounded-2xl bg-accent-soft/60 p-4 text-[13.5px] leading-relaxed text-ink/70">
                      Votre charte a une couleur précise ? Choisissez-la avec la pastille arc-en-ciel : nous la reproduisons au plus juste et la
                      validons avec vous sur le bon à tirer.
                    </p>
                  )}
                </>
              )}

              {tab === 'commande' && (
                <>
                  {!isCard && (
                    <Field label="Technique souhaitée" hint="confirmée sur le devis">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {techniques.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => (setTechnique(t), changed())}
                            aria-pressed={technique === t}
                            className={`rounded-2xl p-3 text-left ring-1 transition ${technique === t ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10 hover:ring-ink/30'}`}
                          >
                            <span className="block text-[14px] font-semibold">{t}</span>
                            <span className={`mt-0.5 block text-[12px] leading-snug ${technique === t ? 'text-white/70' : 'text-ink/50'}`}>{TECH_NOTE[t] ?? 'L’atelier vous propose la technique la plus adaptée.'}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                  )}
                  <Field label={isCard ? 'Quantité' : sizes.length > 1 ? 'Quantités par taille' : 'Quantité'} hint={total ? `${total} pièce${total > 1 ? 's' : ''}` : 'à préciser'}>
                    {isCard ? (
                      <div className="flex flex-wrap gap-2">
                        {CARD_QTY.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => (setQty({ Cartes: n }), changed())}
                            aria-pressed={qty.Cartes === n}
                            className={`rounded-full px-4 py-2 text-[14px] font-semibold ring-1 transition ${qty.Cartes === n ? 'bg-ink text-white ring-ink' : 'bg-white ring-ink/10 hover:ring-ink/30'}`}
                          >
                            {n} cartes
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className={`grid gap-2 ${sizes.length > 1 ? 'grid-cols-3' : 'max-w-[10rem] grid-cols-1'}`}>
                        {sizes.map((s) => (
                          <Stepper key={s} label={s === 'Quantité' ? 'Pièces' : s === 'Taille unique' ? 'Unique' : s} value={qty[s] ?? 0} onChange={(v) => (setQty((q) => ({ ...q, [s]: v })), changed())} />
                        ))}
                      </div>
                    )}
                  </Field>
                  <p className="text-[13px] leading-relaxed text-ink/55">Le prix dépend de la quantité et de la technique : le devis est gratuit, sans engagement.</p>
                </>
              )}
            </div>

            {/* récapitulatif et envoi */}
            <div className="m-2 mt-0 rounded-[22px] bg-ink p-4 text-white md:p-5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-white/70">
                <span className="size-3.5 rounded-full ring-1 ring-white/30" style={{ background: base }} />
                <span className="font-semibold text-white">{isCard ? `Carte ${style.ref}` : LABEL(kind)}</span>
                {!isCard && <span>· {presetLabel}</span>}
                {!isCard && technique !== ADVICE && <span>· {technique}</span>}
                {total > 0 && <span>· {total} pièce{total > 1 ? 's' : ''}</span>}
              </p>
              <button onClick={attach} disabled={busy} className="btn mt-3 h-12 w-full justify-center bg-linear-to-r from-accent to-[#1d9bf0] text-[15px] text-white hover:brightness-110">
                {attached ? (
                  <>
                    <CheckIcon className="size-4" /> Maquette jointe à votre devis
                  </>
                ) : (
                  <>
                    {isCard ? `Demander un devis — réf. ${style.ref}` : 'Demander un devis pour ce modèle'} <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Récupère le canvas de la maquette une fois monté (le cadre de la zone d'impression s'y mesure).
 * Effet « passif », placé après la maquette : il passe après celui qui renseigne sa référence.
 */
function CanvasProbe({ from, onCanvas, deps }: { from: MutableRefObject<HTMLCanvasElement | null>; onCanvas: (c: HTMLCanvasElement | null) => void; deps: unknown[] }) {
  useEffect(() => {
    onCanvas(from.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return null
}
