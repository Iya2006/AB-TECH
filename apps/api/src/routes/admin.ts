import {
  ORDER_STATUSES,
  productInputSchema,
  QUOTE_STATUSES,
  realisationInputSchema,
  REVIEW_STATUSES,
  siteSettingsSchema,
  STATION_SLUGS,
  stationContentSchema,
  USER_ROLES,
  type AdminStats,
  type AdminUser,
  type AuthStatus,
} from '@atelier/shared'
import { and, asc, count, desc, eq, gte, ne, sql } from 'drizzle-orm'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { createResetLink, RESET_MINUTES } from '../accounts'
import type { Sessions } from '../auth'
import type { Db } from '../db/client'
import { orders, products, quoteRequests, realisations, reviews, settings, stations, users } from '../db/schema'
import { slugify } from '../db/slug'
import type { Env } from '../env'
import type { Mailer } from '../mail'
import { getRatings, getSettings, getStations, toProduct, toRealisation } from '../repo'
import { sniffImage, type Storage } from '../storage'
import { invalid } from './public'

interface Deps {
  db: Db
  storage: Storage
  sessions: Sessions
  env: Env
  mailer: Mailer
}

const idParams = z.object({ id: z.uuid() })
const slugParams = z.object({ slug: z.enum(STATION_SLUGS) })
const statusBody = <T extends readonly [string, ...string[]]>(values: T) => z.object({ status: z.enum(values) })

export const adminRoutes =
  ({ db, storage, sessions, env, mailer }: Deps): FastifyPluginAsync =>
  async (app) => {
    /*
     * Contrôle d'accès, côté serveur, sur chaque requête de l'administration :
     * pas de session → 401 ; compte CLIENT → 403 ; mot de passe initial pas encore changé → 403.
     * Masquer le bouton « Administration » ne suffirait pas : c'est ici que l'accès se joue.
     */
    app.register(async (secured) => {
      secured.addHook('preHandler', async (req, reply) => {
        reply.header('Cache-Control', 'no-store')
        const user = await sessions.read(req)
        if (!user) return reply.code(401).send({ error: 'Session expirée, reconnectez-vous.', code: 'auth_required' })
        if (user.role !== 'admin') return reply.code(403).send({ error: 'Accès réservé à l’administrateur.', code: 'forbidden' })
        if (user.mustChangePassword) return reply.code(403).send({ error: 'Changez votre mot de passe initial pour continuer.', code: 'password_change_required' })
      })

      /* ------------------------------------------------------------ */
      /* Comptes                                                       */
      /* ------------------------------------------------------------ */

      secured.get('/users', async (): Promise<AdminUser[]> => {
        const counted = (table: typeof quoteRequests | typeof orders | typeof reviews) =>
          db.select({ userId: table.userId, n: count() }).from(table).groupBy(table.userId)
        const [rows, q, o, r] = await Promise.all([
          db.select().from(users).orderBy(desc(users.createdAt)).limit(2000),
          counted(quoteRequests),
          counted(orders),
          counted(reviews),
        ])
        const map = (list: Array<{ userId: string | null; n: number }>) => new Map(list.map((x) => [x.userId, x.n]))
        const [mq, mo, mr] = [map(q), map(o), map(r)]
        return rows.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          phone: u.phone,
          avatarUrl: u.avatarUrl,
          role: u.role,
          google: !!u.googleId,
          hasPassword: !!u.passwordHash,
          createdAt: u.createdAt.toISOString(),
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          quotes: mq.get(u.id) ?? 0,
          orders: mo.get(u.id) ?? 0,
          reviews: mr.get(u.id) ?? 0,
        }))
      })

      /** Nommer ou retirer un administrateur : décision explicite d'un administrateur, jamais automatique. */
      secured.patch('/users/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        const body = z.object({ role: z.enum(USER_ROLES) }).safeParse(req.body)
        if (!params.success || !body.success) return reply.code(400).send({ error: 'Requête invalide' })
        if (params.data.id === req.user!.id) return reply.code(400).send({ error: 'Vous ne pouvez pas modifier votre propre rôle.' })
        const [target] = await db.select().from(users).where(eq(users.id, params.data.id))
        if (!target) return reply.code(404).send({ error: 'Compte introuvable' })
        if (target.role === 'admin' && body.data.role === 'client') {
          const [others] = await db.select({ n: count() }).from(users).where(and(eq(users.role, 'admin'), ne(users.id, target.id)))
          if (!others?.n) return reply.code(400).send({ error: 'Il doit rester au moins un administrateur.' })
        }
        await db.update(users).set({ role: body.data.role, updatedAt: new Date() }).where(eq(users.id, target.id))
        // nouvelle connexion obligatoire : la session prend la durée de son nouveau rôle
        await sessions.revokeAll(target.id)
        req.log.info({ by: req.user!.id, userId: target.id, role: body.data.role }, 'rôle modifié')
        return { ok: true }
      })

      /** Lien de réinitialisation à transmettre au client (WhatsApp, SMS…) quand il n'a plus accès à son compte. */
      secured.post('/users/:id/reset-link', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        if (!params.success) return reply.code(400).send({ error: 'Requête invalide' })
        const [target] = await db.select().from(users).where(eq(users.id, params.data.id))
        if (!target) return reply.code(404).send({ error: 'Compte introuvable' })
        if (target.role === 'admin') return reply.code(400).send({ error: 'Un administrateur réinitialise son mot de passe lui-même (« Mot de passe oublié ? »).' })
        return createResetLink(db, env.SESSION_SECRET, env.publicUrl, target.id, RESET_MINUTES.admin)
      })

      /** État de la connexion Google et de l'envoi d'e-mails (page Paramètres). */
      secured.get('/auth-status', async (): Promise<AuthStatus> => ({
        google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        googleRedirectUri: `${env.publicUrl}/api/auth/google/callback`,
        mail: mailer.enabled,
      }))

      /* ------------------------------------------------------------ */
      /* Tableau de bord                                               */
      /* ------------------------------------------------------------ */

      secured.get('/stats', async (): Promise<AdminStats> => {
        // Jours calculés en UTC (côté Node comme côté base) : pas de doublon au changement d'heure.
        const today = new Date()
        const since = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 13))
        const day = (col: typeof quoteRequests.createdAt | typeof orders.createdAt) => sql<string>`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD')`
        const month = new Date(Date.now() - 30 * 86_400_000)
        const [q, qNew, o, oNew, rv, rvPending, rvAvg, p, pActive, r, qDays, oDays, c, cNew] = await Promise.all([
          db.select({ n: count() }).from(quoteRequests),
          db.select({ n: count() }).from(quoteRequests).where(eq(quoteRequests.status, 'nouveau')),
          db.select({ n: count() }).from(orders),
          db.select({ n: count() }).from(orders).where(eq(orders.status, 'nouvelle')),
          db.select({ n: count() }).from(reviews),
          db.select({ n: count() }).from(reviews).where(eq(reviews.status, 'en_attente')),
          db.select({ v: sql<number>`coalesce(avg(${reviews.rating}), 0)::float` }).from(reviews).where(eq(reviews.status, 'publie')),
          db.select({ n: count() }).from(products),
          db.select({ n: count() }).from(products).where(eq(products.active, true)),
          db.select({ n: count() }).from(realisations),
          db.select({ d: day(quoteRequests.createdAt), n: count() }).from(quoteRequests).where(gte(quoteRequests.createdAt, since)).groupBy(day(quoteRequests.createdAt)),
          db.select({ d: day(orders.createdAt), n: count() }).from(orders).where(gte(orders.createdAt, since)).groupBy(day(orders.createdAt)),
          db.select({ n: count() }).from(users).where(eq(users.role, 'client')),
          db.select({ n: count() }).from(users).where(and(eq(users.role, 'client'), gte(users.createdAt, month))),
        ])
        const activity = Array.from({ length: 14 }, (_, i) => {
          const key = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10)
          return { date: key, quotes: qDays.find((x) => x.d === key)?.n ?? 0, orders: oDays.find((x) => x.d === key)?.n ?? 0 }
        })
        return {
          quotes: { total: q[0]!.n, nouveau: qNew[0]!.n },
          orders: { total: o[0]!.n, nouvelle: oNew[0]!.n },
          reviews: { total: rv[0]!.n, enAttente: rvPending[0]!.n, moyenne: Math.round((rvAvg[0]!.v ?? 0) * 10) / 10 },
          products: { total: p[0]!.n, actifs: pActive[0]!.n },
          realisations: r[0]!.n,
          clients: { total: c[0]!.n, nouveaux: cNew[0]!.n },
          activity,
        }
      })

      /* ------------------------------------------------------------ */
      /* Devis & commandes                                             */
      /* ------------------------------------------------------------ */

      secured.get('/quotes', async () => db.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt)).limit(300))

      secured.patch('/quotes/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        const body = statusBody(QUOTE_STATUSES).safeParse(req.body)
        if (!params.success || !body.success) return reply.code(400).send({ error: 'Requête invalide' })
        const [row] = await db.update(quoteRequests).set({ status: body.data.status }).where(eq(quoteRequests.id, params.data.id)).returning({ id: quoteRequests.id })
        return row ?? reply.code(404).send({ error: 'Demande introuvable' })
      })

      secured.get('/orders', async () => db.select().from(orders).orderBy(desc(orders.createdAt)).limit(300))

      secured.patch('/orders/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        const body = statusBody(ORDER_STATUSES).safeParse(req.body)
        if (!params.success || !body.success) return reply.code(400).send({ error: 'Requête invalide' })
        const [row] = await db.update(orders).set({ status: body.data.status }).where(eq(orders.id, params.data.id)).returning({ id: orders.id })
        return row ?? reply.code(404).send({ error: 'Commande introuvable' })
      })

      /* ------------------------------------------------------------ */
      /* Avis                                                          */
      /* ------------------------------------------------------------ */

      secured.get('/reviews', async () =>
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
          .orderBy(desc(reviews.createdAt))
          .limit(500),
      )

      secured.patch('/reviews/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        const body = statusBody(REVIEW_STATUSES).safeParse(req.body)
        if (!params.success || !body.success) return reply.code(400).send({ error: 'Requête invalide' })
        const [row] = await db.update(reviews).set({ status: body.data.status }).where(eq(reviews.id, params.data.id)).returning({ id: reviews.id })
        return row ?? reply.code(404).send({ error: 'Avis introuvable' })
      })

      secured.delete('/reviews/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        if (!params.success) return reply.code(400).send({ error: 'Requête invalide' })
        await db.delete(reviews).where(eq(reviews.id, params.data.id))
        return { ok: true }
      })

      /* ------------------------------------------------------------ */
      /* Produits                                                      */
      /* ------------------------------------------------------------ */

      secured.get('/products', async () => {
        const [rows, ratings] = await Promise.all([
          db.select().from(products).orderBy(asc(products.station), asc(products.sortOrder), asc(products.createdAt)),
          getRatings(db),
        ])
        return rows.map((p) => toProduct(p, ratings.get(p.id)))
      })

      secured.post('/products', async (req, reply) => {
        const parsed = productInputSchema.safeParse(req.body)
        if (!parsed.success) return invalid(reply, parsed.error)
        const [row] = await db.insert(products).values({ ...parsed.data, slug: slugify(parsed.data.name) }).returning()
        return reply.code(201).send(toProduct(row!))
      })

      secured.put('/products/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        if (!params.success) return reply.code(400).send({ error: 'Requête invalide' })
        const parsed = productInputSchema.safeParse(req.body)
        if (!parsed.success) return invalid(reply, parsed.error)
        const [row] = await db.update(products).set({ ...parsed.data, updatedAt: new Date() }).where(eq(products.id, params.data.id)).returning()
        return row ? toProduct(row) : reply.code(404).send({ error: 'Produit introuvable' })
      })

      secured.delete('/products/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        if (!params.success) return reply.code(400).send({ error: 'Requête invalide' })
        await db.delete(products).where(eq(products.id, params.data.id))
        return { ok: true }
      })

      /* ------------------------------------------------------------ */
      /* Réalisations                                                  */
      /* ------------------------------------------------------------ */

      secured.get('/realisations', async () =>
        (await db.select().from(realisations).orderBy(asc(realisations.station), asc(realisations.sortOrder), asc(realisations.createdAt))).map(toRealisation),
      )

      secured.post('/realisations', async (req, reply) => {
        const parsed = realisationInputSchema.safeParse(req.body)
        if (!parsed.success) return invalid(reply, parsed.error)
        const [row] = await db.insert(realisations).values(parsed.data).returning()
        return reply.code(201).send(toRealisation(row!))
      })

      secured.put('/realisations/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        if (!params.success) return reply.code(400).send({ error: 'Requête invalide' })
        const parsed = realisationInputSchema.safeParse(req.body)
        if (!parsed.success) return invalid(reply, parsed.error)
        const [row] = await db.update(realisations).set({ ...parsed.data, updatedAt: new Date() }).where(eq(realisations.id, params.data.id)).returning()
        return row ? toRealisation(row) : reply.code(404).send({ error: 'Réalisation introuvable' })
      })

      secured.delete('/realisations/:id', async (req, reply) => {
        const params = idParams.safeParse(req.params)
        if (!params.success) return reply.code(400).send({ error: 'Requête invalide' })
        await db.delete(realisations).where(eq(realisations.id, params.data.id))
        return { ok: true }
      })

      /* ------------------------------------------------------------ */
      /* Postes de l'atelier & paramètres                              */
      /* ------------------------------------------------------------ */

      secured.get('/stations', async () => getStations(db))

      secured.put('/stations/:slug', async (req, reply) => {
        const params = slugParams.safeParse(req.params)
        if (!params.success) return reply.code(400).send({ error: 'Poste inconnu' })
        const parsed = stationContentSchema.safeParse(req.body)
        if (!parsed.success) return invalid(reply, parsed.error)
        await db
          .insert(stations)
          .values({ slug: params.data.slug, ...parsed.data })
          .onConflictDoUpdate({ target: stations.slug, set: { ...parsed.data, updatedAt: new Date() } })
        return { slug: params.data.slug, ...parsed.data }
      })

      secured.get('/settings', async () => getSettings(db))

      secured.put('/settings', async (req, reply) => {
        const parsed = siteSettingsSchema.safeParse(req.body)
        if (!parsed.success) return invalid(reply, parsed.error)
        await db
          .insert(settings)
          .values({ key: 'site', value: parsed.data })
          .onConflictDoUpdate({ target: settings.key, set: { value: parsed.data, updatedAt: new Date() } })
        return parsed.data
      })

      /* ------------------------------------------------------------ */
      /* Médias (plusieurs fichiers d'un coup)                         */
      /* ------------------------------------------------------------ */

      secured.post('/uploads', async (req, reply) => {
        const urls: string[] = []
        for await (const part of req.files({ limits: { fileSize: 8 * 1024 * 1024, files: 12 } })) {
          const buf = await part.toBuffer()
          const type = sniffImage(buf)
          if (!type) return reply.code(415).send({ error: `${part.filename} : formats acceptés PNG, JPG, WEBP` })
          urls.push(await storage.save(buf, type, 'media'))
        }
        if (!urls.length) return reply.code(400).send({ error: 'Aucun fichier' })
        return reply.code(201).send({ urls })
      })
    })
  }
