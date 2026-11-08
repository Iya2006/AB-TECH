import { randomBytes } from 'node:crypto'

export function slugify(text: string) {
  const base = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'produit'}-${randomBytes(2).toString('hex')}`
}
