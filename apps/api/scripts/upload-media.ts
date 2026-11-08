/**
 * Envoie les images du site (apps/web/public/media) sur Cloudinary.
 * Elles seront ensuite servies optimisées (format et qualité auto) via
 * https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_.../atelier/site/<nom>
 */
import { v2 as cloudinary } from 'cloudinary'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

if (!process.env.CLOUDINARY_URL) {
  console.error('CLOUDINARY_URL manquant dans .env')
  process.exit(1)
}

cloudinary.config({ secure: true })
const dir = path.resolve(process.cwd(), '../web/public/media')
const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))

for (const file of files) {
  const publicId = path.parse(file).name
  const res = await cloudinary.uploader.upload(path.join(dir, file), {
    folder: 'atelier/site',
    public_id: publicId,
    overwrite: true,
  })
  console.log(`✓ ${file} → ${res.public_id}`)
}
console.log(`\nAjoutez VITE_CLOUDINARY_CLOUD_NAME=${cloudinary.config().cloud_name} dans .env`)
