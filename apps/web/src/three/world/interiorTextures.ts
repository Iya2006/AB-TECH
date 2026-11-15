import * as THREE from 'three'
import { cachedTexture } from '../textures'

/** Finitions de l'atelier (v6) : faux plafond en dalles et murs en grands panneaux à joints fins. */

function repeat(tex: THREE.Texture, x: number, y: number) {
  const t = tex.clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(x, y)
  t.needsUpdate = true
  return t
}

/** Faux plafond commercial : dalles de 60 × 60 cm (4 × 4 par motif, soit 2,4 m), ossature fine. */
export const ceilingTileTexture = (repeatX: number, repeatY: number) =>
  repeat(
    cachedTexture('ceiling-tiles', 512, 512, (ctx, w, h) => {
      const n = 4
      const s = w / n
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = 244 + Math.round(Math.random() * 6)
          ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`
          ctx.fillRect(i * s, j * s, s, s)
          // texture minérale des dalles
          for (let k = 0; k < 260; k++) {
            ctx.fillStyle = `rgba(150,160,175,${Math.random() * 0.08})`
            ctx.fillRect(i * s + Math.random() * s, j * s + Math.random() * s, 1.5, 1.5)
          }
        }
      ctx.fillStyle = '#cfd6df'
      for (let i = 0; i <= n; i++) {
        ctx.fillRect(i * s - 2, 0, 4, h)
        ctx.fillRect(0, i * s - 2, w, 4)
      }
    }),
    repeatX,
    repeatY,
  )

/** Murs en panneaux de 1,2 m de large : joints creux verticaux, grain d'enduit très léger. */
export const wallPanelTexture = (repeatX: number, repeatY: number) =>
  repeat(
    cachedTexture('wall-panels', 1024, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      for (let k = 0; k < 6000; k++) {
        ctx.fillStyle = `rgba(120,130,145,${Math.random() * 0.04})`
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
      }
      // deux panneaux par motif : joint creux + filet de lumière
      for (const x of [w / 2, w]) {
        ctx.fillStyle = 'rgba(70,80,95,0.32)'
        ctx.fillRect(x - 4, 0, 4, h)
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.fillRect(x, 0, 2, h)
      }
    }),
    repeatX,
    repeatY,
  )

/**
 * Ombres douces du sol de l'atelier (occlusion ambiante peinte une fois, sans calcul à l'affichage) :
 * le pied des murs et des poteaux s'assombrit, comme sous chaque poste. C'est ce qui « pose » les meubles
 * au sol, y compris sur les téléphones, où les ombres calculées sont coupées.
 *
 * Repère : la texture couvre tout le sol (largeur 2 × halfWidth, longueur de z = 0 à z = end) ;
 * le haut de l'image est le fond de l'atelier.
 */
export function floorOcclusionTexture(layout: {
  halfWidth: number
  end: number
  techStart: number
  columns: number[]
  footprints: Array<[number, number, number, number]>
}) {
  const { halfWidth: hw, end } = layout
  const W = 256
  const H = 1024
  const tex = cachedTexture('floor-ao', W, H, (ctx) => {
    const X = (x: number) => ((x + hw) / (2 * hw)) * W
    const Y = (z: number) => (1 - z / end) * H
    const mx = W / (2 * hw) // pixels par mètre
    const mz = H / -end
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    const band = (x0: number, y0: number, x1: number, y1: number, fromX: number, fromY: number, toX: number, toY: number, dark: number) => {
      const g = ctx.createLinearGradient(fromX, fromY, toX, toY)
      g.addColorStop(0, `rgba(0,0,0,${dark})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    }
    // pied des murs latéraux (1,6 m), du fond et de l'entrée
    const reach = 1.6
    band(0, 0, reach * mx, H, 0, 0, reach * mx, 0, 0.42)
    band(W - reach * mx, 0, W, H, W, 0, W - reach * mx, 0, 0.42)
    band(0, 0, W, reach * mz, 0, 0, 0, reach * mz, 0.42)
    band(0, H - reach * mz, W, H, 0, H, 0, H - reach * mz, 0.3)
    // cloison de la boutique tech (de part et d'autre, hors du passage central)
    const yt = Y(layout.techStart)
    for (const [x0, x1] of [
      [-hw, -1.6],
      [1.6, hw],
    ] as const) {
      band(X(x0), yt - 1.1 * mz, X(x1), yt, 0, yt, 0, yt - 1.1 * mz, 0.3)
      band(X(x0), yt, X(x1), yt + 1.1 * mz, 0, yt, 0, yt + 1.1 * mz, 0.3)
    }
    /** Tache d'ombre elliptique (centre plus dense). */
    const blob = (x: number, z: number, rx: number, rz: number, dark: number) => {
      ctx.save()
      ctx.translate(X(x), Y(z))
      ctx.scale(rx * mx, rz * mz)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, `rgba(0,0,0,${dark})`)
      g.addColorStop(0.55, `rgba(0,0,0,${dark * 0.72})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    // pied des poteaux
    for (const z of layout.columns) for (const s of [-1, 1]) blob(s * (hw - 0.25), z, 1.3, 1.3, 0.34)
    // sous chaque poste : une ombre large et douce, débordant de 70 cm autour des meubles
    for (const [x, z, w, d] of layout.footprints) blob(x, z, w / 2 + 0.7, d / 2 + 0.7, 0.4)
  })
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 4
  return tex
}

/** Dégradé vertical des murs : plus sombres au ras du sol (et un peu sous le plafond), comme dans une vraie pièce. */
export function wallOcclusionTexture() {
  const tex = cachedTexture('wall-ao', 4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#d9d9d9')
    g.addColorStop(0.14, '#ffffff')
    g.addColorStop(0.8, '#ffffff')
    g.addColorStop(0.93, '#d0d0d0')
    g.addColorStop(1, '#a8a8a8')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
  tex.colorSpace = THREE.NoColorSpace
  return tex
}
