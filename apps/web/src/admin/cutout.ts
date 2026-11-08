/**
 * Détourage automatique d'une photo produit prise sur fond uni (mur blanc, drap, carton…) :
 * le fond, propagé depuis les bords, devient transparent. Tout se passe dans le navigateur.
 */

export class CutoutError extends Error {}

function load(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new CutoutError('Image illisible.'))
    img.src = url
  })
}

export async function removeBackground(url: string): Promise<File> {
  const img = await load(url)
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data

  // Couleur du fond : moyenne des bords ; s'ils sont trop variés, le fond n'est pas uni.
  const border: number[] = []
  for (let x = 0; x < w; x += 2) border.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y += 2) border.push(y * w, y * w + w - 1)
  const mean = [0, 0, 0]
  for (const i of border) for (let c = 0; c < 3; c++) mean[c]! += px[i * 4 + c]!
  for (let c = 0; c < 3; c++) mean[c]! /= border.length
  const dist = (i: number) => Math.hypot(px[i * 4]! - mean[0]!, px[i * 4 + 1]! - mean[1]!, px[i * 4 + 2]! - mean[2]!)
  const spread = border.reduce((s, i) => s + dist(i), 0) / border.length
  if (spread > 38) throw new CutoutError('Le fond de cette photo n’est pas uni : détourage automatique impossible.')
  const tol = Math.min(60, Math.max(26, spread * 2.5 + 22))
  // Écart toléré d'un pixel à son voisin : un fond varie doucement, le contour d'un produit coupe net.
  const STEP = 5
  const step = (p: number, q: number) =>
    Math.abs(px[p * 4]! - px[q * 4]!) + Math.abs(px[p * 4 + 1]! - px[q * 4 + 1]!) + Math.abs(px[p * 4 + 2]! - px[q * 4 + 2]!) < STEP * 3

  // Propagation depuis les bords : ce qui ressemble au fond, y est relié et sans contour franc.
  const bg = new Uint8Array(w * h)
  const stack: number[] = []
  for (const i of border) if (dist(i) < tol) (bg[i] = 1), stack.push(i)
  while (stack.length) {
    const p = stack.pop()!
    const x = p % w
    const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]
    for (const q of next) {
      if (q < 0 || q >= w * h || bg[q] || dist(q) >= tol || !step(p, q)) continue
      bg[q] = 1
      stack.push(q)
    }
  }

  // Alpha avec bord adouci (moyenne 3×3), puis recadrage serré.
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      let s = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += bg[i + dy * w + dx]!
      const a = Math.round(255 * (1 - s / 9))
      px[i * 4 + 3] = a
      if (a > 20) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  if (x1 - x0 < w * 0.08 || y1 - y0 < h * 0.08) throw new CutoutError('Aucun produit détecté sur la photo.')
  for (let x = 0; x < w; x++) (px[x * 4 + 3] = 0), (px[((h - 1) * w + x) * 4 + 3] = 0)
  for (let y = 0; y < h; y++) (px[y * w * 4 + 3] = 0), (px[(y * w + w - 1) * 4 + 3] = 0)
  ctx.putImageData(data, 0, 0)

  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03)
  const cx = Math.max(0, x0 - pad)
  const cy = Math.max(0, y0 - pad)
  const cw = Math.min(w, x1 + pad) - cx
  const chh = Math.min(h, y1 + pad) - cy
  const out = document.createElement('canvas')
  out.width = cw
  out.height = chh
  out.getContext('2d')!.drawImage(canvas, cx, cy, cw, chh, 0, 0, cw, chh)
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'))
  if (!blob) throw new CutoutError('Export impossible.')
  return new File([blob], 'produit-detoure.png', { type: 'image/png' })
}
