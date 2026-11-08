import type { AuthUser, UserRole } from '@atelier/shared'
import { and, eq, gt, ne } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Db } from './db/client'
import { sessions, users } from './db/schema'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

/* ------------------------------------------------------------------ */
/* Mots de passe : scrypt (intégré à Node, aucune dépendance native)   */
/* ------------------------------------------------------------------ */

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, salt, hash] = stored.split('$')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

let dummyHash: Promise<string> | undefined
/** Vérifie même quand le compte n'existe pas : la durée de réponse ne trahit pas les adresses enregistrées. */
export async function checkPassword(password: string, stored: string | null | undefined) {
  if (stored) return verifyPassword(password, stored)
  dummyHash ??= hashPassword(randomBytes(12).toString('hex'))
  await verifyPassword(password, await dummyHash)
  return false
}

/* ------------------------------------------------------------------ */
/* Jetons                                                              */
/* ------------------------------------------------------------------ */

/** 256 bits aléatoires, lisibles dans une URL. */
export const newToken = () => randomBytes(32).toString('base64url')

/** Empreinte stockée en base : un vol de la base ne donne ni session ni lien de réinitialisation utilisable. */
export const tokenId = (token: string, secret: string) => createHmac('sha256', secret).update(token).digest('hex')

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Petite donnée signée (état du parcours Google) : on la retrouve intacte au retour. */
export function sign(data: object, secret: string) {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url')
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

export function unsign<T>(value: string | undefined, secret: string): T | null {
  if (!value) return null
  const [body, sig] = value.split('.')
  if (!body || !sig || !safeEqual(sig, createHmac('sha256', secret).update(body).digest('base64url'))) return null
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as T
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

export const SESSION_COOKIE = 'abt_sid'
/** Cookie des versions précédentes (jeton signé sans session en base) : effacé au passage. */
const LEGACY_COOKIE = 'abt_session'

export function readCookie(req: FastifyRequest, name: string) {
  const header = req.headers.cookie ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) {
      try {
        return decodeURIComponent(v.join('='))
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

/** httpOnly (illisible en JavaScript), SameSite=Lax (pas envoyé par un formulaire d'un autre site), Secure en HTTPS. */
export function setCookie(req: FastifyRequest, reply: FastifyReply, name: string, value: string, maxAgeSeconds: number, path = '/api') {
  const attrs = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`]
  if (req.protocol === 'https') attrs.push('Secure')
  const previous = reply.getHeader('set-cookie')
  const list = previous === undefined ? [] : Array.isArray(previous) ? previous.map(String) : [String(previous)]
  reply.header('set-cookie', [...list, attrs.join('; ')])
}

/* ------------------------------------------------------------------ */
/* Sessions côté serveur                                               */
/* ------------------------------------------------------------------ */

/** Durée d'une session : plus courte pour l'administrateur. */
export const SESSION_DAYS: Record<UserRole, number> = { client: 30, admin: 7 }

export type UserRow = typeof users.$inferSelect

export function toAuthUser(u: UserRow): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    role: u.role,
    hasPassword: !!u.passwordHash,
    google: !!u.googleId,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserRow
    sessionId?: string
  }
}

export function createSessions(db: Db, secret: string) {
  return {
    async start(req: FastifyRequest, reply: FastifyReply, user: Pick<UserRow, 'id' | 'role'>) {
      const token = newToken()
      const days = SESSION_DAYS[user.role]
      const id = tokenId(token, secret)
      await db.insert(sessions).values({
        id,
        userId: user.id,
        expiresAt: new Date(Date.now() + days * 86_400_000),
        userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
      })
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
      setCookie(req, reply, SESSION_COOKIE, token, days * 86_400)
      if (readCookie(req, LEGACY_COOKIE)) setCookie(req, reply, LEGACY_COOKIE, '', 0)
      req.sessionId = id
    },

    /** Compte de la session en cours (null si absente, expirée ou révoquée). */
    async read(req: FastifyRequest) {
      const token = readCookie(req, SESSION_COOKIE)
      if (!token || token.length > 100) return null
      const id = tokenId(token, secret)
      const [row] = await db
        .select({ user: users })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
      if (!row) return null
      req.user = row.user
      req.sessionId = id
      return row.user
    },

    async end(req: FastifyRequest, reply: FastifyReply) {
      const token = readCookie(req, SESSION_COOKIE)
      if (token) await db.delete(sessions).where(eq(sessions.id, tokenId(token, secret)))
      setCookie(req, reply, SESSION_COOKIE, '', 0)
    },

    /** Déconnecte tous les appareils du compte (sauf, éventuellement, la session en cours). */
    async revokeAll(userId: string, keep?: string) {
      await db.delete(sessions).where(keep ? and(eq(sessions.userId, userId), ne(sessions.id, keep)) : eq(sessions.userId, userId))
    },
  }
}

export type Sessions = ReturnType<typeof createSessions>
