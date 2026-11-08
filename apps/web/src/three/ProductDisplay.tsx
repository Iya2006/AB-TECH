import type { Product, ProductModel as Model } from '@atelier/shared'
import { Suspense, useState } from 'react'
import * as THREE from 'three'
import { useApp } from '../lib/store'
import { useLazyTexture } from './assets'
import { thumb } from './Gallery'
import { Interactive } from './Interactive'
import { Glb, KeyboardSet, Monitor, ProductBox, Router, Tower } from './models/devices'
import { Bottle, Cap, GiftBox, Mug, Tote, Tshirt, type GroupProps } from './models/products'
import { PhotoPlane, PriceTag, useProductPhoto } from './PhotoProduct'
import type { PrintImage } from './textures'

/** Encre lisible sur la couleur du support (claire sur foncé, foncée sur clair). */
function inkFor(hex: string) {
  const c = new THREE.Color(hex)
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  return lum > 0.45 ? '#0f172a' : '#f4f1ea'
}

/** Le produit sous sa forme 3D (posé au sol de son groupe, face +z). */
export function ProductModel({ product }: { product: Product }) {
  const printTex = useLazyTexture(product.printImage ? thumb(product.printImage, 600) : null)
  const logo = (printTex?.image as PrintImage | undefined) ?? null
  const print = { baseColor: product.color, ink: inkFor(product.color), text: '', logo }
  switch (product.model) {
    case 'tshirt':
    case 'sweat':
    case 'pull':
      return <Tshirt {...print} position-y={0.42} />
    case 'polo':
      return <Tshirt {...print} polo position-y={0.42} />
    case 'casquette':
    case 'snapback':
    case 'trucker':
      return <Cap {...print} scale={1.7} />
    case 'mug':
      return <Mug {...print} scale={2.6} />
    case 'tote':
      return <Tote {...print} scale={1.2} />
    case 'gourde':
      return <Bottle {...print} scale={1.9} />
    case 'coffret':
      return <GiftBox baseColor={product.color} scale={1.3} />
    case 'portable':
      return <Glb model="laptop" width={0.38} />
    case 'ecran':
      return <Monitor variant="shop" width={0.56} />
    case 'tour':
      return <Tower color={product.color} />
    case 'clavier':
      return <KeyboardSet color={product.color} />
    case 'routeur':
      return <Router color={product.color} />
    case 'camera-dome':
      return <Glb model="cameraDome" height={0.2} />
    case 'camera-bullet':
      return <Glb model="cameraBullet" width={0.34} />
    case 'extincteur':
      return <Glb model="extinguisher" height={0.6} />
    case 'boite':
      return <ProductBox name={product.name} color={product.color} />
    default:
      return null
  }
}

/** Hauteur d'exposition de la photo selon le produit (un peu au-dessus du réel, pour bien se voir). */
const PHOTO_HEIGHT: Partial<Record<Model, number>> = {
  portable: 0.3,
  ecran: 0.42,
  tour: 0.44,
  clavier: 0.2,
  routeur: 0.18,
  'camera-dome': 0.26,
  'camera-bullet': 0.2,
  extincteur: 0.56,
  mug: 0.17,
  tote: 0.36,
  gourde: 0.3,
  coffret: 0.22,
  casquette: 0.2,
  snapback: 0.2,
  trucker: 0.2,
  boite: 0.26,
}

/**
 * Article exposé : la vraie photo du produit (ou son modèle 3D à défaut), cliquable,
 * avec une étiquette nom/prix nette qui apparaît quand on visite le poste.
 */
export function ProductDisplay({
  product,
  height,
  tag = 'always',
  seed = 0,
  ...props
}: GroupProps & { product: Product; height?: number; tag?: 'always' | 'hover' | false; seed?: number }) {
  const photo = useProductPhoto(product)
  const [hover, setHover] = useState(false)
  const h = height ?? PHOTO_HEIGHT[product.model] ?? 0.3
  // l'étiquette pend d'un fil attaché devant la base du produit (bord de table, de socle, d'étagère) :
  // elle ne cache jamais le produit
  const tagAt: [number, number, number] = [0, 0.005, 0.13]
  return (
    <group {...props} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <Interactive onSelect={() => useApp.getState().open({ type: 'product', id: product.id })}>
        {photo ? (
          <PhotoPlane photo={photo} height={h} anchor="bottom" />
        ) : (
          <Suspense fallback={null}>
            <ProductModel product={product} />
          </Suspense>
        )}
      </Interactive>
      {(tag === 'always' || (tag === 'hover' && hover)) && <PriceTag product={product} station={product.station} position={tagAt} seed={seed} />}
    </group>
  )
}
