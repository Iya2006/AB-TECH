import * as THREE from 'three'
import { BRAND } from '../../config/brand'
import { cachedTexture, COLORS, createCanvas, drawMark, drawWordmark, FONT, signTexture } from '../textures'

/**
 * Matières et signalétique de la devanture (façade v6), dessinées en haute résolution avec les polices du site :
 * panneaux composites, parement pierre, halo de l'enseigne, enseigne drapeau, totem, parking, reflets du verre.
 */

type Ctx = CanvasRenderingContext2D

/** Grain léger, pour qu'aucune grande surface ne paraisse « peinte à plat ». */
function grain(ctx: Ctx, w: number, h: number, amount: number, light: string, dark: string) {
  for (let i = 0; i < amount; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? light : dark
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
}

function repeat(tex: THREE.Texture, x: number, y: number) {
  const t = tex.clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(x, y)
  t.needsUpdate = true
  return t
}

/**
 * Panneaux composites aluminium anthracite (type « Alucobond ») : un panneau de 1,5 × 1 m par motif,
 * joints creux sombres soulignés d'un filet de lumière.
 */
export const compositePanelTexture = (repeatX: number, repeatY: number) =>
  repeat(
    cachedTexture('facade-composite', 1024, 683, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h)
      g.addColorStop(0, '#363c46')
      g.addColorStop(1, '#2b3038')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      grain(ctx, w, h, 9000, 'rgba(255,255,255,0.025)', 'rgba(0,0,0,0.05)')
      // joint creux en bas et à droite (le motif se répète)
      ctx.fillStyle = '#14171c'
      ctx.fillRect(0, h - 10, w, 10)
      ctx.fillRect(w - 10, 0, 10, h)
      ctx.fillStyle = 'rgba(255,255,255,0.09)'
      ctx.fillRect(0, h - 12, w, 2)
      ctx.fillRect(w - 12, 0, 2, h)
    }),
    repeatX,
    repeatY,
  )

/** Parement en grandes dalles de pierre claire (1,2 × 0,6 m), veinage discret et joints fins. */
export const stoneCladTexture = (repeatX: number, repeatY: number) =>
  repeat(
    cachedTexture('facade-stone', 1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#d8d1c4'
      ctx.fillRect(0, 0, w, h)
      // nuances et veines
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * w
        const y = Math.random() * h
        const r = 40 + Math.random() * 160
        const c = ctx.createRadialGradient(x, y, 0, x, y, r)
        c.addColorStop(0, `rgba(${Math.random() > 0.5 ? '160,148,128' : '240,236,228'},${0.12 + Math.random() * 0.12})`)
        c.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = c
        ctx.fillRect(0, 0, w, h)
      }
      ctx.strokeStyle = 'rgba(140,128,110,0.18)'
      for (let i = 0; i < 7; i++) {
        ctx.lineWidth = 0.6 + Math.random()
        ctx.beginPath()
        let x = Math.random() * w
        let y = Math.random() * h
        ctx.moveTo(x, y)
        for (let k = 0; k < 8; k++) ctx.lineTo((x += 40 + Math.random() * 60), (y += (Math.random() - 0.5) * 50))
        ctx.stroke()
      }
      grain(ctx, w, h, 14000, 'rgba(255,255,255,0.05)', 'rgba(60,50,40,0.05)')
      // deux dalles par motif (calepinage décalé), joints fins
      ctx.fillStyle = 'rgba(70,62,52,0.45)'
      ctx.fillRect(0, h / 2 - 2, w, 4)
      ctx.fillRect(0, h - 4, w, 4)
      ctx.fillRect(w - 4, 0, 4, h / 2)
      ctx.fillRect(w / 2 - 2, h / 2, 4, h / 2)
    }),
    repeatX,
    repeatY,
  )

/** Halo bleuté derrière les lettres lumineuses de l'enseigne (lettres boîtier rétro-éclairées). */
export const signHaloTexture = () =>
  cachedTexture('sign-halo', 1024, 160, (ctx, w, h) => {
    const src = signTexture().image as HTMLCanvasElement
    const tmp = createCanvas(w, h)
    const t = tmp.getContext('2d')!
    t.filter = 'blur(10px)'
    t.drawImage(src, 0, 0, w, h)
    t.drawImage(src, 0, 0, w, h)
    t.filter = 'none'
    t.globalCompositeOperation = 'source-in'
    t.fillStyle = '#8ec5ff'
    t.fillRect(0, 0, w, h)
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(tmp, 0, 0)
  })

/** Caisson lumineux de l'enseigne drapeau (perpendiculaire à la façade) : le symbole et le nom. */
export const bladeSignTexture = () =>
  cachedTexture('blade-sign', 512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#16285a')
    g.addColorStop(1, '#0b1533')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(142,197,255,0.55)'
    ctx.lineWidth = 6
    ctx.strokeRect(14, 14, w - 28, h - 28)
    drawMark(ctx, w / 2, h * 0.4, 92, '#ffffff', 11)
    drawWordmark(ctx, w / 2, h * 0.84, 74, '#ffffff')
  })

/** Totem de signalétique au bord du trottoir : la marque, les prestations, l'invitation à entrer. */
export const totemTexture = () =>
  cachedTexture('totem', 512, 1792, (ctx, w, h) => {
    ctx.fillStyle = '#20252d'
    ctx.fillRect(0, 0, w, h)
    // tête lumineuse : la marque
    const top = ctx.createLinearGradient(0, 0, 0, 560)
    top.addColorStop(0, '#1d3b8f')
    top.addColorStop(1, '#0f1d46')
    ctx.fillStyle = top
    ctx.fillRect(28, 28, w - 56, 520)
    drawMark(ctx, w / 2, 200, 88, '#ffffff', 10)
    drawWordmark(ctx, w / 2, 430, 84, '#ffffff')
    ctx.font = `600 26px ${FONT.sans}`
    ctx.letterSpacing = '5px'
    ctx.fillStyle = '#9cc5ff'
    ctx.textAlign = 'center'
    ctx.fillText(BRAND.tagline.toUpperCase(), w / 2, 500)
    // les prestations, une par ligne
    const items = ['Impression', 'Création graphique', 'Textile & casquettes', 'Objets & cadeaux', 'Événementiel', 'Informatique', 'Sécurité']
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'left'
    items.forEach((label, i) => {
      const y = 660 + i * 118
      ctx.fillStyle = [COLORS.cyan, COLORS.magenta, COLORS.yellow, '#f6f8fc', COLORS.cyan, COLORS.accentLight, '#ef4444'][i]!
      ctx.fillRect(56, y - 34, 10, 44)
      ctx.font = `700 44px ${FONT.display}`
      ctx.fillStyle = '#f2f5fa'
      ctx.fillText(label, 88, y)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(56, y + 40, w - 112, 2)
    })
    // pied : invitation et téléphone
    ctx.fillStyle = COLORS.accent
    ctx.fillRect(28, h - 300, w - 56, 150)
    ctx.font = `800 52px ${FONT.display}`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText('Entrez, c’est ouvert', w / 2, h - 210)
    ctx.font = `600 34px ${FONT.sans}`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText('Devis gratuit', w / 2, h - 166)
    ctx.font = `600 38px ${FONT.mono}`
    ctx.fillStyle = '#cfd8e6'
    ctx.fillText(BRAND.phones[0] ?? '', w / 2, h - 70)
  })

/** Panneau « P » des places clients. */
export const parkingSignTexture = () =>
  cachedTexture('parking-sign', 512, 768, (ctx, w, h) => {
    ctx.fillStyle = '#1f5fd6'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 36)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 14
    ctx.beginPath()
    ctx.roundRect(22, 22, w - 44, h - 44, 24)
    ctx.stroke()
    ctx.font = `800 360px ${FONT.display}`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText('P', w / 2, 400)
    ctx.font = `700 54px ${FONT.display}`
    ctx.fillText('Clients', w / 2, 540)
    ctx.font = `600 40px ${FONT.sans}`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(BRAND.name, w / 2, 640)
  })

/** Reflets sur les vitrines : deux longues traînées obliques et un voile de ciel en haut. */
export const glassSheenTexture = () =>
  cachedTexture('glass-sheen', 1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, 'rgba(255,255,255,0.32)')
    sky.addColorStop(0.35, 'rgba(255,255,255,0.06)')
    sky.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    const streak = (x: number, width: number, alpha: number) => {
      ctx.save()
      ctx.translate(x, 0)
      ctx.transform(1, 0, -0.55, 1, 0, 0)
      const g = ctx.createLinearGradient(0, 0, width, 0)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, `rgba(255,255,255,${alpha})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, h)
      ctx.restore()
    }
    streak(w * 0.18, 130, 0.22)
    streak(w * 0.32, 40, 0.16)
    streak(w * 0.7, 180, 0.14)
  })

/** Lumière rasante d'une applique murale sur la pierre (éventail de lumière, additive). */
export const wallWashTexture = () =>
  cachedTexture('wall-wash', 256, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h / 2)
    g.addColorStop(0, 'rgba(255,226,180,0.9)')
    g.addColorStop(0.35, 'rgba(255,214,160,0.35)')
    g.addColorStop(1, 'rgba(255,214,160,0)')
    ctx.save()
    ctx.scale(0.5, 1)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w * 2, h)
    ctx.restore()
  })

/** Flaque de lumière au sol sous un spot (additive). */
export const lightPoolTexture = () =>
  cachedTexture('light-pool', 256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    g.addColorStop(0, 'rgba(255,236,205,0.85)')
    g.addColorStop(0.5, 'rgba(255,230,195,0.25)')
    g.addColorStop(1, 'rgba(255,230,195,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })

/**
 * Façade des immeubles voisins : enduit, fenêtres à encadrement et appuis.
 * `lit` : les fenêtres seules (carte d'émission, allumées la nuit au hasard).
 */
export const neighbourTexture = (lit: boolean) =>
  cachedTexture(`neighbour-${lit}`, 1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = lit ? '#000000' : '#8e8a84'
    ctx.fillRect(0, 0, w, h)
    if (!lit) grain(ctx, w, h, 16000, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)')
    let seed = 7
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = 70 + c * 240
        const y = 80 + r * 250
        if (lit) {
          if (rand() > 0.45) {
            ctx.fillStyle = rand() > 0.5 ? '#ffd9a0' : '#ffeacc'
            ctx.fillRect(x + 8, y + 8, 124, 144)
          }
          continue
        }
        ctx.fillStyle = '#3b3f45'
        ctx.fillRect(x, y, 140, 160)
        const glass = ctx.createLinearGradient(x, y, x + 140, y + 160)
        glass.addColorStop(0, '#2a3442')
        glass.addColorStop(1, '#4d5d70')
        ctx.fillStyle = glass
        ctx.fillRect(x + 8, y + 8, 124, 144)
        ctx.fillStyle = '#3b3f45'
        ctx.fillRect(x + 68, y + 8, 4, 144)
        ctx.fillStyle = '#b9b3a9'
        ctx.fillRect(x - 10, y + 160, 160, 12)
      }
    }
  })
