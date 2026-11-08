import type { Product, ProductModel } from '@atelier/shared'
import { useEffect, useRef, useState } from 'react'
import type { GarmentKind, RailGarment } from '../components/ui/product-rail-gallery'
import { formatPrice } from '../config/brand'
import { thumbUrl } from '../ui/img'
import { whenIdle } from './idle'

/**
 * Les produits textiles de l'espace pro, présentés sur le portant (Product Rail Gallery).
 * Le composant attend des photos de vêtement seul, cadrées à l'identique (toile portrait 200 × 310) :
 * - photos de démo : versions préparées hors ligne (/media/rail, voir tools/studio-assets/rail.mjs) ;
 * - photos détourées de l'admin : recadrées ici, dans le navigateur ;
 * - sinon : l'illustration intégrée du composant, à la couleur du produit.
 */

export const RAIL_MODELS: ProductModel[] = ['tshirt', 'polo', 'sweat', 'pull']

const KIND: Partial<Record<ProductModel, GarmentKind>> = { tshirt: 'tee', polo: 'tee', sweat: 'hoodie', pull: 'knit' }

const DEMO_RAIL = new Set(
  ['tshirt', 'tshirt-noir', 'tshirt-bleu', 'tshirt-sable', 'tshirt-rouge', 'polo', 'polo-marine', 'polo-noir', 'sweat', 'sweat-noir', 'sweat-gris', 'pull', 'pull-vert', 'pull-marine'].map((n) => `${n}.webp`),
)

const STOCK = { en_stock: 'En stock', sur_commande: 'Sur commande', rupture: 'Rupture' } as const

/** Toile du portant : 400 × 620 (proportions 200 × 310), encolure sous la barre du cintre dessiné. */
const W = 400
const H = 620

function load(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** Recadre une photo détourée sur la toile du portant ; null si la photo a un fond (pas détourée). */
async function normalizeCutout(url: string): Promise<string | null> {
  const img = await load(thumbUrl(url, 900))
  // analyse des pixels au premier moment de calme : jamais pendant le défilement
  const out = await whenIdle(() => cropCutout(img))
  if (!out) return null
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/webp', 0.9))
  return blob ? URL.createObjectURL(blob) : null
}

function cropCutout(img: HTMLImageElement): HTMLCanvasElement | null {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  let edgeClear = 0
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const a = data[(y * c.width + x) * 4 + 3]!
      if ((x === 0 || y === 0 || x === c.width - 1 || y === c.height - 1) && a < 200) edgeClear++
      if (a > 24) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  // fond opaque sur les bords : ce n'est pas une photo détourée
  if (edgeClear < (c.width + c.height) || x1 < 0) return null
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const top = Math.round(H * 0.05)
  const s = Math.min((W * 0.9) / cw, (H * 0.86 - top) / ch)
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const o = out.getContext('2d')!
  o.imageSmoothingQuality = 'high'
  o.drawImage(c, x0, y0, cw, ch, (W - cw * s) / 2, top, cw * s, ch * s)
  return out
}

function railPhoto(url: string | undefined) {
  const name = url?.match(/^\/media\/catalogue\/([\w-]+\.webp)$/)?.[1]
  return name && DEMO_RAIL.has(name) ? `/media/rail/${name}` : undefined
}

function garment(p: Product, image: string | undefined): RailGarment {
  // étiquette de cintre : le prix s'il est affichable (devise renseignée), sinon « Sur devis »
  const price = formatPrice(p.price)
  return {
    id: p.id,
    name: p.name,
    description: p.description || undefined,
    kind: KIND[p.model] ?? 'tee',
    color: p.color,
    image,
    tag: /\d/.test(price) ? price : 'Sur devis',
    details: [p.category, STOCK[p.stock], 'Personnalisable à votre logo'].filter(Boolean),
  }
}

/** Les pièces du portant, avec leurs photos prêtes (les recadrages se font en arrière-plan). */
export function useRailGarments(products: Product[]) {
  const [prepared, setPrepared] = useState<Record<string, string | null>>({})
  const created = useRef<string[]>([])
  useEffect(() => {
    let off = false
    for (const p of products) {
      const own = p.images[0]
      if (!own || railPhoto(own) || own in prepared) continue
      normalizeCutout(own)
        .catch(() => null)
        .then((url) => {
          if (url) created.current.push(url)
          if (!off) setPrepared((m) => ({ ...m, [own]: url }))
        })
    }
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])
  useEffect(() => () => created.current.forEach((u) => URL.revokeObjectURL(u)), [])
  return products.map((p) => {
    const own = p.images[0]
    return garment(p, railPhoto(own) ?? (own ? prepared[own] ?? undefined : undefined))
  })
}
