import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { mkdirSync } from 'node:fs'
import { createSessions } from './auth'
import type { Db } from './db/client'
import type { Env } from './env'
import { createMailer } from './mail'
import { accountRoutes } from './routes/account'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { publicRoutes } from './routes/public'
import { createStorage, uploadRoot } from './storage'
import { compressJson, serveWeb } from './web'

export async function buildApp(env: Env, db: Db) {
  const app = Fastify({
    logger: env.NODE_ENV === 'production' ? true : { level: 'info' },
    trustProxy: true,
    bodyLimit: 256 * 1024,
  })

  const storage = createStorage(env)

  await app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'same-site' },
    // Pas de CSP quand l'API sert aussi le site (comme avec nginx) : la 3D utilise WebAssembly (décodage des modèles),
    // des images blob:/data:, Cloudinary et les photos de profil Google.
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  })
  // Limite de requêtes pour l'API seulement : une visite charge des dizaines de modèles, textures et photos.
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute', allowList: (req) => !req.url.startsWith('/api/') })
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 } })
  compressJson(app)

  if (storage.driver === 'local') {
    const root = uploadRoot(env)
    mkdirSync(root, { recursive: true })
    await app.register(fastifyStatic, {
      root,
      prefix: '/uploads/',
      maxAge: '30d',
      immutable: true,
      // reply.sendFile reste celui du site construit (serveWeb)
      decorateReply: false,
    })
  }
  if (env.WEB_DIST) await serveWeb(app, env.WEB_DIST)

  app.setErrorHandler((err, req, reply) => {
    const { statusCode, message } = err as { statusCode?: number; message?: string }
    const status = statusCode ?? 500
    if (status >= 500) req.log.error(err)
    reply.code(status).send({ error: status >= 500 ? 'Erreur serveur' : message })
  })

  const sessions = createSessions(db, env.SESSION_SECRET)
  const mailer = createMailer(env)

  await app.register(publicRoutes({ db, storage, sessions }), { prefix: '/api' })
  await app.register(authRoutes({ db, env, sessions, mailer }), { prefix: '/api/auth' })
  await app.register(accountRoutes({ db, storage, sessions }), { prefix: '/api/account' })
  await app.register(adminRoutes({ db, storage, sessions, env, mailer }), { prefix: '/api/admin' })

  return app
}
