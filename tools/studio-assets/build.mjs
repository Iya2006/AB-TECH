// Assets finaux du Studio et du catalogue de démo.
// node build.mjs → out/studio/*.jpg|png, out/catalogue/*.webp|png, out/bases.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

mkdirSync('out/studio', { recursive: true })
mkdirSync('out/catalogue', { recursive: true })
const OVR = existsSync('overrides.json') ? JSON.parse(readFileSync('overrides.json', 'utf8')) : {}

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

async function load(id) {
  const img = sharp(`orig/${id}.jpg`)
  const { width, height } = await img.metadata()
  const rgb = await img.removeAlpha().raw().toBuffer()
  const alpha = await sharp(`alpha/${id}.png`).resize(width, height).toColourspace('b-w').raw().toBuffer()
  const cloth = existsSync(`cloth/${id}.png`) ? await sharp(`cloth/${id}.png`).resize(width, height).toColourspace('b-w').raw().toBuffer() : null
  return { width, height, rgb, alpha, cloth }
}

/** Masque vêtement : segmentation (adoucie) × détourage net. */
async function garmentMask({ width, height, alpha, cloth }) {
  if (!cloth) return Buffer.from(alpha)
  // (le flou de sharp repasse en RVB : on reprend un seul canal)
  const soft = await sharp(cloth, { raw: { width, height, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer()
  const m = Buffer.alloc(width * height)
  for (let i = 0; i < m.length; i++) m[i] = Math.round((soft[i] * alpha[i]) / 255)
  return m
}

function bbox(mask, w, h, thr = 128) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x] > thr) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}

function lref(rgb, mask) {
  const vals = []
  for (let i = 0; i < mask.length; i += 3) if (mask[i] > 200) vals.push(lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]))
  vals.sort((a, b) => a - b)
  return vals[Math.floor(vals.length * 0.92)] ?? 1
}

/** Même formule que le moteur du site (src/lib/mockup/engine.ts). */
export function recolor(rgb, mask, n, ref, color) {
  const [cr, cg, cb] = hex(color)
  const dark = 1 - (0.2126 * cr + 0.7152 * cg + 0.0722 * cb)
  const out = Buffer.from(rgb)
  for (let i = 0; i < n; i++) {
    const m = mask[i] / 255
    if (m <= 0) continue
    const s = lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) / ref
    const shade = Math.min(s, 1.08)
    const hl = Math.pow(Math.min(1, Math.max(0, (s - 0.8) / 0.25)), 2) * dark * 0.2
    const v = [cr * shade + hl, cg * shade + hl, cb * shade + hl]
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(rgb[i * 3 + c] * (1 - m) + Math.min(1, v[c]) * 255 * m)
  }
  return out
}

/** Zone d'impression « poitrine » déduite du masque (coordonnées 0–1). */
function chestArea(mask, w, h) {
  const b = bbox(mask, w, h)
  const row = Math.round(b.y0 + b.h * 0.5)
  let l = w, r = 0
  for (let x = 0; x < w; x++) if (mask[row * w + x] > 128) ((l = Math.min(l, x)), (r = Math.max(r, x)))
  const torso = r - l
  const pw = torso * 0.5
  return { x: (l + torso / 2 - pw / 2) / w, y: (b.y0 + b.h * 0.2) / h, w: pw / w, h: (pw * 1.05) / h }
}

function capArea(mask, w, h) {
  const b = bbox(mask, w, h)
  return { x: (b.x0 + b.w * 0.34) / w, y: (b.y0 + b.h * 0.14) / h, w: (b.w * 0.32) / w, h: (b.h * 0.36) / h }
}

/** Efface un petit logo sombre sur un tissu clair : les pixels sombres prennent la teinte claire voisine. */
function erase(buf, W, H, { x, y, w, h, delta = 0.035 }) {
  const [x0, y0, x1, y1] = [x * W, y * H, (x + w) * W, (y + h) * H].map(Math.round)
  const rw = x1 - x0
  const rh = y1 - y0
  const L = new Float32Array(rw * rh)
  for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) {
    const i = ((y0 + yy) * W + x0 + xx) * 3
    L[yy * rw + xx] = lum(buf[i], buf[i + 1], buf[i + 2])
  }
  // pixels plus sombres que le plus clair de leur voisinage (±14 px) = le logo, bords compris
  const R = 14
  const hole = new Uint8Array(rw * rh)
  for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) {
    let mx = 0
    for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
      const a = xx + dx, b = yy + dy
      if (a >= 0 && b >= 0 && a < rw && b < rh && L[b * rw + a] > mx) mx = L[b * rw + a]
    }
    if (L[yy * rw + xx] < mx - delta) hole[yy * rw + xx] = 1
  }
  // dilatation de 3 px, puis rebouchage par diffusion depuis les bords
  const grown = hole.slice()
  for (let yy = 3; yy < rh - 3; yy++) for (let xx = 3; xx < rw - 3; xx++) if (hole[yy * rw + xx]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) grown[(yy + dy) * rw + xx + dx] = 1
  // départ : la teinte moyenne du tissu autour, pour que le lissage converge vite
  const acc = [0, 0, 0]
  let n = 0
  for (let k = 0; k < rw * rh; k++) {
    if (grown[k]) continue
    const i = ((y0 + Math.floor(k / rw)) * W + x0 + (k % rw)) * 3
    for (let c = 0; c < 3; c++) acc[c] += buf[i + c]
    n++
  }
  for (let k = 0; k < rw * rh; k++) {
    if (!grown[k] || !n) continue
    const i = ((y0 + Math.floor(k / rw)) * W + x0 + (k % rw)) * 3
    for (let c = 0; c < 3; c++) buf[i + c] = acc[c] / n
  }
  for (let pass = 0; pass < 400; pass++)
    for (let yy = 1; yy < rh - 1; yy++) for (let xx = 1; xx < rw - 1; xx++) {
      if (!grown[yy * rw + xx]) continue
      const i = ((y0 + yy) * W + x0 + xx) * 3
      for (let c = 0; c < 3; c++) buf[i + c] = (buf[i - 3 + c] + buf[i + 3 + c] + buf[i - W * 3 + c] + buf[i + W * 3 + c]) / 4
    }
}

/** Ne garde que la plus grande zone opaque (supprime les restes d'objets voisins). */
function keepLargest(alpha, w, h) {
  const label = new Int32Array(w * h)
  let best = 0, bestSize = 0, id = 0
  const stack = []
  for (let s = 0; s < w * h; s++) {
    if (alpha[s] < 100 || label[s]) continue
    id++
    let size = 0
    stack.push(s)
    label[s] = id
    while (stack.length) {
      const p = stack.pop()
      size++
      const px = p % w
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || label[q] || alpha[q] < 100) continue
        if ((q === p - 1 && px === 0) || (q === p + 1 && px === w - 1)) continue
        label[q] = id
        stack.push(q)
      }
    }
    if (size > bestSize) (bestSize = size), (best = id)
  }
  for (let i = 0; i < w * h; i++) if (label[i] !== best && alpha[i] >= 100) alpha[i] = 0
}

const BACKDROP = (W, H) =>
  Buffer.from(`<svg width="${W}" height="${H}"><defs>
    <radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#f4f7fb"/><stop offset="1" stop-color="#d9e1ec"/></radialGradient>
  </defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`)

const bases = {}

/* ------------------------------ Personnes ------------------------------ */
const PEOPLE = ['homme-tshirt', 'femme-tshirt', 'homme-polo', 'femme-polo', 'homme-sweat', 'femme-sweat', 'homme-casquette', 'femme-casquette']
for (const id of PEOPLE) {
  const src = await load(id)
  const { width: w, height: h, rgb, alpha } = src
  const mask = await garmentMask(src)
  const person = bbox(alpha, w, h)
  const garment = bbox(mask, w, h)
  const cap = id.endsWith('casquette')
  // Cadrage 4:5 : de la tête au bas du vêtement (ou buste pour la casquette).
  const o = OVR[id] ?? {}
  const top = person.y0 - person.h * 0.05
  const bottom = cap ? garment.y1 + garment.h * 2.6 : garment.y1 + garment.h * 0.06
  let ch = (o.zoom ?? 1) * (bottom - top)
  let cw = ch * 0.8
  const cx = (o.cx ?? 0) * w + (cap ? garment.x0 + garment.w / 2 : garment.x0 + garment.w / 2)
  const crop = { left: Math.round(cx - cw / 2), top: Math.round(top + (o.dy ?? 0) * ch), width: Math.round(cw), height: Math.round(ch) }
  if (crop.width < 50) {
    console.log('cadrage impossible', id, { person, garment, crop })
    continue
  }
  // Personne détourée posée sur un fond studio uni
  const W = 1000
  const H = 1250
  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = rgb[i * 3]
    rgba[i * 4 + 1] = rgb[i * 3 + 1]
    rgba[i * 4 + 2] = rgb[i * 3 + 2]
    rgba[i * 4 + 3] = alpha[i]
  }
  // Agrandit la toile (fond vide) puis recadre : le cadrage peut déborder de la photo.
  const ext = async (buf, ch) => {
    let big = sharp(buf, { raw: { width: w, height: h, channels: ch } }).extend({
      top: h,
      bottom: h,
      left: w,
      right: w,
      background: ch === 4 ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 0, g: 0, b: 0 },
    })
    if (ch === 1) big = big.extractChannel(0) // sharp repasse en RVB sinon
    const out = sharp(await big.raw().toBuffer(), { raw: { width: w * 3, height: h * 3, channels: ch } })
      .extract({ left: crop.left + w, top: crop.top + h, width: crop.width, height: crop.height })
      .resize(W, H)
    return ch === 1 ? out.extractChannel(0) : out
  }
  const personPng = await (await ext(rgba, 4)).png().toBuffer()
  const flat = await sharp(BACKDROP(W, H)).composite([{ input: personPng }]).removeAlpha().raw().toBuffer()
  if (o.erase) erase(flat, W, H, o.erase)
  await sharp(flat, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 86, mozjpeg: true }).toFile(`out/studio/${id}.jpg`)
  const m2raw = await (await ext(Buffer.from(mask), 1)).raw().toBuffer({ resolveWithObject: true })
  const m2 = m2raw.info.channels === 1 ? m2raw.data : Buffer.from(m2raw.data.filter((_, i) => i % m2raw.info.channels === 0))
  await sharp(m2, { raw: { width: W, height: H, channels: 1 } }).png({ compressionLevel: 9 }).toFile(`out/studio/${id}-mask.png`)
  const photo = await sharp(`out/studio/${id}.jpg`).raw().toBuffer()
  bases[id] = { src: `/media/studio/${id}.jpg`, mask: `/media/studio/${id}-mask.png`, width: W, height: H, lref: +lref(photo, m2).toFixed(3), print: o.print ?? (cap ? capArea(m2, W, H) : chestArea(m2, W, H)) }
  console.log(id, bases[id].lref)
}

/* ------------------------------ Produits ------------------------------- */
const GARMENTS = ['p-tshirt', 'p-polo', 'p-sweat', 'p-pull', 'p-casquette', 'p-trucker', 'p-snapback', 'p-tote', 'p-mug', 'p-gourde']
const ALL = [...GARMENTS, 'p-coffret', 'p-portable', 'p-ecran', 'p-clavier', 'p-tour', 'p-casque', 'p-camera-dome', 'p-camera-bullet', 'p-camera-wifi', 'p-extincteur']
for (const id of ALL) {
  const src = await load(id)
  const { width: w, height: h, rgb } = src
  // Pièce photographiée au milieu d'un décor (échelle, jean, baskets) : on ne garde que le vêtement.
  const alpha = OVR[id]?.clothAlpha ? await garmentMask(src) : src.alpha
  if (OVR[id]?.clipX) for (let i = 0; i < w * h; i++) if (i % w > OVR[id].clipX * w) alpha[i] = 0
  if (OVR[id]?.clothAlpha) keepLargest(alpha, w, h)
  const b = bbox(alpha, w, h, 20)
  const pad = Math.round(Math.max(b.w, b.h) * 0.03)
  const box = { left: Math.max(0, b.x0 - pad), top: Math.max(0, b.y0 - pad) }
  box.width = Math.min(w, b.x1 + pad) - box.left
  box.height = Math.min(h, b.y1 + pad) - box.top
  const scale = Math.min(1, 1100 / Math.max(box.width, box.height))
  const W = Math.round(box.width * scale)
  const H = Math.round(box.height * scale)
  const rgba = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = rgb[i * 3]
    rgba[i * 4 + 1] = rgb[i * 3 + 1]
    rgba[i * 4 + 2] = rgb[i * 3 + 2]
    rgba[i * 4 + 3] = alpha[i]
  }
  const cut = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).extract(box).resize(W, H).raw().toBuffer()
  const name = id.slice(2)
  await sharp(cut, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88, alphaQuality: 90 }).toFile(`out/catalogue/${name}.webp`)
  if (!GARMENTS.includes(id)) continue
  const fullMask = await garmentMask(src)
  const mask = await sharp(Buffer.from(fullMask), { raw: { width: w, height: h, channels: 1 } }).extract(box).resize(W, H).toColourspace('b-w').raw().toBuffer()
  await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).png({ compressionLevel: 9 }).toFile(`out/catalogue/${name}-mask.png`)
  const rgb3 = Buffer.alloc(W * H * 3)
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) rgb3[i * 3 + c] = cut[i * 4 + c]
  const o = OVR[id] ?? {}
  const isCap = ['p-casquette', 'p-trucker', 'p-snapback'].includes(id)
  bases[id] = {
    src: `/media/catalogue/${name}.webp`,
    mask: `/media/catalogue/${name}-mask.png`,
    width: W,
    height: H,
    lref: +lref(rgb3, mask).toFixed(3),
    print: { ...(o.print ?? (isCap ? capArea(mask, W, H) : chestArea(mask, W, H))), ...(o.curve ? { curve: o.curve } : {}) },
  }
  // Variantes de couleur pour les produits de démo
  for (const [suffix, color] of Object.entries(o.variants ?? {})) {
    const rec = recolor(rgb3, mask, W * H, bases[id].lref, color)
    const out = Buffer.alloc(W * H * 4)
    for (let i = 0; i < W * H; i++) {
      out[i * 4] = rec[i * 3]
      out[i * 4 + 1] = rec[i * 3 + 1]
      out[i * 4 + 2] = rec[i * 3 + 2]
      out[i * 4 + 3] = cut[i * 4 + 3]
    }
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88, alphaQuality: 90 }).toFile(`out/catalogue/${name}-${suffix}.webp`)
  }
  console.log(id, bases[id].lref)
}
writeFileSync('out/bases.json', JSON.stringify(bases, null, 1))
