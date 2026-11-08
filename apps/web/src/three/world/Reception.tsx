import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '../RoundedBox'
import { G, M } from '../materials'
import { Glb } from '../models/devices'
import { signTexture } from '../textures'

/**
 * L'accueil, juste derrière la vitrine (on le voit depuis la rue) : comptoir conseil, caisse, mur logo,
 * suspensions, et un coin attente avec canapé. Meubles et objets : modèles Poly Haven (CC0).
 */

const FACE_PLUS_X = Math.PI / 2
const FACE_MINUS_X = -Math.PI / 2

const counterBody = new THREE.MeshStandardMaterial({ color: '#13213f', roughness: 0.5, metalness: 0.2 })
const cable = new THREE.MeshStandardMaterial({ color: '#1b1e24', roughness: 0.6 })

/** Comptoir conseil face à l'allée : plateau blanc, caisson bleu nuit, nom lumineux, liseré LED au sol. */
function Counter() {
  const logo = useMemo(() => new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, toneMapped: false, color: new THREE.Color(1.25, 1.25, 1.25) }), [])
  return (
    <group position={[-5.6, 0, -3.6]} rotation-y={FACE_PLUS_X}>
      <RoundedBox args={[2.9, 0.05, 0.8]} radius={0.015} position={[0, 1.075, 0]} material={M.plasticWhite} castShadow />
      <mesh position={[0, 0.53, 0]} material={counterBody} castShadow receiveShadow>
        <boxGeometry args={[2.8, 1.02, 0.66]} />
      </mesh>
      <mesh position={[0, 0.62, 0.331]} material={logo}>
        <planeGeometry args={[2.1, 0.33]} />
      </mesh>
      <mesh position={[0, 0.025, 0.335]} material={G.blue}>
        <boxGeometry args={[2.7, 0.018, 0.01]} />
      </mesh>
      <Glb model="cashRegister" height={0.3} position={[0.75, 1.1, -0.14]} rotation-y={Math.PI} />
      <Glb model="stationery" height={0.13} position={[-0.25, 1.1, -0.08]} />
      <Glb model="succulent" height={0.42} position={[-1.15, 1.1, -0.12]} />
      {/* deux tabourets côté client, un fauteuil côté atelier */}
      {[-0.7, 0.4].map((x) => (
        <Glb key={x} model="barStool" height={0.95} position={[x, 0, 0.78]} />
      ))}
      <Glb model="officeChair" height={0.95} position={[0.2, 0, -0.95]} rotation-y={0.2} />
    </group>
  )
}

/** Mur logo derrière l'accueil : panneau bleu nuit, nom lumineux, filet bleu. */
function LogoWall() {
  const logo = useMemo(() => new THREE.MeshBasicMaterial({ map: signTexture(), transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }), [])
  return (
    <group position={[-9.96, 0, -3.6]} rotation-y={FACE_PLUS_X}>
      <RoundedBox args={[3.6, 2.2, 0.08]} radius={0.03} position={[0, 2.25, 0.04]} material={counterBody} />
      <mesh position={[0, 2.35, 0.085]} material={logo}>
        <planeGeometry args={[3.2, 0.5]} />
      </mesh>
      <mesh position={[0, 1.2, 0.09]} material={G.blue}>
        <boxGeometry args={[3.5, 0.02, 0.01]} />
      </mesh>
    </group>
  )
}

/** Suspension industrielle au bout de son câble, accrochée au plafond (6 m dans l'atelier, 4,2 m dans l'espace Tech). */
export function Pendant({ position, ceiling = 6 }: { position: [number, number, number]; ceiling?: number }) {
  const [x, y, z] = position
  return (
    <group>
      <mesh position={[x, (y + ceiling) / 2 + 0.15, z]} material={cable}>
        <cylinderGeometry args={[0.006, 0.006, ceiling - y - 0.3, 6]} />
      </mesh>
      <Glb model="pendant" height={0.45} position={[x, y, z]} />
    </group>
  )
}

/** Coin attente côté droit : canapé, table basse, plante, catalogue, horloge murale. */
function Lounge() {
  return (
    <group>
      <Glb model="sofa" width={2.1} position={[7.0, 0, -3.4]} rotation-y={FACE_MINUS_X} />
      <Glb model="coffeeTable" width={1.1} position={[5.5, 0, -3.4]} />
      <Glb model="succulent" height={0.36} position={[5.3, 0.42, -3.6]} />
      <Glb model="frame" height={0.26} position={[5.75, 0.42, -3.2]} rotation-y={-0.5} />
      <Glb model="clock" height={0.45} position={[9.98, 2.9, -3.4]} rotation-y={FACE_MINUS_X} />
    </group>
  )
}

export function Reception() {
  return (
    <group>
      <Counter />
      <LogoWall />
      {[-2.6, -3.6, -4.6].map((z) => (
        <Pendant key={z} position={[-5.6, 3.05, z]} />
      ))}
      <Lounge />
    </group>
  )
}
