import fastifyStatic from '@fastify/static'
import type { FastifyInstance } from 'fastify'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

/**
 * Hébergement en un seul service (ex. Render) : l'API sert aussi le site construit (apps/web/dist).
 * Site et API partagent ainsi la même adresse : cookie de session simple (SameSite=Lax), aucun CORS.
 */

/** Durée de cache selon le fichier (chemin relatif au site construit). */
function cacheFor(rel: string) {
  // ressources 3D et photos : noms fixes, elles peuvent être mises à jour
  if (rel.startsWith('assets/ph/')) return 'public, max-age=2592000'
  // fichiers produits par Vite : empreinte dans le nom, jamais modifiés
  if (rel.startsWith('assets/')) return 'public, max-age=31536000, immutable'
  if (rel.startsWith('media/')) return 'public, max-age=604800'
  // index.html et le reste : toujours revérifiés (une nouvelle version s'affiche aussitôt)
  return 'no-cache'
}

export async function serveWeb(app: FastifyInstance, dir: string) {
  const root = path.resolve(process.cwd(), dir)
  if (!existsSync(path.join(root, 'index.html'))) {
    app.log.warn({ root }, 'WEB_DIST : site construit introuvable, seule l’API est servie')
    return
  }
  await app.register(fastifyStatic, {
    root,
    prefix: '/',
    // fichiers .br / .gz préparés à la construction (tools/precompress.mjs) : aucun calcul à chaque visite
    preCompressed: true,
    cacheControl: false,
    setHeaders(reply, file) {
      reply.header('Cache-Control', cacheFor(path.relative(root, file).split(path.sep).join('/')))
    },
  })

  // Pages de l'application (/connexion, /compte, /admin…) : c'est index.html qui les affiche.
  app.setNotFoundHandler((req, reply) => {
    const url = req.url.split('?')[0] ?? '/'
    const page = (req.method === 'GET' || req.method === 'HEAD') && !url.startsWith('/api/') && !url.startsWith('/uploads/') && !/\.[a-z0-9]{1,8}$/i.test(url)
    if (!page) return reply.code(404).send({ error: 'Introuvable' })
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html')
  })
}

/** Réponses JSON de l'API compressées (gzip) au-delà de 1 Ko : contenu du site, listes de l'administration. */
export function compressJson(app: FastifyInstance) {
  app.addHook('onSend', async (req, reply, payload) => {
    if (typeof payload !== 'string' || payload.length < 1024) return payload
    if (reply.getHeader('content-encoding') || !/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) return payload
    if (!String(reply.getHeader('content-type') ?? '').includes('application/json')) return payload
    reply.header('Content-Encoding', 'gzip')
    reply.header('Vary', 'Accept-Encoding')
    reply.removeHeader('content-length')
    return gzipSync(payload, { level: 6 })
  })
}
