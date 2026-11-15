import type { Product } from '@atelier/shared'
import type { ThreeElements } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { PrintSpec } from '../../lib/mockup/engine'
import { thumbUrl } from '../../ui/img'
import { loadImage } from '../textureQueue'
import { model3dOf, Product3D, useProductAsset, type Model3D, type Place } from './Product3D'
import { usePrintTexture } from './print'

/**
 * Un produit du catalogue dans la visite de l'atelier, en vraie 3D : modèle allégé à la couleur du produit,
 * avec son visuel imprimé s'il en a un (réglé dans l'espace pro).
 */

type GroupProps = Omit<ThreeElements['group'], 'children'>

/** Le produit a un vrai modèle 3D (sinon il reste en photo). */
export const has3D = (product: Product) => model3dOf(product.model) !== null

const GARMENT_PLACE: Place = { x: 0.5, y: 0.4, s: 0.62 }
const OBJECT_PLACE: Place = { x: 0.5, y: 0.5, s: 0.82 }

/** Encre lisible sur la couleur du produit. */
function inkFor(hex: string) {
  const c = new THREE.Color(hex)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.45 ? '#0f172a' : '#f4f1ea'
}

/** Visuel imprimé du produit, chargé hors du fil principal (null tant qu'il n'est pas prêt, ou s'il n'y en a pas). */
function usePrintImage(url: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    setImage(null)
    if (!url) return
    let off = false
    loadImage(thumbUrl(url, 600))
      .then((img) => !off && setImage(img))
      .catch(() => undefined)
    return () => {
      off = true
    }
  }, [url])
  return image
}

/**
 * `height` : hauteur d'exposition dans la scène (le modèle est mis à l'échelle) ; sans elle, taille réelle.
 * La base du produit est à y = 0, sa face avant regarde +z.
 */
export function VisitProduct({ product, height, ...props }: GroupProps & { product: Product; height?: number }) {
  const model = model3dOf(product.model) as Model3D
  const { meta } = useProductAsset(model, true)
  const logo = usePrintImage(product.printImage)
  const spec = useMemo<PrintSpec | null>(() => (logo ? { text: '', ink: inkFor(product.color), logo, mark: false } : null), [logo, product.color])
  const texture = usePrintTexture(spec, meta.zones.front.cm, 512)
  const layer = useMemo(() => (texture ? { texture, place: meta.kind === 'objet' ? OBJECT_PLACE : GARMENT_PLACE } : null), [texture, meta])
  const scale = height ? height / meta.height : 1
  return (
    <group {...props}>
      <Product3D model={model} color={product.color} front={layer} lod proxy shadows={false} scale={scale} />
    </group>
  )
}

/** Hauteur réelle du modèle d'un produit (mètres), pour le placer (cintre, socle). */
export function useModelHeight(product: Product) {
  return useProductAsset(model3dOf(product.model) as Model3D, true).meta.height
}
