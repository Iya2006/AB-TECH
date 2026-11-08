import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '../RoundedBox'
import { useApp } from '../../lib/store'
import { M } from '../materials'
import { Glb } from '../models/devices'
import {
  bladeSignTexture,
  glassSheenTexture,
  lightPoolTexture,
  parkingSignTexture,
  totemTexture,
  wallWashTexture,
} from './storefrontTextures'

/**
 * Devanture v6 : ce qui fait d'une boîte un vrai commerce — auvent éclairé, appliques sur la pierre,
 * enseigne drapeau, totem, places de parking, mobilier urbain et reflets des vitrines.
 * L'éclairage architectural est « peint » (surfaces lumineuses additives) : aucune lumière temps réel en plus.
 */

const anthracite = new THREE.MeshStandardMaterial({ color: '#2a2f37', roughness: 0.42, metalness: 0.55 })
const steelTube = new THREE.MeshStandardMaterial({ color: '#9aa3ad', roughness: 0.3, metalness: 0.9 })
const lineWhite = new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.7 })

/** Matériau lumineux dont l'intensité suit le jour et la nuit (et l'allumage de l'atelier). */
function useNightGlow(color: string, day: number, night: number) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color])
  const base = useMemo(() => new THREE.Color(color), [color])
  useFrame((_, dt) => {
    const target = useApp.getState().mood === 'night' ? night : day
    const k = THREE.MathUtils.damp(mat.userData.k ?? target, target, 3, dt)
    mat.userData.k = k
    mat.color.copy(base).multiplyScalar(k)
  })
  return mat
}

/** Surface additive (halo, flaque de lumière, reflet) dont l'opacité suit le jour et la nuit. */
function useAdditive(map: THREE.Texture, day: number, night: number) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [map])
  useFrame((_, dt) => {
    const target = useApp.getState().mood === 'night' ? night : day
    mat.opacity = THREE.MathUtils.damp(mat.opacity, target, 3, dt)
  })
  return mat
}

/* ------------------------------------------------------------------ */
/* Auvent d'entrée                                                     */
/* ------------------------------------------------------------------ */

/**
 * Auvent en porte-à-faux au-dessus de l'entrée, juste au-dessus des vitrines (l'enseigne reste dégagée) :
 * dessus anthracite, sous-face en bois, spots encastrés.
 */
export function Canopy({ width = 7.2, depth = 2.2, y = 3.82, z0 = 0.95, wood }: { width?: number; depth?: number; y?: number; z0?: number; wood: THREE.Material }) {
  const spot = useNightGlow('#fff1dc', 1.2, 3.2)
  const edge = useNightGlow('#cfe3ff', 0.8, 2.6)
  const pool = useAdditive(lightPoolTexture(), 0.18, 0.75)
  const zc = z0 + depth / 2
  const spots = useMemo(() => [-2.4, 0, 2.4].flatMap((x) => [z0 + depth * 0.32, z0 + depth * 0.72].map((z) => [x, z] as const)), [z0, depth])
  return (
    <group>
      <mesh position={[0, y + 0.12, zc]} material={anthracite} castShadow>
        <boxGeometry args={[width, 0.24, depth]} />
      </mesh>
      {/* sous-face bois, légèrement en retrait des rives */}
      <mesh position={[0, y - 0.002, zc - 0.04]} rotation-x={Math.PI / 2} material={wood}>
        <planeGeometry args={[width - 0.16, depth - 0.12]} />
      </mesh>
      {/* bandeau LED sous la rive avant */}
      <mesh position={[0, y - 0.01, z0 + depth - 0.05]} material={edge}>
        <boxGeometry args={[width - 0.2, 0.012, 0.03]} />
      </mesh>
      {spots.map(([x, z]) => (
        <group key={`${x}${z}`}>
          <mesh position={[x, y - 0.006, z]} rotation-x={Math.PI / 2} material={spot}>
            <circleGeometry args={[0.065, 20]} />
          </mesh>
          <mesh position={[x, 0.014, z + 0.35]} rotation-x={-Math.PI / 2} material={pool}>
            <planeGeometry args={[1.9, 1.9]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Appliques et signalétique                                           */
/* ------------------------------------------------------------------ */

/** Applique « up & down » : petit boîtier, deux éventails de lumière sur la pierre. */
export function WallWasher({ x, y, z }: { x: number; y: number; z: number }) {
  const wash = useAdditive(wallWashTexture(), 0.12, 0.85)
  const lens = useNightGlow('#ffe2b5', 1, 3)
  return (
    <group position={[x, y, z]}>
      <mesh material={anthracite}>
        <boxGeometry args={[0.1, 0.24, 0.1]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * 0.121, 0]} rotation-x={s * (Math.PI / 2)} material={lens}>
          <circleGeometry args={[0.035, 12]} />
        </mesh>
      ))}
      <mesh position={[0, 0, -0.045]} material={wash}>
        <planeGeometry args={[0.9, 3.4]} />
      </mesh>
    </group>
  )
}

/** Enseigne drapeau : caisson lumineux perpendiculaire à la façade, visible de loin dans la rue. */
export function BladeSign({ x, y }: { x: number; y: number }) {
  const map = bladeSignTexture()
  const face = useMemo(() => new THREE.MeshBasicMaterial({ map, toneMapped: false }), [map])
  useFrame((_, dt) => {
    const target = useApp.getState().mood === 'night' ? 1.5 : 1
    face.color.setScalar(THREE.MathUtils.damp(face.color.r, target, 3, dt))
  })
  return (
    <group position={[x, y, 0.2]}>
      {/* potence */}
      <mesh position={[0, 0.72, 0.5]} material={anthracite}>
        <boxGeometry args={[0.05, 0.05, 1.0]} />
      </mesh>
      <mesh position={[0, 0.72, 0.02]} material={anthracite}>
        <boxGeometry args={[0.18, 0.18, 0.04]} />
      </mesh>
      <group position={[0, 0, 0.62]}>
        <RoundedBox args={[0.16, 1.2, 1.0]} radius={0.03} material={anthracite} />
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.081, 0, 0]} rotation-y={s * (Math.PI / 2)} material={face}>
            <planeGeometry args={[0.9, 1.08]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Totem au bord du trottoir : la marque, les prestations et le téléphone, éclairé de l'intérieur. */
export function Totem({ position }: { position: [number, number, number] }) {
  const map = totemTexture()
  const face = useMemo(() => new THREE.MeshBasicMaterial({ map, toneMapped: false }), [map])
  useFrame((_, dt) => {
    const target = useApp.getState().mood === 'night' ? 1.35 : 1
    face.color.setScalar(THREE.MathUtils.damp(face.color.r, target, 3, dt))
  })
  return (
    <group position={position} rotation-y={0.18}>
      <mesh position={[0, 0.06, 0]} material={M.facadeTrim} receiveShadow>
        <boxGeometry args={[1.25, 0.12, 0.6]} />
      </mesh>
      <RoundedBox args={[0.95, 3.3, 0.26]} radius={0.04} position={[0, 1.77, 0]} material={anthracite} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 1.8, s * 0.132]} rotation-y={s > 0 ? 0 : Math.PI} material={face}>
          <planeGeometry args={[0.86, 3.0]} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Abords                                                              */
/* ------------------------------------------------------------------ */

/** Places de stationnement devant le trottoir, avec leur panneau. */
export function Parking({ z0 = 12.45, depth = 5, x0 = -14, count = 11, spacing = 2.6 }: { z0?: number; depth?: number; x0?: number; count?: number; spacing?: number }) {
  const lines = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = lines.current
    if (!m) return
    const mat = new THREE.Matrix4()
    const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
    for (let i = 0; i <= count; i++) m.setMatrixAt(i, mat.makeTranslation(x0 + i * spacing, 0.006, z0 + depth / 2).multiply(rot))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }, [count, depth, spacing, x0, z0])
  const sign = parkingSignTexture()
  return (
    <group>
      <instancedMesh ref={lines} args={[undefined, lineWhite, count + 1]} receiveShadow>
        <planeGeometry args={[0.12, depth]} />
      </instancedMesh>
      {/* ligne de fond des places */}
      <mesh position={[x0 + (count * spacing) / 2, 0.006, z0 + depth]} rotation-x={-Math.PI / 2} material={lineWhite}>
        <planeGeometry args={[count * spacing, 0.12]} />
      </mesh>
      <group position={[x0 + count * spacing + 1.2, 0, z0 + 0.5]}>
        <mesh position-y={1.2} material={steelTube}>
          <cylinderGeometry args={[0.035, 0.035, 2.4, 10]} />
        </mesh>
        <mesh position={[0, 2.25, 0.04]}>
          <planeGeometry args={[0.5, 0.75]} />
          <meshStandardMaterial map={sign} roughness={0.5} transparent />
        </mesh>
      </group>
    </group>
  )
}

/** Arceaux à vélos en inox. */
export function BikeRack({ position, count = 3 }: { position: [number, number, number]; count?: number }) {
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[i * 0.75, 0, 0]} material={steelTube} castShadow>
          <torusGeometry args={[0.38, 0.025, 8, 24, Math.PI]} />
        </mesh>
      ))}
    </group>
  )
}

/** Reflets du ciel et de la rue sur les grandes vitrines : le verre se lit enfin comme du verre. */
export function GlassSheen({ panes }: { panes: Array<{ x: number; w: number; h: number; y: number; z: number }> }) {
  const sheen = useAdditive(glassSheenTexture(), 0.55, 0.16)
  return (
    <group>
      {panes.map((p) => (
        <mesh key={p.x} position={[p.x, p.y, p.z]} material={sheen}>
          <planeGeometry args={[p.w, p.h]} />
        </mesh>
      ))}
    </group>
  )
}

/** Mobilier urbain devant la boutique (modèles Poly Haven, CC0). */
export function StreetFurniture() {
  return (
    <group>
      <Glb model="bench" width={2.2} position={[-5.3, 0, 4.4]} rotation-y={Math.PI} shadows />
      <Glb model="bin" height={0.95} position={[-9.1, 0, 4.3]} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 7.3, 0, 1.55]}>
          <Glb model="planter" width={1.5} />
          <Glb model="plant" height={1.2} position={[0, 0.42, 0]} />
        </group>
      ))}
    </group>
  )
}
