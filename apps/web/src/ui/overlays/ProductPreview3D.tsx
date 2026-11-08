import type { Product } from '@atelier/shared'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { ProductModel } from '../../three/ProductDisplay'

/** Aperçu 3D d'un produit sans photo : on peut le faire tourner du doigt. */
export default function ProductPreview3D({ product }: { product: Product }) {
  const tall = ['tshirt', 'polo', 'extincteur', 'tote'].includes(product.model)
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
