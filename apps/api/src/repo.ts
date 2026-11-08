import {
  DEFAULT_SETTINGS,
  STATION_SLUGS,
  type Product,
  type Realisation,
  type SiteData,
  type SiteSettings,
  type StationContent,
  type StationSlug,
} from '@atelier/shared'
import { and, asc, count, eq, isNotNull, sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { products, realisations, reviews, settings, stations } from './db/schema'

type ProductRow = typeof products.$inferSelect
type RealisationRow = typeof realisations.$inferSelect

export async function getSettings(db: Db): Promise<SiteSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'site'))
  // Fusion : un champ ajouté plus tard reçoit sa valeur par défaut (y compris dans « display »).
  const stored = (row?.value ?? {}) as Partial<SiteSettings>
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    welcome: { ...DEFAULT_SETTINGS.welcome, ...stored.welcome },
    sections: { ...DEFAULT_SETTINGS.sections, ...stored.sections },
    machines: { ...stored.machines },
    display: { ...DEFAULT_SETTINGS.display, ...stored.display },
  }
}

export async function getStations(db: Db): Promise<StationContent[]> {
  const rows = await db.select().from(stations)
  return STATION_SLUGS.flatMap((slug) => {
    const r = rows.find((x) => x.slug === slug)
    return r ? [{ slug, kicker: r.kicker, title: r.title, body: r.body, tags: r.tags, service: r.service as StationContent['service'] }] : []
  })
}

export const toRealisation = (r: RealisationRow): Realisation => ({
  id: r.id,
  station: r.station as StationSlug,
  title: r.title,
  description: r.description,
  images: r.images,
  featured: r.featured,
  published: r.published,
  sortOrder: r.sortOrder,
  createdAt: r.createdAt.toISOString(),
})

export function toProduct(p: ProductRow, rating = { average: 0, count: 0 }): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    station: p.station as StationSlug,
    category: p.category,
    brand: p.brand,
    price: p.price,
    description: p.description,
    specs: p.specs,
    images: p.images,
    stock: p.stock,
    featured: p.featured,
    active: p.active,
    sortOrder: p.sortOrder,
    model: p.model as Product['model'],
    color: p.color,
    printImage: p.printImage,
    rating,
  }
}

export async function getRatings(db: Db) {
  const rows = await db
    .select({ productId: reviews.productId, average: sql<number>`avg(${reviews.rating})::float`, n: count() })
    .from(reviews)
    .where(and(eq(reviews.status, 'publie'), isNotNull(reviews.productId)))
    .groupBy(reviews.productId)
  return new Map(rows.map((r) => [r.productId!, { average: Math.round(r.average * 10) / 10, count: r.n }]))
}

export async function getSiteData(db: Db): Promise<SiteData> {
  const [site, stationList, realRows, productRows, ratings] = await Promise.all([
    getSettings(db),
    getStations(db),
    db.select().from(realisations).where(eq(realisations.published, true)).orderBy(asc(realisations.sortOrder), asc(realisations.createdAt)),
    db.select().from(products).where(eq(products.active, true)).orderBy(asc(products.sortOrder), asc(products.createdAt)),
    getRatings(db),
  ])
  return {
    settings: site,
    stations: stationList,
    realisations: realRows.map(toRealisation),
    products: productRows.map((p) => toProduct(p, ratings.get(p.id))),
  }
}
