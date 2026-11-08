import { v2 as cloudinary } from 'cloudinary'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Env } from './env'

/** logo / mockup : joints aux devis ; media : images gérées dans l'espace pro ; avatar : photos de profil. */
export type UploadKind = 'logo' | 'mockup' | 'media' | 'avatar'

export interface ImageType {
  ext: 'png' | 'jpg' | 'webp'
  mime: string
}

/** Détecte le format réel à partir des premiers octets — on ne fait jamais confiance au mimetype envoyé. */
export function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { ext: 'png', mime: 'image/png' }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return { ext: 'webp', mime: 'image/webp' }
  return null
}

export interface Storage {
  driver: 'cloudinary' | 'local'
  save(buf: Buffer, type: ImageType, kind: UploadKind): Promise<string>
  /** Vrai si l'URL a été produite par ce stockage (empêche d'injecter des liens arbitraires dans les devis). */
  owns(url: string): boolean
}

const FOLDER = 'atelier/devis'

function cloudinaryStorage(): Storage {
  // Le SDK lit CLOUDINARY_URL tout seul.
  cloudinary.config({ secure: true })
  const cloudName = cloudinary.config().cloud_name
  return {
    driver: 'cloudinary',
    save(buf, _type, kind) {
      return new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { folder: `${FOLDER}/${kind}`, resource_type: 'image', overwrite: false },
            (err, res) => (err || !res ? reject(err ?? new Error('Upload échoué')) : resolve(res.secure_url)),
          )
          .end(buf)
      })
    },
    owns: (url) => url.startsWith(`https://res.cloudinary.com/${cloudName}/image/upload/`),
  }
}

function localStorage(dir: string): Storage {
  const root = path.resolve(process.cwd(), dir)
  return {
    driver: 'local',
    async save(buf, type, kind) {
      const folder = path.join(root, kind)
      await mkdir(folder, { recursive: true })
      const name = `${randomUUID()}.${type.ext}`
      await writeFile(path.join(folder, name), buf)
      return `/uploads/${kind}/${name}`
    },
    owns: (url) => /^\/uploads\/(logo|mockup|media|avatar)\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(url),
  }
}

export function createStorage(env: Env): Storage {
  return env.CLOUDINARY_URL ? cloudinaryStorage() : localStorage(env.UPLOAD_DIR)
}

export function uploadRoot(env: Env) {
  return path.resolve(process.cwd(), env.UPLOAD_DIR)
}
