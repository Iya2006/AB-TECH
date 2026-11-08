import { mediaUrl } from '../lib/media'

/** Image redimensionnée à la volée (Cloudinary) — sinon l'originale. */
export function thumbUrl(url: string, width = 800) {
  if (url.startsWith('/media/')) return mediaUrl(url.slice('/media/'.length), width)
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`)
  return url
}
