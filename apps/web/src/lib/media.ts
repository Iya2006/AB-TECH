const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined

/**
 * URL d'une image du site (dossier public/media).
 * Avec Cloudinary configuré, l'image est servie optimisée (format et qualité automatiques,
 * largeur adaptée) ; sinon elle est servie telle quelle par le site.
 * Envoi des images sur Cloudinary : `pnpm media:upload`.
 */
export function mediaUrl(file: string, width?: number) {
  if (!CLOUD) return `/media/${file}`
  const publicId = file.replace(/\.[a-z0-9]+$/i, '')
  const transform = ['f_auto', 'q_auto', width ? `w_${width}` : null].filter(Boolean).join(',')
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${transform}/atelier/site/${publicId}`
}

export const MEDIA = {
  portrait: 'portrait-vintage.jpg',
  cctv: 'videosurveillance.jpg',
  smoke: 'detecteur-fumee.jpg',
} as const
