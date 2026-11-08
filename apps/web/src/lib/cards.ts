import { containImage, drawMark, fitFont, FONT, type PrintImage } from './print'

/**
 * Styles de cartes de visite proposés dans le Studio. Chaque style a une référence fixe,
 * transmise automatiquement avec la demande de devis.
 */

export interface CardData {
  name: string
  title: string
  phone: string
  email: string
  /** Nom de l'entreprise, utilisé si aucun logo n'est importé. */
  brand: string
  logo: PrintImage | null
  base: string
  ink: string
}

export interface CardStyle {
  ref: string
  label: string
  /** Carte en portrait (55 × 85 mm) plutôt qu'en paysage. */
  portrait?: boolean
  /** Couleurs proposées par défaut pour ce style. */
  bases: string[]
  ink: string
}

export const CARD_STYLES: CardStyle[] = [
  { ref: 'CV-01', label: 'Classique', bases: ['#fbfaf7', '#0e0e10', '#e9e4d8', '#1f2a44'], ink: '#0e0e10' },
  { ref: 'CV-02', label: 'Moderne', bases: ['#2563eb', '#0e0e10', '#2f5d50', '#b3262e'], ink: '#ffffff' },
  { ref: 'CV-03', label: 'Minimal', bases: ['#ffffff', '#f2efe8', '#0e0e10', '#dbeafe'], ink: '#0e0e10' },
  { ref: 'CV-04', label: 'Audacieux', bases: ['#ffd400', '#e5007d', '#00a0dc', '#0e0e10'], ink: '#0e0e10' },
  { ref: 'CV-05', label: 'Vertical', portrait: true, bases: ['#0b1b3a', '#fbfaf7', '#0e0e10', '#2f5d50'], ink: '#ffffff' },
  { ref: 'CV-06', label: 'Kraft', bases: ['#c9a97c', '#b48a5a', '#d8c3a0'], ink: '#1c1a17' },
]

export const cardRef = (s: CardStyle) => `${s.ref} · ${s.label}`

type Ctx = CanvasRenderingContext2D

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}
/** Teinte secondaire lisible sur le fond (texte discret, filets). */
const soft = (ink: string) => (lum(ink) > 0.5 ? 'rgba(255,255,255,0.72)' : 'rgba(14,14,16,0.62)')

type Font = (size: number) => string
const sans: Font = (s) => `500 ${s}px ${FONT.sans}`
const bold: Font = (s) => `700 ${s}px ${FONT.sans}`
const semi: Font = (s) => `600 ${s}px ${FONT.sans}`
const serif: Font = (s) => `750 ${Math.round(s * 0.82)}px ${FONT.display}`
const mono: Font = (s) => `500 ${s}px ${FONT.mono}`

function text(ctx: Ctx, value: string, x: number, y: number, size: number, color: string, opts: { font?: Font; align?: CanvasTextAlign; max?: number; spacing?: number } = {}) {
  if (!value) return
  ctx.save()
  const font = opts.font ?? sans
  ctx.font = font(opts.max ? fitFont(ctx, value, font, opts.max, size) : size)
  ctx.fillStyle = color
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = 'alphabetic'
  if (opts.spacing) ctx.letterSpacing = `${opts.spacing}px`
  ctx.fillText(value, x, y)
  ctx.restore()
}

/** Logo client, ou à défaut le symbole + le nom de l'entreprise. */
function brandBlock(ctx: Ctx, d: CardData, x: number, y: number, w: number, h: number, align: 'left' | 'center' = 'left') {
  if (d.logo) {
    ctx.save()
    if (align === 'left') {
      const s = Math.min(w / d.logo.width, h / d.logo.height)
      ctx.drawImage(d.logo, x, y + (h - d.logo.height * s) / 2, d.logo.width * s, d.logo.height * s)
    } else containImage(ctx, d.logo, x, y, w, h)
    ctx.restore()
    return
  }
  const r = h * 0.26
  if (align === 'center') {
    drawMark(ctx, x + w / 2, y + h * 0.34, r, d.ink)
    text(ctx, d.brand, x + w / 2, y + h * 0.92, h * 0.24, d.ink, { font: serif, align: 'center', max: w })
  } else {
    drawMark(ctx, x + r * 1.45, y + h / 2, r, d.ink)
    text(ctx, d.brand, x + r * 3.3, y + h / 2 + h * 0.12, h * 0.36, d.ink, { font: serif, max: w - r * 3.3 })
  }
}

function contacts(ctx: Ctx, d: CardData, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', gap = 1.55) {
  const lines = [d.phone && `Tél. ${d.phone}`, d.email].filter(Boolean) as string[]
  lines.forEach((l, i) => text(ctx, l, x, y + i * size * gap, size, color, { font: mono, align }))
}

/** Dessine une face de carte (recto ou verso) au format du style. */
export function drawCard(ctx: Ctx, w: number, h: number, style: CardStyle, side: 'recto' | 'verso', d: CardData) {
  const m = Math.min(w, h) * 0.11
  const sub = soft(d.ink)
  ctx.save()
  ctx.fillStyle = d.base
  ctx.fillRect(0, 0, w, h)
  switch (style.ref) {
    case 'CV-01': {
      if (side === 'recto') {
        brandBlock(ctx, d, m, m, w * 0.5, h * 0.2)
        text(ctx, d.name, m, h - m - h * 0.14, h * 0.13, d.ink, { font: serif, max: w - m * 2 })
        text(ctx, d.title.toUpperCase(), m, h - m, h * 0.05, sub, { spacing: 3, max: w - m * 2 })
      } else {
        contacts(ctx, d, m, h / 2, h * 0.06, d.ink)
        ctx.fillStyle = d.ink
        ctx.fillRect(m, h / 2 - h * 0.13, w * 0.12, 3)
      }
      break
    }
    case 'CV-02': {
      const band = w * 0.36
      if (side === 'recto') {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(0, 0, band, h)
        brandBlock(ctx, { ...d }, m * 0.7, h / 2 - h * 0.16, band - m * 1.4, h * 0.32, 'center')
        text(ctx, d.name, band + m, h * 0.47, h * 0.105, d.ink, { font: semi, max: w - band - m * 2 })
        text(ctx, d.title, band + m, h * 0.47 + h * 0.1, h * 0.055, sub, { max: w - band - m * 2 })
        contacts(ctx, d, band + m, h - m - h * 0.08, h * 0.048, d.ink)
      } else {
        brandBlock(ctx, d, w * 0.25, h * 0.25, w * 0.5, h * 0.5, 'center')
      }
      break
    }
    case 'CV-03': {
      if (side === 'recto') brandBlock(ctx, d, w * 0.2, h * 0.24, w * 0.6, h * 0.5, 'center')
      else {
        text(ctx, d.name, w / 2, h * 0.42, h * 0.1, d.ink, { font: serif, align: 'center', max: w - m * 2 })
        text(ctx, d.title, w / 2, h * 0.42 + h * 0.09, h * 0.048, sub, { align: 'center', max: w - m * 2 })
        contacts(ctx, d, w / 2, h * 0.72, h * 0.045, d.ink, 'center')
      }
      break
    }
    case 'CV-04': {
      if (side === 'recto') {
        text(ctx, d.name || d.brand, m, h * 0.62, h * 0.2, d.ink, { font: bold, max: w - m * 2 })
        text(ctx, d.title.toUpperCase(), m, h * 0.62 + h * 0.12, h * 0.055, d.ink, { spacing: 4, max: w - m * 2 })
        ctx.fillStyle = d.ink
        ctx.beginPath()
        ctx.arc(w - m * 1.3, m * 1.3, h * 0.07, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = d.ink
        ctx.fillRect(0, 0, w, h)
        const inv = { ...d, ink: d.base }
        brandBlock(ctx, inv, m, m, w * 0.5, h * 0.22)
        contacts(ctx, inv, m, h - m - h * 0.08, h * 0.05, d.base)
      }
      break
    }
    case 'CV-05': {
      if (side === 'recto') {
        brandBlock(ctx, d, m, h * 0.16, w - m * 2, h * 0.22, 'center')
        ctx.fillStyle = sub
        ctx.fillRect(w / 2 - w * 0.08, h * 0.5, w * 0.16, 2)
        text(ctx, d.name, w / 2, h * 0.64, w * 0.1, d.ink, { font: serif, align: 'center', max: w - m * 2 })
        text(ctx, d.title, w / 2, h * 0.64 + w * 0.09, w * 0.05, sub, { align: 'center', max: w - m * 2 })
        contacts(ctx, d, w / 2, h - m * 1.6, w * 0.042, d.ink, 'center')
      } else {
        brandBlock(ctx, d, m, h * 0.3, w - m * 2, h * 0.4, 'center')
      }
      break
    }
    default: {
      // CV-06 Kraft : grain du papier recyclé
      for (let i = 0; i < 2200; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(90,60,30,0.08)' : 'rgba(255,240,210,0.08)'
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
      }
      if (side === 'recto') {
        brandBlock(ctx, d, w * 0.2, h * 0.18, w * 0.6, h * 0.42, 'center')
        text(ctx, d.name, w / 2, h * 0.8, h * 0.075, d.ink, { font: sans, align: 'center', max: w - m * 2 })
      } else {
        text(ctx, d.title, m, m + h * 0.06, h * 0.05, d.ink, { max: w - m * 2 })
        contacts(ctx, d, m, h - m - h * 0.08, h * 0.05, d.ink)
      }
    }
  }
  ctx.restore()
}
