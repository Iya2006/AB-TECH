// Recoloration : même formule que le moteur du site (apps/web/src/lib/mockup/engine.ts).
export const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

export function recolor(rgb, mask, n, ref, color) {
  const [cr, cg, cb] = hex(color)
  const dark = 1 - (0.2126 * cr + 0.7152 * cg + 0.0722 * cb)
  const out = Buffer.from(rgb)
  for (let i = 0; i < n; i++) {
    const m = mask[i] / 255
    if (m <= 0) continue
    const s = lum(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) / ref
    const shade = Math.min(s, 1.08)
    const t = Math.min(1, Math.max(0, (s - 0.8) / 0.25))
    const hl = t * t * dark * 0.2
    const v = [cr * shade + hl, cg * shade + hl, cb * shade + hl]
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(rgb[i * 3 + c] * (1 - m) + Math.min(1, v[c]) * 255 * m)
  }
  return out
}
