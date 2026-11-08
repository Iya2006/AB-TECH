import type { Product, ProductModel, StockStatus } from '@atelier/shared'
import { useEffect, useState } from 'react'
import { formatPrice } from '../config/brand'
import { useCart } from '../lib/cart'
import { isPhotoModel, PHOTO, tint } from '../lib/mockup/catalog'
import { MockupView } from '../lib/mockup/MockupView'
import { useApp } from '../lib/store'
import { thumbUrl } from './img'

/* Pictogrammes au trait, utilisés quand le produit n'a pas encore de photo. */
const ICONS: Record<ProductModel, string> = {
  aucun: 'M6 6h12v12H6z',
  tshirt: 'M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3c-.5 1.6-2 2.6-4 2.6S8.5 4.6 8 3Z',
  polo: 'M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3-2 3-2-3-2 3-2-3Zm4 3v5',
  sweat: 'M8 4 3 7l1 12h3V10v11h10V10v9h3l1-12-5-3c0 2-2 3.5-4 3.5S8 6 8 4Zm2 9h4',
  pull: 'M8 4 3 7l1 12h3V10v11h10V10v9h3l1-12-5-3c-.5 1.3-2 2-4 2s-3.5-.7-4-2Z',
  casquette: 'M3 15c0-5 4-9 9-9s9 4 9 9H3Zm9 0h9c1.5 0 2 1.5 1 2.5L20 19H12',
  snapback: 'M3 15c0-5 4-9 9-9s9 4 9 9H3Zm9 0h10v2H12',
  trucker: 'M3 15c0-5 4-9 9-9s9 4 9 9H3Zm9 0h9c1.5 0 2 1.5 1 2.5L20 19H12M14 7v8M17 9v6',
  mug: 'M5 6h11v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6Zm11 3h2a2 2 0 0 1 0 4h-2',
  tote: 'M5 9h14l-1 12H6L5 9Zm4 0V7a3 3 0 0 1 6 0v2',
  gourde: 'M10 2h4v3l1 2v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7l1-2V2Z',
  portable: 'M5 5h14v10H5zM2 18h20l-1.5 2h-17z',
  ecran: 'M3 4h18v12H3zM10 16v3h4v-3M8 20h8',
  tour: 'M7 2h10v20H7zM10 6h4M10 9h4M12 17h0',
  clavier: 'M2 7h20v10H2zM5 10h0M8 10h0M11 10h0M14 10h0M17 10h0M7 14h10',
  routeur: 'M3 13h18v6H3zM6 13 5 5M12 13V4M18 13l1-8M7 16h0M10 16h0',
  'camera-dome': 'M4 8h16v2H4zM6 10a6 6 0 0 0 12 0M12 13h0',
  'camera-bullet': 'M3 8h13v6H3zM16 9l5-2v8l-5-2M6 14v4h4',
  extincteur: 'M9 6h6v15H9zM12 6V3M12 3h4l2 2M9 9H7l-2 3',
  coffret: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9c-2-4-6-4-6-1s6 1 6 1Zm0 0c2-4 6-4 6-1s-6 1-6 1Z',
  boite: 'M4 7l8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v10',
}

/** Trait lisible : la couleur du produit, ou l'encre si elle est trop claire. */
function strokeFor(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.62 ? '#0f172a' : hex
}

export function ProductVisual({ product, size = 'card', className }: { product: Product; size?: 'card' | 'thumb' | 'large'; className?: string }) {
  // photo introuvable (supprimée, lien cassé) : on retombe sur la photo du modèle ou le pictogramme
  const [broken, setBroken] = useState<string | null>(null)
  const image = product.images[0] && product.images[0] !== broken ? product.images[0] : undefined
  if (image) {
    const w = size === 'large' ? 1200 : size === 'card' ? 600 : 200
    // Photos produit (souvent détourées) : entières, avec un peu d'air autour.
    return (
      <img
        src={thumbUrl(image, w)}
        alt={product.name}
        loading="lazy"
        onError={() => setBroken(image)}
        className={`h-full w-full object-contain ${size === 'thumb' ? 'p-1' : 'p-[9%]'} ${className ?? ''}`}
      />
    )
  }
  if (isPhotoModel(product.model)) {
    // Pas encore de photo : la vraie photo du modèle, à la couleur du produit.
    const entry = PHOTO[product.model]
    return (
      <span className={`relative block h-full w-full ${className ?? ''}`}>
        <MockupView base={entry.produit} color={tint(entry, entry.produit, product.color)} print={null} className={`absolute inset-0 h-full w-full object-contain ${size === 'thumb' ? 'p-1' : 'p-[9%]'}`} />
      </span>
    )
  }
  return (
    <div
      className={`grid h-full w-full place-items-center ${className ?? ''}`}
      style={{ background: `radial-gradient(circle at 50% 40%, #ffffff, ${product.color}22 60%, ${product.color}44)` }}
    >
      <svg viewBox="0 0 24 24" className={size === 'thumb' ? 'size-8' : 'size-1/2 max-h-40'} fill="none" stroke={strokeFor(product.color)} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={ICONS[product.model] ?? ICONS.aucun} />
      </svg>
    </div>
  )
}

export function Stars({ value, size = 'size-4', onChange }: { value: number; size?: string; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = value >= i - 0.25
        const star = (
          <svg viewBox="0 0 20 20" className={`${size} ${full ? 'text-amber-400' : 'text-ink/15'}`} fill="currentColor" aria-hidden>
            <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.8L10 1.5z" />
          </svg>
        )
        return onChange ? (
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} étoile${i > 1 ? 's' : ''}`} className="transition-transform hover:scale-125">
            {star}
          </button>
        ) : (
          <span key={i}>{star}</span>
        )
      })}
    </span>
  )
}

const STOCK: Record<StockStatus, { label: string; cls: string }> = {
  en_stock: { label: 'En stock', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  sur_commande: { label: 'Sur commande', cls: 'bg-accent-soft text-accent ring-accent/20' },
  rupture: { label: 'Rupture', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
}

export function StockBadge({ stock }: { stock: StockStatus }) {
  const s = STOCK[stock]
  return <span className={`kicker whitespace-nowrap rounded-full px-2.5 py-1 !text-[10px] ring-1 ${s.cls}`}>{s.label}</span>
}

/** Postes dont les produits se marquent au logo du client. */
export const isCustomizable = (product: Product) => product.station === 'textile' || product.station === 'objets'

/** Fond de vitrine teinté par la couleur du produit (clair, la photo reste lisible). */
export const showcase = (product: Product) => `radial-gradient(120% 90% at 50% 18%, #ffffff 0%, ${product.color}1c 62%, ${product.color}33 100%), #f4f7fb`

function AddButton({ product, className }: { product: Product; className?: string }) {
  const add = useCart((s) => s.add)
  const [added, setAdded] = useState(false)
  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(false), 1600)
    return () => clearTimeout(t)
  }, [added])
  return (
    <button
      onClick={() => (add(product.id), setAdded(true))}
      disabled={product.stock === 'rupture'}
      className={`btn h-11 justify-center text-[14px] disabled:opacity-40 ${added ? 'bg-emerald-600 text-white' : 'bg-ink text-white hover:bg-accent'} ${className ?? ''}`}
      aria-label={`Ajouter ${product.name} au panier`}
    >
      {product.stock === 'rupture' ? 'Indisponible' : added ? 'Ajouté ✓' : 'Ajouter au panier'}
    </button>
  )
}

export function ProductCard({ product }: { product: Product }) {
  const open = () => useApp.getState().open({ type: 'product', id: product.id })
  return (
    <article className="group flex flex-col overflow-hidden rounded-[24px] bg-white ring-1 ring-ink/[0.07] transition-[box-shadow,transform] duration-500 hover:-translate-y-1 hover:shadow-[0_30px_70px_-34px_rgba(15,23,42,0.45)]">
      <div className="relative aspect-[4/5] overflow-hidden" style={{ background: showcase(product) }}>
        <button onClick={open} className="absolute inset-0" aria-label={`Voir ${product.name}`}>
          <ProductVisual product={product} className="drop-shadow-[0_18px_22px_rgba(15,23,42,0.18)] transition-transform duration-700 ease-[var(--ease-expo)] group-hover:scale-[1.06]" />
        </button>
        <span className="pointer-events-none absolute left-3 top-3">
          <StockBadge stock={product.stock} />
        </span>
        {/* ajout rapide : glisse au survol (toujours visible au doigt) */}
        <div className="absolute inset-x-3 bottom-3 transition-all duration-500 ease-[var(--ease-expo)] [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100">
          <AddButton product={product} className="w-full shadow-[0_12px_30px_-12px_rgba(10,16,32,0.6)]" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4 pt-3.5">
        <p className="kicker truncate text-ink/45">
          {product.brand || product.category}
          {isCustomizable(product) && <span className="text-accent"> · Personnalisable</span>}
        </p>
        <button onClick={open} className="text-left text-[15.5px] font-semibold leading-snug hover:text-accent">
          {product.name}
        </button>
        {product.rating.count > 0 && (
          <span className="flex items-center gap-1.5 text-[12px] text-ink/50">
            <Stars value={product.rating.average} size="size-3.5" /> ({product.rating.count})
          </span>
        )}
        <p className="mt-auto pt-2 font-display text-[18px] text-ink">{formatPrice(product.price)}</p>
      </div>
    </article>
  )
}

/** Produit à la une : grande vitrine, description, ajout au panier. */
export function FeaturedProduct({ product }: { product: Product }) {
  const open = () => useApp.getState().open({ type: 'product', id: product.id })
  return (
    <article className="group relative flex h-full min-h-[34rem] flex-col overflow-hidden rounded-[28px] ring-1 ring-ink/[0.07]" style={{ background: showcase(product) }}>
      <span className="pointer-events-none absolute inset-x-5 top-5 z-10 flex items-start justify-between gap-2">
        <span className="kicker rounded-full bg-ink px-3 py-1.5 !text-[10.5px] text-white">À la une</span>
        <StockBadge stock={product.stock} />
      </span>
      <button onClick={open} className="relative min-h-0 flex-1" aria-label={`Voir ${product.name}`}>
        <ProductVisual product={product} size="large" className="absolute inset-0 drop-shadow-[0_30px_34px_rgba(15,23,42,0.22)] transition-transform duration-1000 ease-[var(--ease-expo)] group-hover:scale-[1.05]" />
      </button>
      <div className="relative m-3 rounded-[22px] bg-white/[0.96] p-5 shadow-[0_20px_50px_-30px_rgba(10,16,32,0.5)] ring-1 ring-ink/[0.06]">
        <p className="kicker text-ink/45">{product.brand || product.category}</p>
        <button onClick={open} className="mt-1 text-left font-display text-[1.7rem] leading-tight hover:text-accent">
          {product.name}
        </button>
        {product.description && <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink/60">{product.description}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="font-display text-2xl">{formatPrice(product.price)}</span>
          <div className="flex gap-2">
            <button onClick={open} className="btn btn-ghost h-11 px-4 text-[14px]">
              Voir la fiche
            </button>
            <AddButton product={product} className="px-5" />
          </div>
        </div>
      </div>
    </article>
  )
}
