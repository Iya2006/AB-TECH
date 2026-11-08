import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { orders, passwordResets, quoteRequests, sessions, users } from './db/schema'
import { newToken, tokenId, type UserRow } from './auth'

/** Durées de validité des liens de réinitialisation. */
export const RESET_MINUTES = { email: 60, admin: 24 * 60 }

/** Crée un lien de réinitialisation (le précédent, s'il n'a pas servi, cesse de fonctionner). */
export async function createResetLink(db: Db, secret: string, publicUrl: string, userId: string, minutes: number) {
  const token = newToken()
  await db.delete(passwordResets).where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)))
  const expiresAt = new Date(Date.now() + minutes * 60_000)
  await db.insert(passwordResets).values({ id: tokenId(token, secret), userId, expiresAt })
  return { url: `${publicUrl}/reinitialiser?token=${token}`, expiresAt }
}

/** Lien encore valable : jamais utilisé, pas expiré. */
export async function findReset(db: Db, secret: string, token: string) {
  const [row] = await db
    .select({ id: passwordResets.id, user: users })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(and(eq(passwordResets.id, tokenId(token, secret)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
  return row ?? null
}

/**
 * Rattache au compte les devis et commandes envoyés avant la création des comptes, avec la même adresse.
 * Appelé seulement quand la propriété de l'adresse est prouvée (Google ou lien reçu par e-mail).
 */
export async function claimRecords(db: Db, user: Pick<UserRow, 'id' | 'email'>) {
  const email = user.email.toLowerCase()
  await db.update(quoteRequests).set({ userId: user.id }).where(and(isNull(quoteRequests.userId), sql`lower(${quoteRequests.email}) = ${email}`))
  await db.update(orders).set({ userId: user.id }).where(and(isNull(orders.userId), sql`lower(${orders.email}) = ${email}`))
}

export interface GoogleProfile {
  sub: string
  email: string
  name: string
  picture: string
}

/** Retrouve ou crée le compte interne correspondant à l'identité Google (toujours CLIENT à la création). */
export async function upsertGoogleUser(db: Db, g: GoogleProfile): Promise<UserRow> {
  const email = g.email.toLowerCase()
  const [byGoogle] = await db.select().from(users).where(eq(users.googleId, g.sub))
  if (byGoogle) {
    // l'adresse peut avoir changé chez Google : on garde la nôtre, on complète seulement ce qui manque
    const patch: Partial<UserRow> = {}
    if (!byGoogle.avatarUrl && g.picture) patch.avatarUrl = g.picture
    if (!byGoogle.name && g.name) patch.name = g.name
    if (Object.keys(patch).length) await db.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, byGoogle.id))
    return { ...byGoogle, ...patch }
  }

  const [byEmail] = await db.select().from(users).where(eq(users.email, email))
  if (byEmail) {
    // Google prouve que la personne possède cette adresse : on relie les deux.
    const patch: Partial<UserRow> = { googleId: g.sub, emailVerified: true, updatedAt: new Date() }
    if (!byEmail.avatarUrl && g.picture) patch.avatarUrl = g.picture
    if (!byEmail.name && g.name) patch.name = g.name
    if (!byEmail.emailVerified && byEmail.passwordHash) {
      // Protection contre le « pré-détournement » : quelqu'un a pu créer ce compte avec l'adresse d'un autre.
      // Le mot de passe jamais vérifié est retiré et les sessions ouvertes sont fermées.
      patch.passwordHash = null
      await db.delete(sessions).where(eq(sessions.userId, byEmail.id))
    }
    await db.update(users).set(patch).where(eq(users.id, byEmail.id))
    return { ...byEmail, ...patch } as UserRow
  }

  const [created] = await db
    .insert(users)
    .values({ email, emailVerified: true, name: g.name || email.split('@')[0]!, avatarUrl: g.picture, googleId: g.sub, role: 'client' })
    .returning()
  return created!
}

/** Ménage : sessions expirées, liens utilisés ou expirés. */
export async function purgeExpired(db: Db) {
  const now = new Date()
  await db.delete(sessions).where(lt(sessions.expiresAt, now))
  await db.delete(passwordResets).where(or(lt(passwordResets.expiresAt, now), sql`${passwordResets.usedAt} is not null`))
}
