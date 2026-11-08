import { z } from 'zod'
import type { Order, Review } from './site'
import type { QuoteRecord } from './quote'

/* ------------------------------------------------------------------ */
/* Comptes et rôles                                                    */
/* ------------------------------------------------------------------ */

/** client : compte créé par le visiteur ; admin : attribué explicitement, jamais à l'inscription. */
export const USER_ROLES = ['client', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Le compte tel que le navigateur le voit (jamais de hash ni de jeton). */
export interface AuthUser {
  id: string
  email: string
  name: string
  phone: string
  avatarUrl: string
  role: UserRole
  /** Faux pour un compte créé avec Google uniquement (il peut en définir un). */
  hasPassword: boolean
  google: boolean
  /** Mot de passe initial (fourni à la livraison) à remplacer avant tout. */
  mustChangePassword: boolean
  createdAt: string
}

/** Réponse de /auth/session : le compte connecté et les moyens de connexion disponibles. */
export interface AuthSession {
  user: AuthUser | null
  providers: { google: boolean; mail: boolean }
}

const email = z.email('Adresse e-mail invalide').max(160).transform((v) => v.trim().toLowerCase())
const honeypot = z.string().max(0).optional()

/** 8 caractères minimum pour tous ; 10 pour un administrateur (contrôlé côté serveur). */
export const PASSWORD_MIN = 8
export const ADMIN_PASSWORD_MIN = 10
const password = z.string().min(PASSWORD_MIN, `${PASSWORD_MIN} caractères minimum`).max(200, '200 caractères maximum')

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(80),
  email,
  password,
  website: honeypot,
})
export type RegisterInput = z.input<typeof registerSchema>

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis').max(200),
})

export const forgotSchema = z.object({ email })

export const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password,
})

const phone = z
  .union([z.literal(''), z.string().trim().min(8, 'Numéro trop court').max(25).regex(/^[+0-9 ().-]+$/, 'Numéro invalide')])
  .default('')

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(80),
  phone,
  avatarUrl: z.string().trim().max(500).default(''),
})
export type ProfileInput = z.input<typeof profileSchema>

/** `current` est absent pour un compte Google qui n'a pas encore de mot de passe. */
export const accountPasswordSchema = z.object({
  current: z.string().max(200).optional(),
  next: password,
})

/** Lien de retour après connexion : chemin interne uniquement (jamais un autre site). */
export function safeNext(next: unknown, fallback = '/compte') {
  if (typeof next !== 'string' || next.length > 300) return fallback
  return /^\/(?![/\\])[^\s]*$/.test(next) ? next : fallback
}

/* ------------------------------------------------------------------ */
/* Espace client                                                       */
/* ------------------------------------------------------------------ */

export interface AccountActivity {
  quotes: QuoteRecord[]
  orders: Order[]
  reviews: Array<Review & { productName: string | null }>
}

/* ------------------------------------------------------------------ */
/* Administration des comptes                                          */
/* ------------------------------------------------------------------ */

export interface AdminUser {
  id: string
  email: string
  name: string
  phone: string
  avatarUrl: string
  role: UserRole
  google: boolean
  hasPassword: boolean
  createdAt: string
  lastLoginAt: string | null
  quotes: number
  orders: number
  reviews: number
}

export interface AuthStatus {
  google: boolean
  /** Adresse à déclarer dans la console Google (« URI de redirection autorisée »). */
  googleRedirectUri: string
  mail: boolean
}
