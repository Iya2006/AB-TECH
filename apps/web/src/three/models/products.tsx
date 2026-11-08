import type { ThreeElements } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { M } from '../materials'
import {
  COLORS,
  canvasTexture,
  cardBackTexture,
  cardFrontTexture,
  drawMark,
  drawPrint,
  type CardVariant,
  type PrintImage,
} from '../textures'

/**
 * Produits personnalisables, utilisés à la fois dans l'atelier et dans le Studio 3D.
 * Chaque produit reçoit la couleur du support, la couleur d'encre, un texte et éventuellement le logo du client.
 */
export interface PrintProps {
  baseColor?: string
  ink?: string
  text?: string
  logo?: PrintImage | null
}

export type GroupProps = Omit<ThreeElements['group'], 'children'>

function useCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  deps: unknown[],
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tex = useMemo(() => canvasTexture(w, h, draw), deps)
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

/* ------------------------------------------------------------------ */
/* T-shirt & polo                                                      */
/* ------------------------------------------------------------------ */

let teeGeometry: THREE.ExtrudeGeometry | null = null
function getTeeGeometry() {
  if (teeGeometry) return teeGeometry
  const s = new THREE.Shape()
  s.moveTo(-0.09, 0.36)
  s.lineTo(-0.2, 0.335)
  s.lineTo(-0.43, 0.2)
  s.lineTo(-0.36, 0.065)
  s.lineTo(-0.255, 0.12)
  s.lineTo(-0.265, -0.39)
  s.quadraticCurveTo(0, -0.405, 0.265, -0.39)
  s.lineTo(0.255, 0.12)
  s.lineTo(0.36, 0.065)
  s.lineTo(0.43, 0.2)
  s.lineTo(0.2, 0.335)
  s.lineTo(0.09, 0.36)
  s.quadraticCurveTo(0, 0.27, -0.09, 0.36)
  teeGeometry = new THREE.ExtrudeGeometry(s, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.022,
    bevelSegments: 5,
    curveSegments: 16,
  })
  teeGeometry.translate(0, 0, -0.015)
  return teeGeometry
}
const TEE_FRONT = 0.0405

export function Tshirt({
  baseColor = '#f5f3ee',
  ink = COLORS.ink,
  text = '',
  logo = null,
  polo = false,
  ...props
}: PrintProps & GroupProps & { polo?: boolean }) {
  const print = useCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      drawPrint(ctx, 40, 40, w - 80, h - 80, { text, ink, logo })
    },
    [text, ink, logo],
  )
  return (
    <group {...props}>
      <mesh geometry={getTeeGeometry()} castShadow>
        <meshPhysicalMaterial color={baseColor} roughness={0.92} sheen={1} sheenRoughness={0.7} sheenColor="#ffffff" />
      </mesh>
      <mesh position={[0, polo ? 0.02 : 0.06, TEE_FRONT]}>
        <planeGeometry args={[0.26, 0.26]} />
        <meshStandardMaterial map={print} transparent roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {polo && (
        <group position={[0, 0.3, TEE_FRONT]}>
          <mesh position={[0, -0.05, 0.002]}>
            <boxGeometry args={[0.036, 0.11, 0.004]} />
            <meshPhysicalMaterial color={baseColor} roughness={0.9} sheen={1} />
          </mesh>
          {[-0.025, -0.07].map((y) => (
            <mesh key={y} position={[0, y, 0.006]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.006, 0.006, 0.003, 16]} />
              <meshStandardMaterial color="#e8e2d4" roughness={0.4} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.055, 0.035, 0.008]} rotation-z={side * -0.55}>
              <boxGeometry args={[0.11, 0.05, 0.008]} />
              <meshPhysicalMaterial color={baseColor} roughness={0.9} sheen={1} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

/** Cintre : à placer au-dessus d'un T-shirt. */
export function Hanger(props: GroupProps) {
  return (
    <group {...props}>
      <mesh position={[0, 0.06, 0]} rotation-z={Math.PI / 2}>
        <torusGeometry args={[0.035, 0.004, 8, 24, Math.PI * 1.3]} />
        <primitive object={M.chrome} attach="material" />
      </mesh>
      <mesh position={[0, -0.005, 0]} rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.009, 0.4, 4, 8]} />
        <primitive object={M.wood} attach="material" />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Casquette                                                           */
/* ------------------------------------------------------------------ */

const CAP_R = 0.105
let brimGeometry: THREE.ExtrudeGeometry | null = null
function getBrimGeometry() {
  if (brimGeometry) return brimGeometry
  const s = new THREE.Shape()
  const n = 32
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - (Math.PI * i) / n
    const p = new THREE.Vector2(0.122 * Math.cos(a), 0.25 * Math.sin(a))
    if (i === 0) s.moveTo(p.x, p.y)
    else s.lineTo(p.x, p.y)
  }
  for (let i = 0; i <= n; i++) {
    const a = (Math.PI * i) / n
    s.lineTo(CAP_R * Math.cos(a), CAP_R * 1.1 * Math.sin(a) - 0.004)
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 8,
  })
  // courbure de la visière
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    pos.setZ(i, pos.getZ(i) + 1.5 * x * x)
  }
  g.computeVertexNormals()
  brimGeometry = g
  return g
}

export function Cap({ baseColor = '#17171a', ink = COLORS.paper, text = '', logo = null, ...props }: PrintProps & GroupProps) {
  const crownMap = useCanvasTexture(
    1024,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor
      ctx.fillRect(0, 0, w, h)
      // coutures des 6 panneaux
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'
      ctx.lineWidth = 3
      for (let i = 0; i < 6; i++) {
        const x = ((i + 0.5) / 6) * w
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      // marquage face avant (u = 0.25), dimensionné pour compenser la courbure
      const pw = 0.12 * w
      const ph = 0.3 * h
      drawPrint(ctx, 0.25 * w - pw / 2, 0.63 * h - ph / 2, pw, ph, { text: text.slice(0, 14), ink, logo })
    },
    [baseColor, ink, text, logo],
  )
  return (
    <group {...props}>
      <group scale={[1, 0.82, 1.1]}>
        <mesh castShadow>
          <sphereGeometry args={[CAP_R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial map={crownMap} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, CAP_R, 0]}>
          <sphereGeometry args={[0.009, 12, 8]} />
          <meshStandardMaterial color={baseColor} roughness={0.9} />
        </mesh>
      </group>
      <mesh geometry={getBrimGeometry()} position={[0, 0.002, 0]} rotation-x={Math.PI / 2 + 0.16} castShadow>
        <meshStandardMaterial color={baseColor} roughness={0.85} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Mug                                                                 */
/* ------------------------------------------------------------------ */

export function Mug({ baseColor = '#f7f5f0', ink = COLORS.ink, text = '', logo = null, ...props }: PrintProps & GroupProps) {
  const wrap = useCanvasTexture(
    1024,
    400,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor
      ctx.fillRect(0, 0, w, h)
      drawPrint(ctx, w / 2 - 140, 50, 280, 300, { text, ink, logo })
    },
    [baseColor, ink, text, logo],
  )
  return (
    <group {...props}>
      <group position-y={0.05}>
        <mesh castShadow>
          <cylinderGeometry args={[0.042, 0.04, 0.1, 64, 1, true, Math.PI, Math.PI * 2]} />
          <meshPhysicalMaterial map={wrap} roughness={0.28} clearcoat={1} clearcoatRoughness={0.15} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.039, 0.037, 0.098, 48, 1, true]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.3} side={THREE.BackSide} clearcoat={0.6} />
        </mesh>
        <mesh position-y={0.05} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.0405, 0.0018, 8, 64]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.3} clearcoat={1} />
        </mesh>
        <mesh position-y={-0.042} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.038, 48]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.3} />
        </mesh>
        <mesh position-y={-0.05} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.04, 48]} />
          <meshStandardMaterial color="#d8d2c6" roughness={0.9} />
        </mesh>
        <mesh position={[0.044, 0.002, 0]} rotation-z={-Math.PI / 2}>
          <torusGeometry args={[0.03, 0.0075, 14, 32, Math.PI]} />
          <meshPhysicalMaterial color={baseColor} roughness={0.28} clearcoat={1} />
        </mesh>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Tote bag                                                            */
/* ------------------------------------------------------------------ */

let handleGeometry: THREE.TubeGeometry | null = null
function getHandleGeometry() {
  if (handleGeometry) return handleGeometry
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.085, 0.19, 0),
    new THREE.Vector3(-0.08, 0.31, 0),
    new THREE.Vector3(0, 0.37, 0),
    new THREE.Vector3(0.08, 0.31, 0),
    new THREE.Vector3(0.085, 0.19, 0),
  ])
  handleGeometry = new THREE.TubeGeometry(curve, 40, 0.008, 8, false)
  return handleGeometry
}

export function Tote({ baseColor = '#ece3cf', ink = COLORS.ink, text = '', logo = null, ...props }: PrintProps & GroupProps) {
  const front = useCanvasTexture(
    720,
    800,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
      }
      drawPrint(ctx, 150, 200, w - 300, h - 330, { text, ink, logo })
    },
    [baseColor, ink, text, logo],
  )
  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.95 })
    const face = new THREE.MeshStandardMaterial({ map: front, roughness: 0.95 })
    return [side, side, side, side, face, side]
  }, [front, baseColor])
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  const handleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.95 }), [baseColor])
  return (
    <group {...props}>
      <mesh position-y={0.2} material={materials} castShadow>
        <boxGeometry args={[0.36, 0.4, 0.045]} />
      </mesh>
      <mesh geometry={getHandleGeometry()} position={[0, 0.2, 0.012]} material={handleMat} />
      <mesh geometry={getHandleGeometry()} position={[0, 0.2, -0.012]} material={handleMat} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Gourde                                                              */
/* ------------------------------------------------------------------ */

export function Bottle({ baseColor = '#1d2b3a', ink = COLORS.paper, text = '', logo = null, ...props }: PrintProps & GroupProps) {
  const wrap = useCanvasTexture(
    1024,
    900,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor
      ctx.fillRect(0, 0, w, h)
      drawPrint(ctx, w / 2 - 120, 260, 240, 380, { text: text.slice(0, 12), ink, logo })
    },
    [baseColor, ink, text, logo],
  )
  return (
    <group {...props}>
      <mesh position-y={0.095} castShadow>
        <cylinderGeometry args={[0.034, 0.034, 0.19, 48, 1, true, Math.PI, Math.PI * 2]} />
        <meshStandardMaterial map={wrap} roughness={0.42} metalness={0.15} />
      </mesh>
      <mesh position-y={0.2025}>
        <cylinderGeometry args={[0.019, 0.034, 0.025, 48]} />
        <meshStandardMaterial color={baseColor} roughness={0.42} metalness={0.15} />
      </mesh>
      <mesh position-y={0.232}>
        <cylinderGeometry args={[0.021, 0.021, 0.035, 32]} />
        <primitive object={M.steel} attach="material" />
      </mesh>
      <mesh position-y={0.001} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.034, 32]} />
        <meshStandardMaterial color={baseColor} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Coffret cadeau                                                      */
/* ------------------------------------------------------------------ */

export function GiftBox({ baseColor = COLORS.ink, ink = COLORS.paper, ...props }: PrintProps & GroupProps) {
  const lidTop = useCanvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor
      ctx.fillRect(0, 0, w, h)
      drawMark(ctx, w * 0.3, h * 0.3, 52, ink, 7)
    },
    [baseColor, ink],
  )
  const lidMaterials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.6 })
    const top = new THREE.MeshStandardMaterial({ map: lidTop, roughness: 0.6 })
    return [side, side, top, side, side, side]
  }, [lidTop, baseColor])
  useEffect(() => () => lidMaterials.forEach((m) => m.dispose()), [lidMaterials])
  const ribbon = COLORS.magenta
  return (
    <group {...props}>
      <mesh position-y={0.07} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.22]} />
        <meshStandardMaterial color={baseColor} roughness={0.6} />
      </mesh>
      <mesh position-y={0.155} material={lidMaterials} castShadow>
        <boxGeometry args={[0.23, 0.04, 0.23]} />
      </mesh>
      <mesh position-y={0.088}>
        <boxGeometry args={[0.032, 0.178, 0.234]} />
        <meshStandardMaterial color={ribbon} roughness={0.35} />
      </mesh>
      <mesh position-y={0.088}>
        <boxGeometry args={[0.234, 0.178, 0.032]} />
        <meshStandardMaterial color={ribbon} roughness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.028, 0.19, 0]} rotation={[0, 0, s * 0.5]}>
          <torusGeometry args={[0.03, 0.009, 8, 24]} />
          <meshStandardMaterial color={ribbon} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Carte de visite                                                     */
/* ------------------------------------------------------------------ */

export function BusinessCard({ variant = 'paper', ...props }: GroupProps & { variant?: CardVariant }) {
  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: '#efeae0', roughness: 0.9 })
    const front = new THREE.MeshStandardMaterial({ map: cardFrontTexture(variant), roughness: 0.75 })
    const back = new THREE.MeshStandardMaterial({ map: cardBackTexture(), roughness: 0.85 })
    return [edge, edge, edge, edge, front, back]
  }, [variant])
  return (
    <group {...props}>
      <mesh material={materials} castShadow>
        <boxGeometry args={[0.085, 0.055, 0.0012]} />
      </mesh>
    </group>
  )
}

/** Carte de visite personnalisable (Studio). */
export function CustomCard({ baseColor = COLORS.paper, ink = COLORS.ink, text = '', logo = null, ...props }: PrintProps & GroupProps) {
  const front = useCanvasTexture(
    850,
    550,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor
      ctx.fillRect(0, 0, w, h)
      drawPrint(ctx, 120, 70, w - 240, h - 140, { text, ink, logo })
    },
    [baseColor, ink, text, logo],
  )
  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9 })
    const face = new THREE.MeshStandardMaterial({ map: front, roughness: 0.75 })
    const back = new THREE.MeshStandardMaterial({ map: cardBackTexture(), roughness: 0.85 })
    return [edge, edge, edge, edge, face, back]
  }, [front, baseColor])
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials])
  return (
    <group {...props}>
      <mesh material={materials} castShadow>
        <boxGeometry args={[0.085, 0.055, 0.0012]} />
      </mesh>
    </group>
  )
}
