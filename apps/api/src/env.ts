import { z } from 'zod'

const optional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined))

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  /** Origines autorisées, séparées par des virgules. Par défaut : l'adresse Render, sinon le site de développement. */
  CORS_ORIGIN: optional,
  /** Adresse publique du site (liens des e-mails, retour de Google). Par défaut : l'adresse Render, sinon la première origine autorisée. */
  PUBLIC_URL: optional,
  /** Fournie par Render : l'adresse publique du service (https://….onrender.com). */
  RENDER_EXTERNAL_URL: optional,
  /**
   * Site construit (apps/web/dist) à servir par l'API elle-même, chemin relatif au dossier de lancement.
   * Hébergement en un seul service (Render) : site et API à la même adresse. Absent : l'API ne sert que /api.
   */
  WEB_DIST: optional,
  /** Clé de signature des sessions et des liens (32 caractères minimum). */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET doit faire au moins 32 caractères'),
  /**
   * Administrateur initial : créé au premier démarrage s'il n'existe aucun administrateur.
   * Ce mot de passe est temporaire : il doit être changé à la première connexion.
   */
  ADMIN_EMAIL: optional.pipe(z.email('ADMIN_EMAIL invalide').optional()),
  ADMIN_PASSWORD: optional.pipe(z.string().min(10, 'ADMIN_PASSWORD doit faire au moins 10 caractères').optional()),
  /** Connexion avec Google (console.cloud.google.com → Identifiants → ID client OAuth « Application Web »). */
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  /** Envoi des e-mails (mot de passe oublié) : smtps://utilisateur:mot-de-passe@smtp.exemple.com:465 */
  SMTP_URL: optional,
  /** Expéditeur, ex. « AB-TECH <contact@exemple.com> » (par défaut : l'utilisateur SMTP). */
  MAIL_FROM: optional,
  /** cloudinary://<api_key>:<api_secret>@<cloud_name> — si absent, stockage local. */
  CLOUDINARY_URL: optional,
  UPLOAD_DIR: z.string().default('uploads'),
})

export type Env = Omit<z.infer<typeof envSchema>, 'CORS_ORIGIN'> & { CORS_ORIGIN: string; publicUrl: string }

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Configuration invalide :\n' + z.prettifyError(parsed.error))
    process.exit(1)
  }
  const env = parsed.data
  const corsOrigin = env.CORS_ORIGIN ?? env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173'
  const publicUrl = (env.PUBLIC_URL ?? env.RENDER_EXTERNAL_URL ?? corsOrigin.split(',')[0]!.trim()).replace(/\/+$/, '')
  return { ...env, CORS_ORIGIN: corsOrigin, publicUrl }
}
