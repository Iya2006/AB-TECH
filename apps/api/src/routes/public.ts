import { orderInputSchema, quoteRequestSchema, reviewInputSchema, type OrderItem } from '@atelier/shared'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Sessions } from '../auth'
import type { Db } from '../db/client'
import { orders, products, quoteRequests, reviews, services, users } from '../db/schema'
import { getSiteData } from '../repo'
import { sniffImage, type Storage } from '../storage'

interface Deps {
  db: Db
  storage: Storage
  sessions: Sessions
}

const uploadQuery = z.object({ kind: z.enum(['logo', 'mockup']) })
const reviewsQuery = z.object({ productId: z.uuid().optional() })

const strict = (max: number) => ({ config: { rateLimit: { max, timeWindow: '10 minutes' } } })

export function invalid(reply: FastifyReply, error: z.ZodError) {
  return reply.code(400).send({ error: 'validation', issues: z.flattenError(error).fieldErrors })
}

export const publicRoutes =
  ({ db, storage, sessions }: Deps): FastifyPluginAsync =>
  async (app) => {
    /**
     * Les actions qui enregistrent des données personnelles (devis, commande, avis, fichiers)
     * exigent un compte : tout est rattaché à son identifiant et retrouvé dans « Mon compte ».
     */
    const signedIn = {
      preHandler: async (req: FastifyRequest, reply: FastifyReply) => {
        if (!(await sessions.read(req))) return reply.code(401).send({ error: 'Connectez-vous pour continuer.', code: 'auth_required' })
      },
    }
    /** Le téléphone donné dans un formulaire complète le profil s'il était vide. */
    const rememberPhone = async (req: FastifyRequest, phone: string) => {
      if (req.user && !req.user.phone && phone) await db.update(users).set({ phone, updatedAt: new Date() }).where(eq(users.id, req.user.id))
    }

    app.get('/health', async () => {
      await db.execute(sql`select 1`)
      return { ok: true, storage: storage.driver }
    })

    /** Le serveur répond, sans toucher la base (contrôle de Render, réveil régulier : la base gratuite peut dormir). */
    app.get('/ping', async (_req, reply) => {
      reply.header('Cache-Control', 'no-store')
      return { ok: true }
    })

    /** Tout le contenu du site public en un appel (paramètres, postes, réalisations, produits). */
    app.get('/site', async (_req, reply) => {
      reply.header('Cache-Control', 'public, max-age=30')
      return getSiteData(db)
    })

    app.get('/services', async (_req, reply) => {
      const rows = await db
        .select({
          slug: services.slug,
          domain: services.domain,
          title: services.title,
          summary: services.summary,
          highlights: services.highlights,
          sortOrder: services.sortOrder,
        })
        .from(services)
        .orderBy(asc(services.sortOrder))
      reply.header('Cache-Control', 'public, max-age=300')
      return rows
    })

    app.get('/reviews', async (req, reply) => {
      const q = reviewsQuery.safeParse(req.query)
      if (!q.success) return invalid(reply, q.error)
      const where = and(
        eq(reviews.status, 'publie'),
        q.data.productId ? eq(reviews.productId, q.data.productId) : isNull(reviews.productId),
      )
      return db
        .select({ id: reviews.id, name: reviews.name, rating: reviews.rating, comment: reviews.comment, productId: reviews.productId, createdAt: reviews.createdAt })
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.createdAt))
        .limit(60)
    })

    app.post('/reviews', { ...strict(5), ...signedIn }, async (req, reply) => {
      const parsed = reviewInputSchema.safeParse(req.body)
      if (!parsed.success) return invalid(reply, parsed.error)
      const { website, ...data } = parsed.data
      if (website) return reply.code(201).send({ ok: true })
      if (data.productId) {
        const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, data.productId))
        if (!p) return reply.code(404).send({ error: 'Produit introuvable' })
      }
      // Publié après validation dans l'espace pro.
      await db.insert(reviews).values({ ...data, productId: data.productId ?? null, userId: req.user!.id })
      return reply.code(201).send({ ok: true })
    })

    app.post('/orders', { ...strict(5), ...signedIn }, async (req, reply) => {
      const parsed = orderInputSchema.safeParse(req.body)
      if (!parsed.success) return invalid(reply, parsed.error)
      const { website, items, ...customer } = parsed.data
      if (website) return reply.code(201).send({ id: null })

      // Les noms et prix viennent de la base, jamais du navigateur.
      const rows = await db
        .select({ id: products.id, name: products.name, price: products.price })
        .from(products)
        .where(and(inArray(products.id, items.map((i) => i.productId)), eq(products.active, true)))
      const lines: OrderItem[] = []
      for (const item of items) {
        const p = rows.find((r) => r.id === item.productId)
        if (!p) return reply.code(400).send({ error: 'validation', issues: { items: ['Un produit n’est plus disponible'] } })
        lines.push({ productId: p.id, name: p.name, price: p.price, qty: item.qty })
      }
      const total = lines.every((l) => l.price !== null) ? lines.reduce((s, l) => s + l.price! * l.qty, 0) : null

      const [row] = await db
        .insert(orders)
        .values({
          ...customer,
          userId: req.user!.id,
          email: customer.email ?? req.user!.email,
          address: customer.address || null,
          message: customer.message || null,
          items: lines,
          total,
        })
        .returning({ id: orders.id })
      await rememberPhone(req, customer.phone)
      req.log.info({ orderId: row?.id }, 'nouvelle commande')
      return reply.code(201).send({ id: row?.id, items: lines, total })
    })

    app.post('/quotes', { ...strict(5), ...signedIn }, async (req, reply) => {
      const parsed = quoteRequestSchema.safeParse(req.body)
      if (!parsed.success) return invalid(reply, parsed.error)
      const { website, ...data } = parsed.data
      // Robot détecté : on répond comme si tout allait bien, sans rien enregistrer.
      if (website) return reply.code(201).send({ id: null })

      for (const url of [data.mockupUrl, data.logoUrl]) {
        if (url && !storage.owns(url)) {
          return reply.code(400).send({ error: 'validation', issues: { logoUrl: ['Fichier non reconnu'] } })
        }
      }

      const [row] = await db
        .insert(quoteRequests)
        .values({ ...data, email: data.email ?? req.user!.email, userId: req.user!.id })
        .returning({ id: quoteRequests.id })
      await rememberPhone(req, data.phone)
      req.log.info({ quoteId: row?.id, service: data.service }, 'nouvelle demande de devis')
      return reply.code(201).send({ id: row?.id })
    })

    app.post('/uploads', { ...strict(20), ...signedIn }, async (req, reply) => {
      const query = uploadQuery.safeParse(req.query)
      if (!query.success) return reply.code(400).send({ error: 'kind invalide' })

      const file = await req.file()
      if (!file) return reply.code(400).send({ error: 'Aucun fichier' })

      const buf = await file.toBuffer()
      const type = sniffImage(buf)
      if (!type) return reply.code(415).send({ error: 'Formats acceptés : PNG, JPG, WEBP' })

      const url = await storage.save(buf, type, query.data.kind)
      return reply.code(201).send({ url })
    })
  }
