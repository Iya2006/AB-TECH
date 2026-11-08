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
