import type { Product, StationSlug } from '@atelier/shared'
import { Html } from '@react-three/drei'
import { useEffect, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { formatPrice } from '../config/brand'
import { CHAPTERS } from '../journey/chapters'
import { whenIdle } from '../lib/idle'
import { isPhotoModel, PHOTO, tint } from '../lib/mockup/catalog'
import { loadBase, renderMockup } from '../lib/mockup/engine'
import { useApp } from '../lib/store'
import { thumbUrl } from '../ui/img'
import type { GroupProps } from './models/products'
import { LIGHT_TEXTURES } from './mobileTextures'
import { downscale, loadBitmap, loadImage, makeBitmapTexture, makeTexture } from './textureQueue'
import { Warm } from './Warm'

/**
 * Produits de l'atelier montrés en vraie photo : la photo ajoutée par l'admin,
 * sinon la photo réelle du modèle (T-shirt, casquette, mug…) recolorée à la couleur du produit.
 */

export interface PhotoTexture {
  texture: THREE.Texture
  aspect: number
  /** Photo détourée (fond transparent) : posée telle quelle, sinon encadrée comme un tirage. */
  cutout: boolean
  /** La photo montre déjà un cintre. */
  hanger: boolean
}

/** Taille des photos dans la scène : une photo produit fait ~200 px à l'écran (moins sur un téléphone). */
const PHOTO_MAX = LIGHT_TEXTURES ? 320 : 512

/**
 * Vrai si les bords de l'image sont transparents (photo détourée). Lu sur l'image décodée (en mémoire) :
 * lire un canvas déjà passé par la carte graphique obligerait le navigateur à l'attendre, bloqué.
 */
function isCutout(img: ImageBitmap) {
  const c = document.createElement('canvas')
  c.width = c.height = 24
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, 24, 24)
  const d = ctx.getImageData(0, 0, 24, 24).data
  let clear = 0
  for (let i = 0; i < 24; i++) for (const [x, y] of [[i, 0], [i, 23], [0, i], [23, i]] as const) if (d[(y * 24 + x) * 4 + 3]! < 200) clear++
  return clear > 24
}

/** Photos de démonstration fournies avec le site (elles montrent un cintre pour les hauts). */
const withHanger = (url: string) => /\/media\/catalogue\/(tshirt|polo|sweat)/.test(url)

export function useProductPhoto(product: Product): PhotoTexture | null {
  const [photo, setPhoto] = useState<PhotoTexture | null>(null)
  const own = product.images[0]
  useEffect(() => {
    let off = false
    let made: THREE.Texture | null = null
    // les calculs d'image se font un produit à la fois, quand le navigateur a du temps libre (jamais pendant le défilement)
    const run = async () => {
      if (own) {
        // décodée hors du fil principal, déjà à la bonne taille
        const bitmap = await loadBitmap(thumbUrl(own, PHOTO_MAX), PHOTO_MAX)
        if (off) return bitmap.close()
        const cutout = await whenIdle(() => isCutout(bitmap))
        if (off) return bitmap.close()
        made = makeBitmapTexture(bitmap)
        setPhoto({ texture: made, aspect: bitmap.width / bitmap.height, cutout, hanger: withHanger(own) })
        return
      }
      // sinon : la photo réelle du modèle, recolorée (photo détourée)
      if (!isPhotoModel(product.model)) return
      const entry = PHOTO[product.model]
      const logo = product.printImage ? await loadImage(thumbUrl(product.printImage, 600)).catch(() => null) : null
      const base = await loadBase(entry.produit)
      if (off) return
      const source = await whenIdle(() => {
        const full = document.createElement('canvas')
        renderMockup(full, base, { color: tint(entry, entry.produit, product.color), print: logo ? { text: '', ink: '#000', logo } : null })
        return downscale(full, PHOTO_MAX)
      })
      if (off) return
      made = makeTexture(source)
      const hanger = product.model === 'tshirt' || product.model === 'polo' || product.model === 'sweat'
      setPhoto({ texture: made, aspect: source.width / source.height, cutout: true, hanger })
    }
    run().catch(() => !off && setPhoto(null))
    return () => {
      off = true
      made?.dispose()
    }
  }, [own, product.model, product.color, product.printImage])
  return photo
}

/**
 * La photo posée dans la scène, à une hauteur donnée. `anchor` : 'bottom' (posée sur une étagère)
 * ou 'top' (suspendue à un cintre).
 */
export function PhotoPlane({ photo, height, anchor = 'bottom', ...props }: GroupProps & { photo: PhotoTexture; height: number; anchor?: 'bottom' | 'top' }) {
  const width = height * photo.aspect
  const y = anchor === 'bottom' ? height / 2 : -height / 2
  return (
    <group {...props}>
      {/* la photo arrive après son poste : préparée avant d'apparaître (voir Warm) */}
      <Warm>
        {!photo.cutout && (
          <mesh position={[0, y, -0.006]}>
            <boxGeometry args={[width + 0.04, height + 0.04, 0.01]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
        )}
        <mesh position-y={y} castShadow={photo.cutout}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={photo.texture} alphaTest={photo.cutout ? 0.45 : 0} alphaToCoverage={photo.cutout} side={THREE.DoubleSide} />
        </mesh>
      </Warm>
    </group>
  )
}

/** Produit en photo, ou `fallback` (modèle 3D) s'il n'y a aucune photo possible. */
export function ProductPhoto({ product, height, anchor, fallback = null, ...props }: GroupProps & { product: Product; height: number; anchor?: 'bottom' | 'top'; fallback?: ReactNode }) {
  const photo = useProductPhoto(product)
  if (!photo) return <group {...props}>{fallback}</group>
  return <PhotoPlane photo={photo} height={height} anchor={anchor} {...props} />
}

/* ------------------------------------------------------------------ */
/* Étiquettes nettes (texte HTML), affichées seulement au poste visité */
/* ------------------------------------------------------------------ */

export function useStationActive(station: StationSlug) {
  return useApp((s) => CHAPTERS[s.chapter]?.id === station && s.overlay === null)
}

/**
 * Étiquette suspendue (comme en boutique de mode) : un fil part du produit, la carte se balance
 * doucement. Le point `position` est l'attache du fil ; l'étiquette pend en dessous.
 */
export function PriceTag({ product, station, position, seed = 0 }: { product: Product; station: StationSlug; position: [number, number, number]; seed?: number }) {
  const active = useStationActive(station)
  if (!active) return null
  const price = formatPrice(product.price)
  return (
    <Html position={position} zIndexRange={[0, 0]} style={{ pointerEvents: 'none' }}>
      <div className="hang-tag" style={{ animationDelay: `${-seed * 0.7}s` }}>
        <span className="hang-string" aria-hidden />
        <button type="button" onClick={() => useApp.getState().open({ type: 'product', id: product.id })} className="hang-card">
          <span className="hang-eyelet" aria-hidden />
          <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-white/85">{product.name}</span>
          <span className={`mt-1 block font-display leading-none ${product.price !== null ? 'text-[17px] text-white' : 'text-[13px] text-accent-2'}`}>{price}</span>
          <span className="mt-2 block text-[11px] font-bold uppercase tracking-wider text-white/50">Voir →</span>
        </button>
      </div>
    </Html>
  )
}
