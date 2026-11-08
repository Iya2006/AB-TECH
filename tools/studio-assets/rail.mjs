// Photos du portant (composant Product Rail Gallery) : vêtement seul, sans le cintre de la photo,
// cadré à l'identique sur une toile portrait 200 × 310 (ici 400 × 620) — le composant dessine ses cintres.
// node rail.mjs <dossier catalogue> <dossier de sortie>
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const [src, out] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const W = 400
const H = 620
const TOP = Math.round(H * 0.05) // l'encolure arrive sous la barre du cintre dessiné
const MODELS = ['tshirt', 'polo', 'sweat', 'pull']

/** Ne garde que la plus grande zone (supprime les restes d'objets voisins). */
function keepLargest(mask, w, h) {
  const label = new Int32Array(w * h)
  let best = 0, bestSize = 0, id = 0
  const stack = []
  for (let s = 0; s < w * h; s++) {
    if (mask[s] < 128 || label[s]) continue
    id++
    let size = 0
    stack.push(s)
    label[s] = id
    while (stack.length) {
      const p = stack.pop()
      size++
      const px = p % w
      for (const q of [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || label[q] || mask[q] < 128) continue
        label[q] = id
        stack.push(q)
      }
    }
    if (size > bestSize) (bestSize = size), (best = id)
  }
  const out = Buffer.alloc(w * h)
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? mask[i] : 0
  return out
}

for (const file of readdirSync(src)) {
  const model = MODELS.find((m) => file === `${m}.webp` || file.startsWith(`${m}-`))
  if (!model || file.endsWith('-mask.png')) continue
  const { data, info } = await sharp(join(src, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const tissue = await sharp(join(src, `${model}-mask.png`)).resize(info.width, info.height).extractChannel(0).raw().toBuffer()
  // ouverture morphologique : crochets et tiges fines (cintre d'origine) disparaissent, le vêtement reste
  const solid = await sharp(tissue, { raw: { width: info.width, height: info.height, channels: 1 } })
    .threshold(128)
    .erode(9)
    .dilate(11)
    .blur(1.5)
    .extractChannel(0)
    .raw()
    .toBuffer()
  const mask = keepLargest(solid, info.width, info.height)
  // Le crochet du cintre dépasse au-dessus du col : en partant du haut, on efface les lignes
  // plus étroites qu'un quart de la largeur du vêtement (le col, la capuche commencent plus bas).
  const rowWidth = (y) => {
    let l = -1, r = -1
    for (let x = 0; x < info.width; x++) if (mask[y * info.width + x] > 128 && data[(y * info.width + x) * 4 + 3] > 128) (l < 0 && (l = x)), (r = x)
    return l < 0 ? 0 : r - l
  }
  let widest = 0
  for (let y = 0; y < info.height; y += 4) widest = Math.max(widest, rowWidth(y))
  let top = 0
  while (top < info.height && rowWidth(top) < widest * 0.25) top++
  for (let i = 0; i < top * info.width; i++) mask[i] = 0
  // alpha × masque du tissu : le cintre photographié disparaît
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0
  for (let i = 0; i < info.width * info.height; i++) {
    const a = Math.round((data[i * 4 + 3] * Math.min(tissue[i], mask[i])) / 255)
    data[i * 4 + 3] = a
    if (a > 24) {
      const x = i % info.width
      const y = (i - x) / info.width
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const scale = Math.min((W * 0.9) / cw, (H * 0.86 - TOP) / ch)
  const piece = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .resize(Math.round(cw * scale), Math.round(ch * scale))
    .png()
    .toBuffer({ resolveWithObject: true })
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece.data, left: Math.round((W - piece.info.width) / 2), top: TOP }])
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(join(out, file))
  console.log(file, `${piece.info.width}×${piece.info.height}`)
}
