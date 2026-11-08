import { accountPasswordSchema, ADMIN_PASSWORD_MIN, profileSchema, type AccountActivity } from '@atelier/shared'
import { desc, eq } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { hashPassword, toAuthUser, verifyPassword, type Sessions } from '../auth'
import type { Db } from '../db/client'
import { orders, products, quoteRequests, reviews, users } from '../db/schema'
import { sniffImage, type Storage } from '../storage'
import { invalid } from './public'

interface Deps {
  db: Db
  storage: Storage
  sessions: Sessions
}

/** Photo de profil venant de Google (seule adresse extérieure acceptée). */
const isGooglePhoto = (url: string) => /^https:\/\/lh\d\.googleusercontent\.com\//.test(url)

/** Espace client : tout passe par la session ; chacun ne voit que ses propres données. */
export const accountRoutes =
  ({ db, storage, sessions }: Deps): FastifyPluginAsync =>
  async (app) => {
    app.addHook('preHandler', async (req, reply) => {
      reply.header('Cache-Control', 'no-store')
      if (!(await sessions.read(req))) return reply.code(401).send({ error: 'Connectez-vous pour continuer.' })
    })

    app.get('/', async (req) => toAuthUser(req.user!))

    app.put('/profile', async (req, reply) => {
      const parsed = profileSchema.safeParse(req.body)
      if (!parsed.success) return invalid(reply, parsed.error)
      const { avatarUrl } = parsed.data
      if (avatarUrl && avatarUrl !== req.user!.avatarUrl && !storage.owns(avatarUrl) && !isGooglePhoto(avatarUrl)) {
        return reply.code(400).send({ error: 'validation', issues: { avatarUrl: ['Image non reconnue'] } })
      }
      const [user] = await db
        .update(users)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(users.id, req.user!.id))
        .returning()
      return toAuthUser(user!)
    })

    app.post('/avatar', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
      const file = await req.file()
      if (!file) return reply.code(400).send({ error: 'Aucun fichier' })
      const buf = await file.toBuffer()
      const type = sniffImage(buf)
      if (!type) return reply.code(415).send({ error: 'Formats acceptés : PNG, JPG, WEBP' })
      const url = await storage.save(buf, type, 'avatar')
      const [user] = await db.update(users).set({ avatarUrl: url, updatedAt: new Date() }).where(eq(users.id, req.user!.id)).returning()
      return toAuthUser(user!)
    })

    app.put('/password', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
      const parsed = accountPasswordSchema.safeParse(req.body)
      if (!parsed.success) return invalid(reply, parsed.error)
      const me = req.user!
      const { current, next } = parsed.data
      if (me.passwordHash && !(current && (await verifyPassword(current, me.passwordHash)))) {
        return reply.code(400).send({ error: 'validation', issues: { current: ['Mot de passe actuel incorrect'] } })
      }
      if (me.role === 'admin' && next.length < ADMIN_PASSWORD_MIN) {
        return reply.code(400).send({ error: 'validation', issues: { next: [`${ADMIN_PASSWORD_MIN} caractères minimum pour un administrateur`] } })
      }
      if (me.passwordHash && current === next) {
        return reply.code(400).send({ error: 'validation', issues: { next: ['Choisissez un mot de passe différent de l’actuel'] } })
      }
      const [user] = await db
        .update(users)
        .set({ passwordHash: await hashPassword(next), mustChangePassword: false, updatedAt: new Date() })
        .where(eq(users.id, me.id))
        .returning()
      // les autres appareils sont déconnectés ; celui-ci reste connecté
      await sessions.revokeAll(me.id, req.sessionId)
      return toAuthUser(user!)
    })

    app.post('/logout-others', async (req) => {
      await sessions.revokeAll(req.user!.id, req.sessionId)
      return { ok: true }
    })

    /** Historique : devis, commandes et avis du compte. */
    app.get('/activity', async (req): Promise<AccountActivity> => {
      const id = req.user!.id
      const [q, o, r] = await Promise.all([
        db.select().from(quoteRequests).where(eq(quoteRequests.userId, id)).orderBy(desc(quoteRequests.createdAt)).limit(200),
        db.select().from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)).limit(200),
        db
          .select({
            id: reviews.id,
            name: reviews.name,
            rating: reviews.rating,
            comment: reviews.comment,
            status: reviews.status,
            productId: reviews.productId,
            productName: products.name,
            createdAt: reviews.createdAt,
          })
          .from(reviews)
          .leftJoin(products, eq(products.id, reviews.productId))
          .where(eq(reviews.userId, id))
          .orderBy(desc(reviews.createdAt))
          .limit(200),
      ])
      const iso = <T extends { createdAt: Date }>(row: T) => ({ ...row, createdAt: row.createdAt.toISOString() })
      return {
        quotes: q.map(({ userId: _u, ...row }) => ({
          ...iso(row),
          company: row.company ?? undefined,
          email: row.email ?? undefined,
          quantity: row.quantity ?? undefined,
          customization: row.customization ?? undefined,
          mockupUrl: row.mockupUrl ?? undefined,
          logoUrl: row.logoUrl ?? undefined,
          service: row.service as AccountActivity['quotes'][number]['service'],
        })),
        orders: o.map(({ userId: _u, ...row }) => iso(row)),
        reviews: r.map(iso),
      }
    })
  }
