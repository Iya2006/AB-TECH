import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { CARD_STYLES, drawCard, type CardData, type CardStyle } from '../lib/cards'

/**
 * Cartes de visite en 3D (Studio) : tous les styles sont alignés en carrousel.
 * Le visiteur fait défiler les styles (glisser / flèches) et retourne la carte (toucher / bouton).
 * Chargé à la demande : Three.js n'alourdit pas le chargement initial.
 */

export interface CardStudioProps {
  index: number
  side: 'recto' | 'verso'
  data: Omit<CardData, 'base' | 'ink'>
  /** Couleurs du style sélectionné (les autres gardent leurs couleurs par défaut). */
  base: string
  ink: string
  /** Glissement en cours, en « cartes » (−1 … 1), piloté par la section. */
  drag: MutableRefObject<number>
  active: boolean
  onGl: (gl: THREE.WebGLRenderer) => void
}

const T = 1024
const SIZE = { landscape: [0.85, 0.55], portrait: [0.55, 0.85] } as const

function faceTexture(style: CardStyle, side: 'recto' | 'verso', data: CardData) {
  const [w, h] = style.portrait ? [Math.round((T * 55) / 85), T] : [T, Math.round((T * 55) / 85)]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  drawCard(canvas.getContext('2d')!, w, h, style, side, data)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
  return tex
}

function Card({ style, data, i, props }: { style: CardStyle; data: CardData; i: number; props: CardStudioProps }) {
  const group = useRef<THREE.Group>(null)
  const flip = useRef(0)
  const [w, h] = style.portrait ? SIZE.portrait : SIZE.landscape
  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: data.base, roughness: 0.85 })
    const front = new THREE.MeshPhysicalMaterial({ map: faceTexture(style, 'recto', data), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.6 })
    const back = new THREE.MeshPhysicalMaterial({ map: faceTexture(style, 'verso', data), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.6 })
    return [edge, edge, edge, edge, front, back]
  }, [style, data])
  useEffect(
    () => () =>
      materials.forEach((m) => {
        ;(m as THREE.MeshStandardMaterial).map?.dispose()
        m.dispose()
      }),
    [materials],
  )

  useFrame(({ clock, pointer }, dt) => {
    const g = group.current
    if (!g) return
    const d = i - props.index - props.drag.current
    const ad = Math.min(Math.abs(d), 2.2)
    const center = 1 - Math.min(1, ad)
    const targetFlip = i === props.index && props.side === 'verso' ? Math.PI : 0
    flip.current = THREE.MathUtils.damp(flip.current, targetFlip, 7, dt)
    const t = clock.elapsedTime
    g.position.x = THREE.MathUtils.damp(g.position.x, Math.sign(d) * (ad < 1 ? ad * 0.95 : 0.95 + (ad - 1) * 0.5), 9, dt)
    g.position.z = THREE.MathUtils.damp(g.position.z, -ad * 0.55, 9, dt)
    g.position.y = Math.sin(t * 0.9 + i) * 0.012 * center
    const s = 1 - Math.min(ad, 1) * 0.38
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, s, 9, dt))
    // la carte centrale suit légèrement le pointeur et respire (effet de relief), les voisines sont de biais
    const idle = Math.sin(t * 0.5) * 0.12 * center
    g.rotation.y = flip.current - Math.sign(d) * Math.min(ad, 1) * 0.55 + (pointer.x * 0.18 + idle) * center
    g.rotation.x = -0.1 - pointer.y * 0.12 * center
    g.visible = ad < 2.1
  })
  return (
    <group ref={group}>
      <mesh material={materials} castShadow>
        <boxGeometry args={[w, h, 0.01]} />
      </mesh>
    </group>
  )
}

function Cards(props: CardStudioProps) {
  // Une carte par style ; le style choisi reçoit les couleurs du visiteur.
  const all = useMemo(
    () =>
      CARD_STYLES.map((style, i) => ({
        style,
        data: { ...props.data, base: i === props.index ? props.base : style.bases[0]!, ink: i === props.index ? props.ink : style.ink },
      })),
    [props.data, props.index, props.base, props.ink],
  )
  return (
    <>
      {all.map(({ style, data }, i) => (
        <Card key={style.ref} style={style} data={data} i={i} props={props} />
      ))}
    </>
  )
}

export default function CardStudio3D(props: CardStudioProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      frameloop={props.active ? 'always' : 'never'}
      camera={{ position: [0, 0.05, 2.6], fov: 32 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.NeutralToneMapping }}
      onCreated={({ gl }) => props.onGl(gl)}
    >
      <color attach="background" args={['#e8edf4']} />
      <hemisphereLight args={['#ffffff', '#d5dce6', 1.0]} />
      <directionalLight position={[1.2, 2.2, 2.4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <Environment resolution={128} frames={1} environmentIntensity={0.6}>
        <Lightformer form="rect" intensity={3} position={[0, 2.5, 2]} scale={[4, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-3, 1, 1]} rotation-y={Math.PI / 2} scale={[3, 2, 1]} />
      </Environment>
      <Cards {...props} />
      <ContactShadows position-y={-0.52} scale={3} blur={2.8} far={1} opacity={0.32} resolution={512} />
    </Canvas>
  )
}
