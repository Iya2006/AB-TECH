import * as THREE from 'three'
import { BRAND } from '../config/brand'
import { drawMark, FONT } from '../lib/print'
import { CANVAS_SCALE } from './mobileTextures'

export { drawMark, drawPrint, FONT, type PrintImage } from '../lib/print'

/**
 * Tous les visuels « imprimés » de l'atelier sont dessinés ici, au nom de la marque :
 * enseigne, affiches, cartes de visite, kakémonos, écrans… Changer BRAND suffit à tout mettre à jour.
 */

export const COLORS = {
  paper: '#f4f1ea',
  paper2: '#e9e4d8',
  ink: '#0e0e10',
  graphite: '#6b6963',
  cyan: '#00a0dc',
  magenta: '#e5007d',
  yellow: '#ffd400',
  kraft: '#c9a97c',
  accent: '#2563eb',
  accentLight: '#60a5fa',
  navy: '#0b1b3a',
}

type Ctx = CanvasRenderingContext2D
type Draw = (ctx: Ctx, w: number, h: number) => void

export function createCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

export function toTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  // Three.js plafonne à la valeur max du GPU : textes et affiches restent nets vus de biais.
  tex.anisotropy = 16
  return tex
}

/** Dessinée en `w × h` (unités du dessin) ; en demi-résolution sur les appareils modestes (voir mobileTextures). */
export function canvasTexture(w: number, h: number, draw: Draw) {
  const canvas = createCanvas(Math.max(1, Math.round(w * CANVAS_SCALE)), Math.max(1, Math.round(h * CANVAS_SCALE)))
  const ctx = canvas.getContext('2d')!
  if (CANVAS_SCALE !== 1) ctx.scale(CANVAS_SCALE, CANVAS_SCALE)
  draw(ctx, w, h)
  return toTexture(canvas)
}

const cache = new Map<string, THREE.Texture>()
/** Texture statique mise en cache (partagée entre toutes les instances). */
export function cachedTexture(key: string, w: number, h: number, draw: Draw) {
  let tex = cache.get(key)
  if (!tex) {
    tex = canvasTexture(w, h, draw)
    cache.set(key, tex)
  }
  return tex
}

/* ------------------------------------------------------------------ */
/* Briques graphiques                                                  */
/* ------------------------------------------------------------------ */

/** Le nom de la marque : première partie droite, seconde en italique. Renvoie la largeur. */
export function drawWordmark(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'center',
) {
  const [a, b] = BRAND.nameParts
  // « AB- » extra-gras, « TECH » plus léger : un logotype moderne et lisible de loin
  const upright = `800 ${Math.round(size * 0.78)}px ${FONT.display}`
  const italic = `500 ${Math.round(size * 0.78)}px ${FONT.display}`
  ctx.save()
  ctx.font = upright
  const wa = ctx.measureText(a).width
  ctx.font = italic
  const wb = ctx.measureText(b).width
  const total = wa + wb
  const sx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = upright
  ctx.fillText(a, sx, y)
  ctx.font = italic
  ctx.fillText(b, sx + wa, y)
  ctx.restore()
  return total
}

function mono(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.save()
  ctx.font = `500 ${size}px ${FONT.mono}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.letterSpacing = `${size * 0.12}px`
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.restore()
}

function colorBar(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const colors = [COLORS.cyan, COLORS.magenta, COLORS.yellow, COLORS.ink]
  colors.forEach((c, i) => {
    ctx.fillStyle = c
    ctx.fillRect(x + (w / 4) * i, y, w / 4, h)
  })
}

/* ------------------------------------------------------------------ */
/* Visuels de l'atelier                                                */
/* ------------------------------------------------------------------ */

export const signTexture = () =>
  cachedTexture('sign', 2048, 320, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const color = '#ffffff'
    ctx.font = `750 148px ${FONT.display}`
    const size = 190
    // mesure pour centrer le bloc symbole + nom
    ctx.save()
    const tmp = createCanvas(1, 1).getContext('2d')!
    const textW = drawWordmark(tmp, 0, 0, size, color, 'left')
    ctx.restore()
    const r = 62
    const gap = 70
    const total = r * 2.9 + gap + textW
    const sx = (w - total) / 2
    drawMark(ctx, sx + r * 1.45, h / 2 - 8, r, color, 9)
    drawWordmark(ctx, sx + r * 2.9 + gap, h / 2 + 58, size, color, 'left')
  })

export const subSignTexture = () =>
  cachedTexture('subsign', 2048, 96, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.font = `700 40px ${FONT.sans}`
    ctx.letterSpacing = '8px'
    ctx.fillStyle = '#bcd3ff'
    ctx.textAlign = 'center'
    ctx.fillText('IMPRESSION · BRANDING · PERSONNALISATION · INFORMATIQUE · SÉCURITÉ', w / 2, h * 0.68)
  })

/** Bandeau adhésif posé sur la vitrine : bande bleu nuit, texte blanc (lisible devant l'intérieur clair). */
export const vinylTexture = (text: string) =>
  cachedTexture(`vinyl-${text}`, 2048, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(10,16,32,0.88)'
    ctx.beginPath()
    ctx.roundRect(0, 18, w, h - 36, 20)
    ctx.fill()
    ctx.fillStyle = COLORS.accent
    ctx.fillRect(0, h - 26, w, 8)
    ctx.font = `700 64px ${FONT.display}`
    ctx.letterSpacing = '8px'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 - 2)
  })

/** Enseigne « OUVERT » façon néon. */
export const openSignTexture = () =>
  cachedTexture('open-sign', 512, 192, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = '#7dd3fc'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.roundRect(14, 14, w - 28, h - 28, 40)
    ctx.stroke()
    ctx.font = `800 96px ${FONT.display}`
    ctx.letterSpacing = '10px'
    ctx.fillStyle = '#e0f2fe'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('OUVERT', w / 2 + 5, h / 2 + 4)
  })

/** Diapositives de l'écran de vitrine : les prestations défilent. */
export const SCREEN_SLIDES = [
  { kicker: 'Impression', title: ['Affiches,', 'flyers & cartes'], from: '#2563eb', to: '#22b8f0' },
  { kicker: 'Textile', title: ['T-shirts, polos', '& casquettes'], from: '#0a1020', to: '#2563eb' },
  { kicker: 'Objets', title: ['Mugs, sacs', '& cadeaux'], from: '#e5007d', to: '#7c3aed' },
  { kicker: 'Informatique', title: ['Ordinateurs', '& accessoires'], from: '#111a2e', to: '#0ea5e9' },
  { kicker: 'Sécurité', title: ['Vidéosurveillance', '& incendie'], from: '#0f172a', to: '#dc2626' },
]

export function drawScreenSlide(ctx: Ctx, w: number, h: number, index: number) {
  const s = SCREEN_SLIDES[index % SCREEN_SLIDES.length]!
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, s.from)
  g.addColorStop(1, s.to)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // motif : grands cercles concentriques (repère de l'imprimeur)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 3
  for (let i = 1; i <= 6; i++) {
    ctx.beginPath()
    ctx.arc(w * 0.85, h * 0.18, i * 70, 0, Math.PI * 2)
    ctx.stroke()
  }
  drawMark(ctx, 90, 96, 34, '#ffffff', 6)
  ctx.font = `700 34px ${FONT.sans}`
  ctx.letterSpacing = '6px'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText(s.kicker.toUpperCase(), 60, h * 0.6)
  ctx.letterSpacing = '0px'
  ctx.font = `800 88px ${FONT.display}`
  ctx.fillStyle = '#ffffff'
  s.title.forEach((line, i) => ctx.fillText(line, 56, h * 0.6 + 100 + i * 96))
  ctx.font = `600 30px ${FONT.sans}`
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(BRAND.name, 60, h - 60)
  // indicateur de diapositive
  SCREEN_SLIDES.forEach((_, i) => {
    ctx.fillStyle = i === index % SCREEN_SLIDES.length ? '#ffffff' : 'rgba(255,255,255,0.3)'
    ctx.fillRect(w - 60 - (SCREEN_SLIDES.length - i) * 34, h - 72, 24, 6)
  })
}

export const techSignTexture = () =>
  cachedTexture('techsign', 1024, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    mono(ctx, 'Boutique Tech', w / 2, h * 0.72, 72, '#ffffff', 'center')
  })

export const POSTER_COUNT = 4
export const posterTexture = (variant: number) =>
  cachedTexture(`poster-${variant}`, 724, 1024, (ctx, w, h) => {
    const m = 48
    if (variant === 0) {
      ctx.fillStyle = COLORS.yellow
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = COLORS.ink
      ctx.beginPath()
      ctx.arc(w * 0.5, h * 0.4, w * 0.3, 0, Math.PI * 2)
      ctx.fill()
      drawMark(ctx, w * 0.5, h * 0.4, w * 0.12, COLORS.yellow, 7)
      ctx.font = `750 131px ${FONT.display}`
      ctx.fillStyle = COLORS.ink
      ctx.fillText('Affiches', m, h - 150)
      mono(ctx, 'A0 · A1 · A2 · A3 — Quadrichromie', m, h - 80, 22, COLORS.ink)
      mono(ctx, BRAND.name, m, m + 18, 22, COLORS.ink)
      mono(ctx, 'Grand format', w - m, m + 18, 22, COLORS.ink, 'right')
    } else if (variant === 1) {
      ctx.fillStyle = COLORS.magenta
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 5; i++) {
        ctx.save()
        ctx.translate(w * 0.5, h * 0.42)
        ctx.rotate(-0.32 + i * 0.16)
        ctx.fillStyle = i === 4 ? COLORS.paper : `rgba(244,241,234,${0.25 + i * 0.12})`
        ctx.fillRect(-150, -210, 300, 420)
        ctx.restore()
      }
      drawMark(ctx, w * 0.5 + 40, h * 0.42 - 30, 56, COLORS.magenta, 6)
      ctx.font = `800 134px ${FONT.display}`
      ctx.fillStyle = COLORS.paper
      ctx.fillText('Flyers', m, h - 150)
      mono(ctx, 'A6 · A5 · A4 — Recto / verso', m, h - 80, 22, COLORS.paper)
      mono(ctx, BRAND.name, m, m + 18, 22, COLORS.paper)
    } else if (variant === 2) {
      ctx.fillStyle = COLORS.cyan
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = COLORS.paper
      for (let i = 0; i < 9; i++) {
        ctx.lineWidth = 2 + i * 0.6
        ctx.beginPath()
        ctx.arc(w * 0.62, h * 0.38, 40 + i * 36, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.font = `750 100px ${FONT.display}`
      ctx.fillStyle = COLORS.ink
      ctx.fillText('Vos événements,', m, h - 230)
      ctx.font = `800 100px ${FONT.display}`
      ctx.fillText('en grand.', m, h - 120)
      mono(ctx, 'Kakémonos · Photocalls · Banderoles', m, h - 60, 20, COLORS.ink)
      mono(ctx, BRAND.name, m, m + 18, 22, COLORS.ink)
    } else {
      ctx.fillStyle = COLORS.ink
      ctx.fillRect(0, 0, w, h)
      drawMark(ctx, w / 2, h * 0.36, 120, COLORS.paper, 10)
      drawWordmark(ctx, w / 2, h * 0.68, 110, COLORS.paper)
      mono(ctx, BRAND.tagline, w / 2, h * 0.68 + 70, 22, '#bdb7aa', 'center')
      colorBar(ctx, m, h - m - 14, w - m * 2, 14)
    }
  })

export type CardVariant = 'paper' | 'ink' | 'kraft' | 'magenta'
export const cardFrontTexture = (variant: CardVariant) =>
  cachedTexture(`card-front-${variant}`, 850, 550, (ctx, w, h) => {
    const bg = { paper: COLORS.paper, ink: COLORS.ink, kraft: COLORS.kraft, magenta: COLORS.magenta }[variant]
    const fg = variant === 'paper' || variant === 'kraft' ? COLORS.ink : COLORS.paper
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    if (variant === 'ink' || variant === 'magenta') {
      drawMark(ctx, w / 2, h * 0.4, 70, fg, 8)
      drawWordmark(ctx, w / 2, h * 0.8, 74, fg)
    } else {
      drawMark(ctx, 110, 120, 44, fg, 6)
      drawWordmark(ctx, 70, h - 90, 96, fg, 'left')
      ctx.fillStyle = COLORS.magenta
      ctx.beginPath()
      ctx.arc(w - 80, h - 110, 14, 0, Math.PI * 2)
      ctx.fill()
    }
  })

export const cardBackTexture = () =>
  cachedTexture('card-back', 850, 550, (ctx, w, h) => {
    ctx.fillStyle = COLORS.paper
    ctx.fillRect(0, 0, w, h)
    const { phones, email } = BRAND
    ctx.font = `750 50px ${FONT.display}`
    ctx.fillStyle = COLORS.ink
    ctx.fillText('Service client', 70, 150)
    phones.forEach((p, i) => mono(ctx, `Tél. ${p}`, 70, 250 + i * 50, 26, COLORS.ink))
    mono(ctx, email, 70, 250 + phones.length * 50, 26, COLORS.ink)
    colorBar(ctx, 70, h - 80, 240, 12)
  })

export const flyerTexture = () =>
  cachedTexture('flyer', 512, 724, (ctx, w, h) => {
    ctx.fillStyle = COLORS.paper
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = COLORS.yellow
    ctx.fillRect(0, 0, w, h * 0.52)
    drawMark(ctx, w * 0.72, h * 0.26, 80, COLORS.ink, 8)
    ctx.font = `750 72px ${FONT.display}`
    ctx.fillStyle = COLORS.ink
    ctx.fillText('Imprimez', 36, h * 0.66)
    ctx.font = `800 72px ${FONT.display}`
    ctx.fillText('vos idées.', 36, h * 0.66 + 88)
    mono(ctx, BRAND.name, 36, h - 40, 18, COLORS.ink)
  })

export const ROLLUP_COUNT = 3
export const rollupTexture = (variant: number) =>
  cachedTexture(`rollup-${variant}`, 512, 1206, (ctx, w, h) => {
    const m = 40
    if (variant === 0) {
      ctx.fillStyle = COLORS.ink
      ctx.fillRect(0, 0, w, h)
      drawWordmark(ctx, w / 2, 130, 70, COLORS.paper)
      ctx.font = `750 81px ${FONT.display}`
      ctx.fillStyle = COLORS.paper
      ctx.fillText('Impression', m, h * 0.5)
      ctx.font = `800 81px ${FONT.display}`
      ctx.fillStyle = COLORS.yellow
      ctx.fillText('& branding', m, h * 0.5 + 100)
      colorBar(ctx, m, h - 160, w - m * 2, 16)
      mono(ctx, BRAND.phones[0] ?? '', m, h - 90, 22, COLORS.paper)
    } else if (variant === 1) {
      ctx.fillStyle = COLORS.paper
      ctx.fillRect(0, 0, w, h)
      drawMark(ctx, w / 2, h * 0.33, 150, COLORS.ink, 14)
      ctx.font = `750 72px ${FONT.display}`
      ctx.fillStyle = COLORS.ink
      ctx.textAlign = 'center'
      ctx.fillText('Votre marque,', w / 2, h * 0.62)
      ctx.font = `800 72px ${FONT.display}`
      ctx.fillStyle = COLORS.magenta
      ctx.fillText('partout.', w / 2, h * 0.62 + 92)
      drawWordmark(ctx, w / 2, h - 90, 54, COLORS.ink)
    } else {
      ctx.fillStyle = COLORS.magenta
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = `rgba(14,14,16,${0.06 + (i % 3) * 0.04})`
        ctx.fillRect(0, i * 90, w, 44)
      }
      ctx.font = `800 94px ${FONT.display}`
      ctx.fillStyle = COLORS.paper
      ctx.fillText('Textile', m, h * 0.36)
      ctx.fillText('Objets', m, h * 0.36 + 120)
      ctx.fillText('Cadeaux', m, h * 0.36 + 240)
      drawWordmark(ctx, w / 2, h - 90, 54, COLORS.paper)
    }
  })

export const flagTexture = (variant: number) =>
  cachedTexture(`flag-${variant}`, 384, 1024, (ctx, w, h) => {
    ctx.fillStyle = variant === 0 ? COLORS.ink : COLORS.yellow
    ctx.fillRect(0, 0, w, h)
    const fg = variant === 0 ? COLORS.paper : COLORS.ink
    ctx.save()
    ctx.translate(w * 0.62, h * 0.55)
    ctx.rotate(-Math.PI / 2)
    drawWordmark(ctx, 0, 0, 120, fg)
    ctx.restore()
    drawMark(ctx, w * 0.45, 150, 56, fg, 7)
  })

export const photocallTexture = () =>
  cachedTexture('photocall', 2048, 960, (ctx, w, h) => {
    ctx.fillStyle = COLORS.paper
    ctx.fillRect(0, 0, w, h)
    const cols = 5
    const rows = 5
    const cw = w / cols
    const rh = h / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + (r % 2 ? cw / 2 : 0)
        const y = r * rh + rh / 2
        if ((r + c) % 2 === 0) {
          drawMark(ctx, x + cw * 0.5, y, 34, (r * cols + c) % 7 === 0 ? COLORS.magenta : COLORS.ink, 5)
        } else {
          drawWordmark(ctx, x + cw * 0.5, y + 18, 54, COLORS.ink)
        }
      }
    }
  })

export const productBoxTexture = (label: string, tone: 'ink' | 'paper') =>
  cachedTexture(`box-${label}-${tone}`, 256, 256, (ctx, w, h) => {
    const bg = tone === 'ink' ? COLORS.ink : COLORS.paper2
    const fg = tone === 'ink' ? COLORS.paper : COLORS.ink
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    drawMark(ctx, 46, 50, 16, fg, 3)
    mono(ctx, label, 24, h - 54, 20, fg)
    colorBar(ctx, 24, h - 34, 90, 6)
  })

/** Sol en béton ciré, très légèrement texturé. */
export const concreteTexture = () => {
  const tex = cachedTexture('concrete', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = 60 + Math.random() * 140
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(120,110,95,${0.05 + Math.random() * 0.05})`)
      g.addColorStop(1, 'rgba(120,110,95,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(60,55,50,${Math.random() * 0.08})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4)
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/* ------------------------------------------------------------------ */
/* Écrans                                                              */
/* ------------------------------------------------------------------ */

export type ScreenVariant = 'design' | 'shop' | 'cctv' | 'phone'
export const screenTexture = (variant: ScreenVariant) =>
  cachedTexture(`screen-${variant}`, 1024, 640, (ctx, w, h) => {
    if (variant === 'design') {
      ctx.fillStyle = '#1b1b1f'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#26262c'
      ctx.fillRect(0, 0, w, 44)
      ctx.fillRect(0, 44, 70, h)
      ctx.fillRect(w - 220, 44, 220, h)
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#3a3a42'
        ctx.fillRect(18, 70 + i * 52, 34, 34)
      }
      ctx.fillStyle = COLORS.paper
      ctx.fillRect(110, 80, w - 370, h - 120)
      drawMark(ctx, 110 + (w - 370) / 2, 250, 70, COLORS.ink, 9)
      drawWordmark(ctx, 110 + (w - 370) / 2, 430, 74, COLORS.ink)
      ;[COLORS.cyan, COLORS.magenta, COLORS.yellow, COLORS.ink].forEach((c, i) => {
        ctx.fillStyle = c
        ctx.fillRect(w - 200, 80 + i * 60, 40, 40)
        mono(ctx, ['C 100', 'M 100', 'J 100', 'N 100'][i]!, w - 148, 108 + i * 60, 16, '#c9c6bd')
      })
    } else if (variant === 'shop') {
      ctx.fillStyle = COLORS.paper
      ctx.fillRect(0, 0, w, h)
      drawWordmark(ctx, 40, 62, 40, COLORS.ink, 'left')
      ctx.fillStyle = COLORS.ink
      ctx.fillRect(w - 180, 30, 140, 40)
      const tones = ['#1d1d22', '#d9d4c7', '#2c3e50', '#c7c2b6', '#16161a', '#e5e0d4']
      for (let i = 0; i < 6; i++) {
        const x = 40 + (i % 3) * 320
        const y = 110 + Math.floor(i / 3) * 255
        ctx.fillStyle = '#ebe6da'
        ctx.fillRect(x, y, 300, 180)
        ctx.fillStyle = tones[i]!
        ctx.fillRect(x + 70, y + 40, 160, 100)
        ctx.fillStyle = COLORS.ink
        ctx.fillRect(x, y + 196, 180, 14)
        ctx.fillStyle = COLORS.graphite
        ctx.fillRect(x, y + 218, 110, 10)
      }
    } else if (variant === 'cctv') {
      ctx.fillStyle = '#0b0d10'
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 4; i++) {
        const x = 16 + (i % 2) * (w / 2)
        const y = 16 + Math.floor(i / 2) * (h / 2)
        const g = ctx.createLinearGradient(x, y, x, y + h / 2)
        g.addColorStop(0, ['#8fa3b8', '#a89c86', '#93a7b5', '#a39e93'][i]!)
        g.addColorStop(1, '#3b4552')
        ctx.fillStyle = g
        ctx.fillRect(x, y, w / 2 - 32, h / 2 - 32)
        // silhouettes de mobilier, sol en perspective
        ctx.fillStyle = 'rgba(20,28,38,0.35)'
        ctx.beginPath()
        ctx.moveTo(x, y + h / 2 - 32)
        ctx.lineTo(x + 120, y + 150)
        ctx.lineTo(x + w / 2 - 152, y + 150)
        ctx.lineTo(x + w / 2 - 32, y + h / 2 - 32)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(x + 60 + i * 30, y + 110, 90, 70)
        ctx.fillRect(x + 260 - i * 20, y + 90, 60, 100)
        mono(ctx, `Cam 0${i + 1}`, x + 14, y + 30, 16, '#9fe7ff')
        ctx.fillStyle = '#ff3b3b'
        ctx.beginPath()
        ctx.arc(x + w / 2 - 56, y + 24, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      ctx.fillStyle = '#10161b'
      ctx.fillRect(0, 0, w, h)
      mono(ctx, 'Ligne 1 · SIP', 40, 120, 56, '#9fe7ff')
      mono(ctx, '12:04', 40, 240, 120, '#e8f7ff')
    }
  })

/* ------------------------------------------------------------------ */
/* Animation : construction du logo (écran du studio création)        */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)

export function drawLogoConstruction(ctx: Ctx, w: number, h: number, time: number) {
  const t = time % 11
  const fadeOut = 1 - clamp01((t - 10.2) / 0.8)
  ctx.globalAlpha = 1
  ctx.fillStyle = COLORS.paper
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = fadeOut

  // grille
  const grid = ease(t / 1.2)
  ctx.strokeStyle = 'rgba(14,14,16,0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x <= w; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h * grid)
    ctx.stroke()
  }
  for (let y = 0; y <= h; y += 32) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w * grid, y)
    ctx.stroke()
  }

  const cx = w * 0.5
  const cy = h * 0.4
  const r = h * 0.17

  // cercles de construction
  const circles: Array<[number, number, number, string]> = [
    [cx, cy, r * 1.618, COLORS.cyan],
    [cx - r, cy, r, COLORS.magenta],
    [cx + r, cy, r, COLORS.magenta],
    [cx, cy, r * 0.618, COLORS.cyan],
  ]
  circles.forEach(([x, y, rr, c], i) => {
    const p = ease((t - 1 - i * 0.35) / 1.2)
    if (p <= 0) return
    ctx.strokeStyle = c
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p)
    ctx.stroke()
    ctx.setLineDash([])
  })

  // tracé du symbole
  const p = ease((t - 3.2) / 1.3)
  if (p > 0) {
    ctx.save()
    ctx.strokeStyle = COLORS.ink
    ctx.fillStyle = COLORS.ink
    ctx.lineWidth = r * 0.12
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p)
    ctx.stroke()
    const l = r * 1.45 * p
    ctx.lineWidth = r * 0.085
    ctx.beginPath()
    ctx.moveTo(cx - l, cy)
    ctx.lineTo(cx + l, cy)
    ctx.moveTo(cx, cy - l)
    ctx.lineTo(cx, cy + l)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.34 * ease((t - 4.2) / 0.5), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // nom
  const pw = ease((t - 4.6) / 0.9)
  if (pw > 0) {
    ctx.save()
    ctx.globalAlpha = pw * fadeOut
    drawWordmark(ctx, cx, h * 0.8 + (1 - pw) * 20, h * 0.12, COLORS.ink)
    ctx.restore()
  }

  // nuancier
  ;[COLORS.cyan, COLORS.magenta, COLORS.yellow, COLORS.ink].forEach((c, i) => {
    const ps = ease((t - 5.6 - i * 0.15) / 0.6)
    if (ps <= 0) return
    ctx.fillStyle = c
    ctx.fillRect(40, h - 60 - i * 50 + (1 - ps) * 30, 34 * ps, 34)
  })

  mono(ctx, 'Logo — construction', 40, 50, 18, COLORS.ink)
  mono(ctx, t > 6.5 ? 'v3 · Validé' : 'v3 · En cours', w - 40, 50, 18, t > 6.5 ? COLORS.magenta : COLORS.graphite, 'right')
  ctx.globalAlpha = 1
}

export function drawCctvOverlay(ctx: Ctx, w: number, h: number, date: Date) {
  ctx.clearRect(0, 0, w, h)
  const c = 'rgba(220,255,240,0.9)'
  ctx.strokeStyle = c
  ctx.lineWidth = 3
  const l = 34
  const m = 20
  for (const [x, y, dx, dy] of [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(x, y + dy * l)
    ctx.lineTo(x, y)
    ctx.lineTo(x + dx * l, y)
    ctx.stroke()
  }
  mono(ctx, 'Cam 01 · Atelier', 44, 64, 22, c)
  if (date.getSeconds() % 2 === 0) {
    ctx.fillStyle = '#ff3b3b'
    ctx.beginPath()
    ctx.arc(w - 150, 56, 9, 0, Math.PI * 2)
    ctx.fill()
  }
  mono(ctx, 'Rec', w - 130, 64, 22, c)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}  ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  mono(ctx, stamp, 44, h - 44, 20, c)
}

/* ------------------------------------------------------------------ */
/* Étiquettes, signalétique, tableau d'inspiration                    */
/* ------------------------------------------------------------------ */

/** Coupe un texte en lignes (points de suspension sur la dernière si besoin). */
function wrapLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]!
    if (!line || ctx.measureText(test).width <= maxWidth) {
      line = test
      continue
    }
    lines.push(line)
    if (lines.length === maxLines - 1) {
      line = words.slice(i).join(' ')
      break
    }
    line = words[i]!
  }
  lines.push(line)
  const last = lines.length - 1
  while (ctx.measureText(lines[last]!).width > maxWidth && lines[last]!.length > 4) {
    lines[last] = `${lines[last]!.slice(0, -2)}…`
  }
  return lines
}

/** Panneau suspendu au-dessus de chaque poste (numéro + nom). */
export const stationSignTexture = (num: string, title: string) =>
  cachedTexture(`station-${num}-${title}`, 1024, 256, (ctx, w, h) => {
    ctx.fillStyle = COLORS.navy
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = COLORS.accent
    ctx.fillRect(0, h - 14, w, 14)
    mono(ctx, num, 56, h / 2 + 26, 64, COLORS.accentLight)
    ctx.font = `750 81px ${FONT.display}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(title, 200, h / 2 + 36)
  })

/** Croquis de logo par défaut sur le tableau d'inspiration du studio création. */
export const LOGO_SKETCH_COUNT = 4
export const logoSketchTexture = (variant: number) =>
  cachedTexture(`sketch-${variant}`, 512, 640, (ctx, w, h) => {
    ctx.fillStyle = '#fbfaf6'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(15,23,42,0.08)'
    for (let y = 40; y < h; y += 32) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    const colors = [COLORS.accent, COLORS.ink, COLORS.magenta, COLORS.cyan]
    const c = colors[variant % colors.length]!
    if (variant === 0) drawMark(ctx, w / 2, h * 0.42, 110, c, 12)
    else if (variant === 1) {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.roundRect(w / 2 - 120, h * 0.42 - 120, 240, 240, 48)
      ctx.fill()
      ctx.font = `700 120px ${FONT.sans}`
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.fillText('AB', w / 2, h * 0.42 + 42)
    } else if (variant === 2) {
      ctx.strokeStyle = c
      ctx.lineWidth = 14
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(w / 2 + (i - 1) * 60, h * 0.42, 90, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.moveTo(w / 2, h * 0.42 - 130)
      ctx.lineTo(w / 2 + 120, h * 0.42 + 90)
      ctx.lineTo(w / 2 - 120, h * 0.42 + 90)
      ctx.closePath()
      ctx.fill()
    }
    drawWordmark(ctx, w / 2, h * 0.82, 64, COLORS.ink)
    mono(ctx, `Proposition ${variant + 1}`, 30, h - 24, 18, COLORS.graphite)
  })

/** Liège du tableau d'inspiration. */
export const corkTexture = () =>
  cachedTexture('cork', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#b98b5e'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 9000; i++) {
      const v = Math.random()
      ctx.fillStyle = v > 0.5 ? `rgba(90,55,25,${Math.random() * 0.35})` : `rgba(235,200,150,${Math.random() * 0.3})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3)
    }
  })

/** Face avant d'une boîte produit (SSD, onduleur…) avec le nom du produit. */
export const productBoxFaceTexture = (name: string, color: string) =>
  cachedTexture(`pbox-${name}-${color}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillRect(0, h * 0.62, w, h * 0.38)
    drawMark(ctx, 70, 80, 30, '#ffffff', 5)
    ctx.font = `600 40px ${FONT.sans}`
    ctx.fillStyle = '#0f172a'
    wrapLines(ctx, name, w - 60, 2).forEach((l, i) => ctx.fillText(l, 30, h * 0.62 + 64 + i * 46))
  })
