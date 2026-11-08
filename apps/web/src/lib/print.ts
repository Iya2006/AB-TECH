/**
 * Dessin du marquage client (logo ou symbole + texte) sur un canvas 2D.
 * Sans dépendance à Three.js : utilisé par le Studio, les maquettes photo et les textures 3D.
 */

export const FONT = {
  display: '"Plus Jakarta Sans Variable", "Inter Tight Variable", system-ui, sans-serif',
  sans: '"Inter Tight Variable", system-ui, sans-serif',
  mono: '"JetBrains Mono Variable", ui-monospace, monospace',
}

type Ctx = CanvasRenderingContext2D
export type PrintImage = CanvasImageSource & { width: number; height: number }

/** Le symbole de la marque : une mire de repérage, l'outil de base de l'imprimeur. */
export function drawMark(ctx: Ctx, cx: number, cy: number, r: number, color: string, lineWidth = r * 0.12) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = lineWidth * 0.7
  ctx.beginPath()
  ctx.moveTo(cx - r * 1.45, cy)
  ctx.lineTo(cx + r * 1.45, cy)
  ctx.moveTo(cx, cy - r * 1.45)
  ctx.lineTo(cx, cy + r * 1.45)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function fitFont(ctx: Ctx, text: string, font: (size: number) => string, maxWidth: number, start: number) {
  let size = start
  ctx.font = font(size)
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size *= 0.92
    ctx.font = font(size)
  }
  return size
}

export function containImage(ctx: Ctx, img: PrintImage, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height)
  const dw = img.width * s
  const dh = img.height * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

/**
 * Le marquage posé sur les produits (T-shirt, mug, casquette, sac…).
 * Logo client s'il est fourni, sinon le symbole ; texte en dessous.
 */
export function drawPrint(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    text: string
    ink: string
    logo?: PrintImage | null
    /** Deuxième ligne, plus petite. */
    sub?: string
    font?: { family: string; weight: number }
    /** Sans logo : la mire de la marque (true, par défaut) ou le texte seul (false). */
    mark?: boolean
  },
) {
  const text = opts.text.trim()
  const sub = opts.sub?.trim() ?? ''
  const art = !!opts.logo || opts.mark !== false
  // sans motif, le texte occupe la zone ; avec un motif, il se place dessous
  const textH = text ? h * (art ? 0.26 : 0.42) : 0
  const subH = sub ? h * (art ? 0.11 : 0.16) : 0
  const gap = (text || sub) && art ? h * 0.06 : 0
  const artH = art ? h - textH - subH - gap : 0
  if (opts.logo) {
    containImage(ctx, opts.logo, x, y, w, artH)
  } else if (art) {
    const r = Math.min(w, artH) * 0.3
    drawMark(ctx, x + w / 2, y + artH / 2, r, opts.ink)
  }
  const family = opts.font?.family ?? FONT.display
  const weight = opts.font?.weight ?? 800
  // bloc de texte centré verticalement dans ce qui reste sous le motif
  const top = art ? y + artH + gap : y + (h - textH - subH) / 2
  ctx.save()
  ctx.fillStyle = opts.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (text) {
    const font = (s: number) => `${weight} ${s}px ${family}`
    ctx.font = font(fitFont(ctx, text, font, w * 0.98, textH * 0.95))
    ctx.fillText(text, x + w / 2, top + textH / 2)
  }
  if (sub) {
    const font = (s: number) => `${Math.min(weight, 600)} ${s}px ${family}`
    ctx.font = font(fitFont(ctx, sub, font, w * 0.9, subH * 0.8))
    ctx.fillText(sub, x + w / 2, top + textH + subH / 2)
  }
  ctx.restore()
}
