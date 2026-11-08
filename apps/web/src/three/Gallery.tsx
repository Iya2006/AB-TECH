import type { Realisation } from '@atelier/shared'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useApp } from '../lib/store'
import { thumbUrl } from '../ui/img'
import { useLazyTexture } from './assets'
import { Interactive } from './Interactive'
import { M } from './materials'
import type { GroupProps } from './models/products'

/** Une œuvre à accrocher : réalisation (image distante) ou visuel généré (texture). */
export interface WallItem {
  key: string
  image?: string
  texture?: THREE.Texture
  onSelect?: () => void
}

/** Version allégée (Cloudinary) d'une image pour la 3D. */
/** Assez de pixels pour un cadre vu de près (Cloudinary : redimensionné à la volée). */
export const thumb = (url: string, width = 1400) => thumbUrl(url, width)

export function realisationItems(list: Realisation[]): WallItem[] {
  return list.map((r) => ({
    key: r.id,
    image: r.images[0],
    onSelect: () => useApp.getState().open({ type: 'realisation', id: r.id }),
  }))
}

const FRAME = { black: M.ink, wood: M.wood, white: M.white }

/** Cadre qui s'adapte au format de l'image, centré sur son origine, face +z. */
export function Frame({
  item,
  maxW,
  maxH,
  frame = 'black',
  mat = true,
  ...props
}: GroupProps & { item: WallItem; maxW: number; maxH: number; frame?: keyof typeof FRAME; mat?: boolean }) {
  const lazy = useLazyTexture(item.texture ? null : item.image ? thumb(item.image) : null)
  const tex = item.texture ?? lazy
  const { w, h } = useMemo(() => {
    const img = tex?.image as { width?: number; height?: number } | undefined
    const ratio = img?.width && img?.height ? img.width / img.height : 0.8
    return ratio > maxW / maxH ? { w: maxW, h: maxW / ratio } : { w: maxH * ratio, h: maxH }
  }, [tex, maxW, maxH])
  const border = 0.045
  const pad = mat ? Math.min(w, h) * 0.08 : 0
  const content = (
    <group>
      <mesh position-z={-0.02} material={FRAME[frame]} castShadow>
        <boxGeometry args={[w + border * 2 + pad * 2, h + border * 2 + pad * 2, 0.04]} />
      </mesh>
      {mat && (
        <mesh position-z={0.001} material={M.paper}>
          <planeGeometry args={[w + pad * 2, h + pad * 2]} />
        </mesh>
      )}
      <mesh position-z={0.003}>
        <planeGeometry args={[w, h]} />
        {/* clé : un nouveau matériau quand l'image arrive (le shader doit être recompilé avec la texture) */}
        {tex ? <meshStandardMaterial key={tex.uuid} map={tex} roughness={0.55} /> : <meshStandardMaterial key="attente" color="#e2e8f0" roughness={0.9} />}
      </mesh>
    </group>
  )
  return item.onSelect ? (
    <Interactive {...props} onSelect={item.onSelect} hoverScale={1.04}>
      {content}
    </Interactive>
  ) : (
    <group {...props}>{content}</group>
  )
}

/**
 * Accrochage en grille sur un mur : autant d'œuvres que l'admin en ajoute,
 * réparties sur la largeur disponible (face +z, centré sur l'origine).
 */
export function GalleryWall({
  items,
  width,
  height,
  rows = 1,
  gap = 0.35,
  frame = 'black',
  ...props
}: GroupProps & { items: WallItem[]; width: number; height: number; rows?: number; gap?: number; frame?: keyof typeof FRAME }) {
  if (!items.length) return null
  const perRow = Math.max(1, Math.ceil(items.length / rows))
  const usedRows = Math.min(rows, items.length)
  const cellW = (width - gap * (perRow - 1)) / perRow
  const cellH = (height - gap * (usedRows - 1)) / usedRows
  return (
    <group {...props}>
      {items.map((item, i) => {
        const r = Math.floor(i / perRow)
        const c = i % perRow
        const inRow = Math.min(perRow, items.length - r * perRow)
        const rowW = inRow * cellW + (inRow - 1) * gap
        const x = -rowW / 2 + cellW / 2 + c * (cellW + gap)
        const y = (usedRows - 1) * (cellH + gap) * 0.5 - r * (cellH + gap)
        return <Frame key={item.key} item={item} maxW={cellW * 0.92} maxH={cellH * 0.92} frame={frame} position={[x, y, 0]} />
      })}
    </group>
  )
}
