import type { Product } from '@atelier/shared'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { PrintSpec } from '../../lib/mockup/engine'
import Studio3D, { type Studio3DApi } from '../../sections/Studio3D'
import { ProductModel } from '../../three/ProductDisplay'
import { model3dOf, type Place } from '../../three/real/Product3D'

const PLACE: Place = { x: 0.5, y: 0.45, s: 0.72 }
const noop = () => {}

/** Encre lisible sur la couleur du produit (pour un visuel monochrome). */
function inkFor(hex: string) {
  const c = new THREE.Color(hex)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.45 ? '#0f172a' : '#f4f1ea'
}

/**
 * Le produit en 3D, qu'on fait tourner du doigt : le vrai modèle (tissu simulé, objet modélisé) à la couleur
 * du produit, avec son visuel imprimé s'il en a un ; à défaut de modèle, une forme simple.
 */
export default function ProductPreview3D({ product, logo = null }: { product: Product; logo?: HTMLImageElement | null }) {
  const model = model3dOf(product.model)
  const api = useRef<Studio3DApi | null>(null)
  const print = useMemo<PrintSpec | null>(() => (logo ? { text: '', ink: inkFor(product.color), logo, mark: false } : null), [logo, product.color])
  if (model) {
    return <Studio3D model={model} color={product.color} print={print} place={PLACE} side="front" onPlace={noop} zoom={false} guide={false} active api={api} movable={false} />
  }
  const tall = product.model === 'extincteur'
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, tall ? 0.45 : 0.3, tall ? 1.7 : 1.1], fov: 32 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
      <color attach="background" args={['#eef2f7']} />
      <hemisphereLight args={['#ffffff', '#d5dbe3', 1.1]} />
      <directionalLight position={[1.5, 2.5, 2]} intensity={1.6} />
      <Environment resolution={128} frames={1} environmentIntensity={0.8}>
        <Lightformer form="rect" intensity={3} position={[0, 3, 2]} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-3, 1, 0]} rotation-y={Math.PI / 2} scale={[3, 2, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <group position-y={tall ? -0.05 : -0.08}>
          <ProductModel product={product} />
        </group>
      </Suspense>
      <ContactShadows position-y={-0.1} scale={1.6} blur={2.4} far={0.8} opacity={0.35} />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.2} target={[0, tall ? 0.35 : 0.08, 0]} />
    </Canvas>
  )
}
