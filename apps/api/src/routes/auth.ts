import { ADMIN_PASSWORD_MIN, forgotSchema, registerSchema, resetSchema, safeNext, signInSchema, type AuthSession } from '@atelier/shared'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { claimRecords, createResetLink, findReset, RESET_MINUTES, upsertGoogleUser } from '../accounts'
import { checkPassword, hashPassword, newToken, readCookie, safeEqual, setCookie, sign, toAuthUser, unsign, type Sessions } from '../auth'
import type { Db } from '../db/client'
import { passwordResets, users } from '../db/schema'
import type { Env } from '../env'
import { resetMail, type Mailer } from '../mail'
import { getSettings } from '../repo'
import { invalid } from './public'

interface Deps {
  db: Db
  env: Env
  sessions: Sessions
  mailer: Mailer
}

const limit = (max: number, timeWindow: string) => ({ config: { rateLimit: { max, timeWindow } } })

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const OAUTH_COOKIE = 'abt_oauth'
const OAUTH_PATH = '/api/auth/google'

interface OAuthState {
  state: string
  verifier: string
  nonce: string
  next: string
  exp: number
}

const googleClaims = z.object({
  iss: z.string(),
  aud: z.string(),
  sub: z.string().min(1),
  exp: z.number(),
  nonce: z.string().optional(),
  email: z.email(),
  email_verified: z.union([z.boolean(), z.literal('true')]),
  name: z.string().optional(),
  picture: z.string().optional(),
})

/** Adresse masquée (affichée sur la page de réinitialisation) : ab***@exemple.com */
const mask = (email: string) => email.replace(/^(.{1,2})[^@]*(@.*)$/, (_, a: string, b: string) => `${a}***${b}`)

export const authRoutes =
  ({ db, env, sessions, mailer }: Deps): FastifyPluginAsync =>
  async (app) => {
    const secret = env.SESSION_SECRET
    const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET } : null
    const redirectUri = `${env.publicUrl}${OAUTH_PATH}/callback`

    /** Le compte connecté et les moyens de connexion proposés. */
    app.get('/session', async (req, reply): Promise<AuthSession> => {
      reply.header('Cache-Control', 'no-store')
      const user = await sessions.read(req)
      return { user: user ? toAuthUser(user) : null, providers: { google: !!google, mail: mailer.enabled } }
    })

    /* -------------------------------------------------------------- */
    /* Inscription et connexion par e-mail                             */
    /* -------------------------------------------------------------- */

    app.post('/register', limit(5, '10 minutes'), async (req, reply) => {
      const parsed = registerSchema.safeParse(req.body)
      if (!parsed.success) return invalid(reply, parsed.error)
      const { website, ...data } = parsed.data
      if (website) return reply.code(400).send({ error: 'Requête invalide' })
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email))
      if (existing) return reply.code(409).send({ error: 'validation', issues: { email: ['Un compte existe déjà avec cette adresse : connectez-vous.'] } })
      // Toujours CLIENT : le rôle administrateur n'est jamais attribué à l'inscription.
      const [user] = await db
        .insert(users)
        .values({ email: data.email, name: data.name, passwordHash: await hashPassword(data.password), role: 'client' })
        .returning()
      await sessions.start(req, reply, user!)
      req.log.info({ userId: user!.id }, 'nouveau compte client')
      return reply.code(201).send({ user: toAuthUser(user!) })
    })

    app.post('/login', limit(10, '5 minutes'), async (req, reply) => {
      const parsed = signInSchema.safeParse(req.body)
      if (!parsed.success) return invalid(reply, parsed.error)
      const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email))
      const ok = await checkPassword(parsed.data.password, user?.passwordHash)
      if (!user || !ok) {
        if (user && !user.passwordHash && user.googleId) {
          return reply.code(401).send({ error: 'Ce compte se connecte avec Google : utilisez « Continuer avec Google ».' })
        }
        return reply.code(401).send({ error: 'E-mail ou mot de passe incorrect.' })
      }
      await sessions.start(req, reply, user)
      return { user: toAuthUser(user) }
    })

    app.post('/logout', async (req, reply) => {
      await sessions.end(req, reply)
      return { ok: true }
    })

    /* -------------------------------------------------------------- */
    /* Google (OAuth 2.0, code d'autorisation + PKCE + state + nonce)  */
    /* -------------------------------------------------------------- */

    const back = (reply: FastifyReply, code: string, next: string) =>
      reply.redirect(`/connexion?erreur=${code}${next ? `&next=${encodeURIComponent(next)}` : ''}`)

    app.get('/google', limit(20, '5 minutes'), async (req, reply) => {
      const next = safeNext((req.query as { next?: unknown }).next, '')
      if (!google) return back(reply, 'google-indisponible', next)
      const data: OAuthState = { state: newToken(), verifier: newToken(), nonce: newToken(), next, exp: Date.now() + 10 * 60_000 }
      setCookie(req, reply, OAUTH_COOKIE, sign(data, secret), 600, OAUTH_PATH)
      const url = new URL(GOOGLE_AUTH)
      url.search = new URLSearchParams({
        client_id: google.id,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state: data.state,
        nonce: data.nonce,
        code_challenge: createHash('sha256').update(data.verifier).digest('base64url'),
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString()
      return reply.redirect(url.toString())
    })

    app.get('/google/callback', limit(20, '5 minutes'), async (req, reply) => {
      const q = req.query as { code?: string; state?: string; error?: string }
      const saved = unsign<OAuthState>(readCookie(req, OAUTH_COOKIE), secret)
      setCookie(req, reply, OAUTH_COOKIE, '', 0, OAUTH_PATH)
      const next = saved?.next ?? ''
      if (!google) return back(reply, 'google-indisponible', next)
      if (q.error) return back(reply, 'google-annule', next)
      // le retour doit correspondre au départ (même navigateur, moins de 10 minutes)
      if (!saved || saved.exp < Date.now() || !q.state || !q.code || !safeEqual(q.state, saved.state)) return back(reply, 'google', next)

      let claims: z.infer<typeof googleClaims>
      try {
        const res = await fetch(GOOGLE_TOKEN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: q.code,
            client_id: google.id,
            client_secret: google.secret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: saved.verifier,
          }),
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) throw new Error(`Google a répondu ${res.status}`)
        const { id_token } = (await res.json()) as { id_token?: string }
        const payload = id_token?.split('.')[1]
        if (!payload) throw new Error('id_token absent')
        // Jeton reçu directement de Google en HTTPS : son origine est garantie par TLS (OpenID Connect § 3.1.3.7).
        // On vérifie le reste : émetteur, destinataire, expiration, nonce, adresse vérifiée.
        claims = googleClaims.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()))
        const valid =
          GOOGLE_ISSUERS.includes(claims.iss) &&
          claims.aud === google.id &&
          claims.exp * 1000 > Date.now() &&
          !!claims.nonce &&
          safeEqual(claims.nonce, saved.nonce) &&
          (claims.email_verified === true || claims.email_verified === 'true')
        if (!valid) throw new Error('jeton Google refusé')
      } catch (err) {
        req.log.warn({ err }, 'connexion Google échouée')
        return back(reply, 'google', next)
      }

      const user = await upsertGoogleUser(db, { sub: claims.sub, email: claims.email, name: claims.name ?? '', picture: claims.picture ?? '' })
      await claimRecords(db, user)
      await sessions.start(req, reply, user)
      return reply.redirect(next || (user.role === 'admin' ? '/admin' : '/compte'))
    })

    /* -------------------------------------------------------------- */
    /* Mot de passe oublié                                             */
    /* -------------------------------------------------------------- */

    app.post('/forgot', limit(5, '15 minutes'), async (req) => {
      const parsed = forgotSchema.safeParse(req.body)
      // même réponse dans tous les cas : on ne révèle pas quelles adresses ont un compte
      if (!parsed.success) return { ok: true }
      const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email))
      if (user) {
        const { url } = await createResetLink(db, secret, env.publicUrl, user.id, RESET_MINUTES.email)
        const { name: brand } = await getSettings(db)
        await mailer.send(resetMail({ to: user.email, name: user.name, brand, url, minutes: RESET_MINUTES.email })).catch((err) => req.log.error({ err }, 'e-mail de réinitialisation non envoyé'))
      }
      return { ok: true }
    })

    /** Le lien est-il encore valable ? (affiche le formulaire ou propose d'en demander un autre) */
    app.get('/reset', limit(30, '15 minutes'), async (req, reply) => {
      reply.header('Cache-Control', 'no-store')
      const token = String((req.query as { token?: unknown }).token ?? '')
      if (token.length < 20 || token.length > 200) return { valid: false }
      const row = await findReset(db, secret, token)
      return row ? { valid: true, email: mask(row.user.email), admin: row.user.role === 'admin' } : { valid: false }
    })

    app.post('/reset', limit(10, '15 minutes'), async (req, reply) => {
      const parsed = resetSchema.safeParse(req.body)
      if (!parsed.success) return invalid(reply, parsed.error)
      const row = await findReset(db, secret, parsed.data.token)
      if (!row) return reply.code(400).send({ error: 'Ce lien n’est plus valable. Demandez-en un nouveau.' })
      if (row.user.role === 'admin' && parsed.data.password.length < ADMIN_PASSWORD_MIN) {
        return reply.code(400).send({ error: 'validation', issues: { password: [`${ADMIN_PASSWORD_MIN} caractères minimum pour un administrateur`] } })
      }
      // lien consommé, nouveau mot de passe, toutes les sessions fermées, puis connexion
      await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.id))
      const [user] = await db
        .update(users)
        .set({ passwordHash: await hashPassword(parsed.data.password), emailVerified: true, mustChangePassword: false, updatedAt: new Date() })
        .where(eq(users.id, row.user.id))
        .returning()
      await sessions.revokeAll(user!.id)
      await claimRecords(db, user!)
      await sessions.start(req, reply, user!)
      req.log.info({ userId: user!.id }, 'mot de passe réinitialisé')
      return { user: toAuthUser(user!) }
    })
  }
