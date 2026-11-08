import { RoundedBox, useFBO } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Quality } from '../../lib/device'
import { journey } from '../../lib/scroll'
import { productsOf, realisationsOf, useSite } from '../../lib/site'
import { useApp } from '../../lib/store'
import { Frame, realisationItems } from '../Gallery'
import { Interactive } from '../Interactive'
import { G, M } from '../materials'
import { Desk, Glb, Monitor, WhiteTable } from '../models/devices'
import { Pendant } from '../world/Reception'
import type { GroupProps } from '../models/products'
import { ProductDisplay } from '../ProductDisplay'
import { createCanvas, drawCctvOverlay, drawMark, drawWordmark, screenTexture, toTexture, cachedTexture, COLORS } from '../textures'

const FACE_PLUS_X = Math.PI / 2
const FACE_MINUS_X = -Math.PI / 2
const inTech = () => journey.progress > 0.74 && journey.progress < 0.98

/* ------------------------------------------------------------------ */
/* Boutique informatique                                               */
/* ------------------------------------------------------------------ */

/** Étagère murale blanche à tablettes en chêne. */
function ShelfUnit({ width, levels, depth = 0.42, ...props }: GroupProps & { width: number; levels: number[]; depth?: number }) {
  const top = levels[levels.length - 1]! + 0.5
  return (
    <group {...props}>
      <mesh position={[0, top / 2, -depth / 2 + 0.01]} material={M.white}>
        <boxGeometry args={[width, top, 0.02]} />
      </mesh>
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, top / 2, 0]} material={M.white}>
          <boxGeometry args={[0.03, top, depth]} />
        </mesh>
      ))}
      {levels.map((y) => (
        <group key={y} position-y={y}>
          <mesh position-y={-0.015} material={M.oak}>
            <boxGeometry args={[width, 0.03, depth]} />
          </mesh>
          <mesh position={[0, -0.03, depth / 2 - 0.004]} material={G.blue}>
            <boxGeometry args={[width - 0.04, 0.006, 0.006]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const counterFront = () =>
  cachedTexture('counter-front', 1024, 400, (ctx, w, h) => {
    ctx.fillStyle = COLORS.accent
    ctx.fillRect(0, 0, w, h)
    drawMark(ctx, 150, h / 2, 70, '#ffffff', 9)
    drawWordmark(ctx, 280, h / 2 + 40, 130, '#ffffff', 'left')
  })

function Counter(props: GroupProps) {
  return (
    <group {...props}>
      <RoundedBox args={[2.2, 1.0, 0.7]} radius={0.03} position-y={0.5} material={M.white} castShadow />
      <mesh position={[0, 0.48, 0.351]}>
        <planeGeometry args={[2.1, 0.82]} />
        <meshStandardMaterial map={counterFront()} roughness={0.5} />
      </mesh>
      <RoundedBox args={[2.3, 0.04, 0.78]} radius={0.01} position-y={1.02} material={M.oak} />
      <group position={[0.5, 1.04, -0.05]} rotation-x={-0.3}>
        <RoundedBox args={[0.3, 0.2, 0.02]} radius={0.01} position-y={0.1} material={M.plasticDark} />
        <mesh position={[0, 0.1, 0.011]}>
          <planeGeometry args={[0.27, 0.17]} />
          <meshBasicMaterial map={screenTexture('shop')} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Bureau conseil : on y configure le matériel avec le client (écran, portable, deux fauteuils). */
function AdviceDesk(props: GroupProps) {
  return (
    <group {...props}>
      <Desk w={0.85} d={1.6} />
      <group position={[-0.15, 0.76, 0.25]} rotation-y={FACE_PLUS_X}>
        <Monitor variant="design" width={0.6} />
      </group>
      <Suspense fallback={null}>
        <Glb model="laptop" width={0.36} position={[0.12, 0.76, -0.45]} rotation-y={FACE_PLUS_X - 0.3} />
        <Glb model="officeChair" height={0.95} position={[0.85, 0, -0.1]} rotation-y={-FACE_PLUS_X + 0.15} />
        <Glb model="officeChair" height={0.95} position={[-0.8, 0, 0.2]} rotation-y={FACE_PLUS_X - 0.1} />
        <Glb model="stationery" height={0.12} position={[0.2, 0.76, 0.65]} />
      </Suspense>
    </group>
  )
}

/** Baie de brassage avec voyants d'activité réseau. */
function NetworkRack(props: GroupProps) {
  const leds = useRef<THREE.InstancedMesh>(null)
  const cols = 12
  const rows = 8
  const on = useMemo(() => new THREE.Color('#3dff8a').multiplyScalar(2.5), [])
  const amber = useMemo(() => new THREE.Color('#ffb020').multiplyScalar(2.2), [])
  const off = useMemo(() => new THREE.Color('#0d2a18'), [])
  useLayoutEffect(() => {
    const mesh = leds.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        m.makeTranslation(-0.2 + c * 0.036, 0.35 + r * 0.16, 0)
        mesh.setMatrixAt(r * cols + c, m)
        mesh.setColorAt(r * cols + c, on)
      }
    mesh.instanceMatrix.needsUpdate = true
  }, [on])
  const last = useRef(0)
  useFrame(({ clock }) => {
    const mesh = leds.current
    if (!mesh || !inTech() || clock.elapsedTime - last.current < 0.09) return
    last.current = clock.elapsedTime
    for (let i = 0; i < 14; i++) {
      const idx = Math.floor(Math.random() * rows * cols)
      const v = Math.random()
      mesh.setColorAt(idx, v > 0.55 ? on : v > 0.45 ? amber : off)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return (
    <group {...props}>
      <RoundedBox args={[0.62, 1.9, 0.8]} radius={0.02} position-y={0.95} material={M.inkMatte} castShadow />
      {Array.from({ length: rows }, (_, r) => (
        <mesh key={r} position={[0, 0.35 + r * 0.16, 0.38]} material={M.darkSteel}>
          <boxGeometry args={[0.5, 0.06, 0.06]} />
        </mesh>
      ))}
      <instancedMesh ref={leds} args={[undefined, undefined, rows * cols]} position-z={0.415}>
        <boxGeometry args={[0.012, 0.012, 0.004]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <mesh position={[0, 0.95, 0.405]} material={M.smokedGlass}>
        <planeGeometry args={[0.58, 1.84]} />
      </mesh>
    </group>
  )
}

const TABLE_SLOTS = [-1.5, -0.5, 0.5, 1.5]
const SHELF_LEVELS = [0.55, 1.2, 1.85]
const SHELF_SLOTS = [-2.25, -0.75, 0.75, 2.25]
/** Point de vue du poste (voir journey/chapters) : la table et les produits lui font face. */
const INFO_EYE = [-0.9, -52.3] as const
const TABLE_AT = [-6.0, -55.9] as const
const faceEye = (x: number, z: number) => Math.atan2(INFO_EYE[0] - x, INFO_EYE[1] - z)

export function InformatiqueStation() {
  const products = useSite((s) => s.products)
  const list = productsOf(products, 'informatique')
  const onTable = list.slice(0, TABLE_SLOTS.length)
  const onShelves = list.slice(TABLE_SLOTS.length, TABLE_SLOTS.length + SHELF_LEVELS.length * SHELF_SLOTS.length)
  return (
    <group>
      {/* table de présentation, grand côté face au visiteur */}
      <group position={[TABLE_AT[0], 0, TABLE_AT[1]]} rotation-y={faceEye(TABLE_AT[0], TABLE_AT[1])}>
        <WhiteTable w={4.2} d={1.2} />
        {onTable.map((p, i) => (
          <ProductDisplay key={p.id} product={p} position={[TABLE_SLOTS[i]!, 0.9, 0]} scale={1.6} seed={i} />
        ))}
      </group>
      <ShelfUnit width={6} levels={SHELF_LEVELS} position={[-9.75, 0, -55.6]} rotation-y={FACE_PLUS_X} />
      {onShelves.map((p, i) => {
        const level = SHELF_LEVELS[Math.floor(i / SHELF_SLOTS.length)]!
        const slot = SHELF_SLOTS[i % SHELF_SLOTS.length]!
        const z = -55.6 - slot
        // étiquette au survol : les étagères du fond ne recouvrent pas celles de la table
        return <ProductDisplay key={p.id} product={p} position={[-9.55, level, z]} rotation-y={faceEye(-9.55, z)} scale={1.15} tag="hover" />
      })}
      <Counter position={[-3.6, 0, -61.6]} />
      <Interactive position={[-9.3, 0, -66.2]} rotation-y={FACE_PLUS_X} onSelect={() => useApp.getState().open({ type: 'machine', id: 'baie-reseau' })} hoverScale={1.03}>
        <NetworkRack />
      </Interactive>
      <Suspense fallback={null}>
        <Glb model="steelShelves" height={2.1} position={[-9.2, 0, -69.6]} rotation-y={FACE_PLUS_X} />
        <Glb model="plant" height={1.1} position={[-2.2, 0, -51.2]} />
        {/* stock en cartons au pied des rayonnages */}
        <Glb model="box" height={0.45} position={[-8.55, 0, -68.6]} rotation-y={0.2} />
        <Glb model="box" height={0.45} position={[-8.6, 0.45, -68.65]} rotation-y={-0.15} />
        <Glb model="box" height={0.38} position={[-8.1, 0, -69.3]} rotation-y={0.9} />
        {/* suspensions au-dessus de la table d'exposition (plafond bas de l'espace Tech) */}
        {[-0.7, 0.7].map((dz) => (
          <Pendant key={dz} position={[TABLE_AT[0], 2.75, TABLE_AT[1] + dz]} ceiling={4.2} />
        ))}
      </Suspense>
      <AdviceDesk position={[-7.6, 0, -60.9]} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Sécurité                                                            */
/* ------------------------------------------------------------------ */

/**
 * Caméra bullet qui balaie la pièce. Avec une qualité suffisante, ce qu'elle « filme »
 * est rendu en direct sur l'écran de contrôle voisin.
 */
function CctvSystem({ quality }: { quality: Quality }) {
  const pan = useRef<THREE.Group>(null)
  const lens = useRef<THREE.Object3D>(null)
  const cone = useRef<THREE.Mesh>(null)
  const screen = useRef<THREE.Group>(null)
  const live = quality !== 'low'
  const fbo = useFBO(640, 360)
  const cam = useMemo(() => new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 45), [])
  const overlay = useMemo(() => {
    const canvas = createCanvas(640, 360)
    const ctx = canvas.getContext('2d')!
    drawCctvOverlay(ctx, 640, 360, new Date())
    return { ctx, tex: toTexture(canvas) }
  }, [])
  const coneGeometry = useMemo(() => {
    const g = new THREE.ConeGeometry(0.85, 3.2, 32, 1, true)
    g.rotateX(Math.PI / 2)
    g.translate(0, 0, -1.6)
    return g
  }, [])
  const frame = useRef(0)
  const lastSecond = useRef(-1)

  useFrame(({ gl, scene, clock }) => {
    if (!inTech()) return
    const t = clock.elapsedTime
    if (pan.current) pan.current.rotation.y = FACE_PLUS_X + Math.sin(t * 0.35) * 0.55

    const second = Math.floor(Date.now() / 1000)
    if (second !== lastSecond.current) {
      lastSecond.current = second
      drawCctvOverlay(overlay.ctx, 640, 360, new Date())
      overlay.tex.needsUpdate = true
    }

    if (!live || frame.current++ % 2 !== 0 || !lens.current || !screen.current || !cone.current) return
    lens.current.getWorldPosition(cam.position)
    lens.current.getWorldQuaternion(cam.quaternion)
    screen.current.visible = false
    cone.current.visible = false
    gl.setRenderTarget(fbo)
    // le composer désactive l'effacement automatique : on vide couleur + profondeur nous-mêmes
    gl.clear(true, true, true)
    gl.render(scene, cam)
    gl.setRenderTarget(null)
    screen.current.visible = true
    cone.current.visible = true
  })

  return (
    <group>
      <group position={[9.82, 3.5, -62.8]}>
        <RoundedBox args={[0.03, 0.18, 0.14]} radius={0.01} material={M.plasticWhite} />
        <mesh position={[-0.16, 0, 0]} material={M.plasticWhite}>
          <boxGeometry args={[0.32, 0.035, 0.035]} />
        </mesh>
        <group ref={pan} position={[-0.32, -0.04, 0]} rotation-y={FACE_PLUS_X}>
          <group rotation-x={-0.32}>
            <mesh position-z={-0.1} rotation-x={Math.PI / 2} material={M.plasticWhite} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 0.26, 24]} />
            </mesh>
            <RoundedBox args={[0.13, 0.014, 0.32]} radius={0.006} position={[0, 0.058, -0.12]} material={M.plasticWhite} />
            <mesh position-z={-0.231} rotation-x={Math.PI} material={M.smokedGlass}>
              <circleGeometry args={[0.044, 24]} />
            </mesh>
            <mesh position-z={-0.232} material={G.red} rotation-x={Math.PI}>
              <ringGeometry args={[0.03, 0.036, 24]} />
            </mesh>
            <object3D ref={lens} position-z={-0.25} />
            <mesh ref={cone} geometry={coneGeometry} position-z={-0.24}>
              <meshBasicMaterial color="#7fdcff" transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        </group>
      </group>

      <group ref={screen} position={[9.83, 2.05, -65.6]} rotation-y={FACE_MINUS_X}>
        <RoundedBox args={[1.7, 1.0, 0.05]} radius={0.015} position-z={-0.03} material={M.ink} />
        <mesh position-z={0.001}>
          <planeGeometry args={[1.6, 0.9]} />
          {live ? (
            // l'éclairage de la boutique est maîtrisé : léger « gain » façon caméra de surveillance
            <meshBasicMaterial map={fbo.texture} toneMapped={false} color={[1.25, 1.4, 1.3]} />
          ) : (
            <meshBasicMaterial map={screenTexture('cctv')} toneMapped={false} />
          )}
        </mesh>
        <mesh position-z={0.003}>
          <planeGeometry args={[1.6, 0.9]} />
          <meshBasicMaterial map={overlay.tex} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function SmokeDetector(props: GroupProps) {
  const led = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (led.current) led.current.visible = clock.elapsedTime % 2 < 0.15
  })
  return (
    <group {...props}>
      <mesh position-y={-0.018} material={M.plasticWhite}>
        <cylinderGeometry args={[0.08, 0.075, 0.036, 32]} />
      </mesh>
      <mesh position-y={-0.036} rotation-x={Math.PI / 2} material={M.plasticGrey}>
        <torusGeometry args={[0.05, 0.004, 8, 32]} />
      </mesh>
      <mesh ref={led} position={[0.03, -0.038, 0.03]} material={G.red}>
        <sphereGeometry args={[0.006, 8, 8]} />
      </mesh>
    </group>
  )
}

function Sprinkler(props: GroupProps) {
  return (
    <group {...props}>
      <mesh position-y={-0.04} material={M.chrome}>
        <cylinderGeometry args={[0.012, 0.012, 0.08, 12]} />
      </mesh>
      <mesh position-y={-0.09} material={M.chrome}>
        <cylinderGeometry args={[0.03, 0.03, 0.004, 16]} />
      </mesh>
      <mesh position-y={-0.065} material={G.red}>
        <cylinderGeometry args={[0.004, 0.004, 0.03, 8]} />
      </mesh>
    </group>
  )
}

function DomeCamera(props: GroupProps) {
  return (
    <group {...props}>
      <mesh position-y={-0.015} material={M.plasticWhite}>
        <cylinderGeometry args={[0.09, 0.09, 0.03, 32]} />
      </mesh>
      <mesh position-y={-0.03} material={M.smokedGlass}>
        <sphereGeometry args={[0.07, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, -0.075, 0.02]} material={G.red}>
        <sphereGeometry args={[0.005, 8, 8]} />
      </mesh>
    </group>
  )
}

/** Portique tripode : les bras pivotent d'un tiers de tour à chaque passage. */
function Turnstile(props: GroupProps) {
  const arms = useRef<THREE.Group>(null)
  const light = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!arms.current || !inTech()) return
    const cycle = clock.elapsedTime % 3.2
    const step = Math.floor(clock.elapsedTime / 3.2)
    const turning = Math.min(1, Math.max(0, (cycle - 2) / 0.8))
    const eased = turning * turning * (3 - 2 * turning)
    arms.current.rotation.x = (step + eased) * ((Math.PI * 2) / 3)
    if (light.current) light.current.material = cycle > 1.6 ? G.green : G.red
  })
  return (
    <group {...props}>
      <RoundedBox args={[0.3, 0.96, 0.8]} radius={0.03} position-y={0.48} material={M.steel} castShadow />
      <RoundedBox args={[0.32, 0.04, 0.82]} radius={0.01} position-y={0.98} material={M.inkMatte} />
      <mesh ref={light} position={[0, 1.005, 0.3]} material={G.red}>
        <boxGeometry args={[0.12, 0.01, 0.05]} />
      </mesh>
      <mesh position={[0, 1.03, -0.22]} material={M.ink}>
        <boxGeometry args={[0.1, 0.05, 0.14]} />
      </mesh>
      <group ref={arms} position={[-0.17, 0.82, 0]}>
        <mesh rotation-z={Math.PI / 2} material={M.chrome}>
          <cylinderGeometry args={[0.05, 0.05, 0.06, 16]} />
        </mesh>
        {[0, 1, 2].map((i) => {
          const a = (i * Math.PI * 2) / 3
          return (
            <mesh key={i} position={[-0.03, Math.cos(a) * 0.25, Math.sin(a) * 0.25]} rotation-x={a} material={M.chrome}>
              <cylinderGeometry args={[0.016, 0.016, 0.5, 10]} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

/** Centrale incendie + déclencheur manuel, à côté de l'extincteur. */
function FirePanel(props: GroupProps) {
  const led = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (led.current) led.current.visible = clock.elapsedTime % 1.5 < 0.75
  })
  return (
    <group {...props}>
      <RoundedBox args={[0.42, 0.52, 0.12]} radius={0.015} position-y={1.55} material={M.red} />
      <mesh position={[0, 1.62, 0.061]} material={M.smokedGlass}>
        <planeGeometry args={[0.3, 0.16]} />
      </mesh>
      {[-0.12, -0.06, 0, 0.06, 0.12].map((x, i) => (
        <mesh key={x} ref={i === 0 ? led : undefined} position={[x, 1.45, 0.062]} material={i === 0 ? G.red : G.green}>
          <circleGeometry args={[0.012, 12]} />
        </mesh>
      ))}
      <RoundedBox args={[0.12, 0.12, 0.05]} radius={0.01} position={[0.38, 1.4, 0]} material={M.red} />
      <mesh position={[0.38, 1.4, 0.026]} material={M.paper}>
        <planeGeometry args={[0.08, 0.08]} />
      </mesh>
    </group>
  )
}

function AccessDoor() {
  return (
    <group>
      <RoundedBox args={[1.2, 2.2, 0.06]} radius={0.01} position={[6.7, 1.1, -71.82]} material={M.steel} />
      <mesh position={[6.25, 1.05, -71.77]} material={M.chrome}>
        <boxGeometry args={[0.03, 0.25, 0.03]} />
      </mesh>
      <group position={[7.65, 1.35, -71.82]}>
        <RoundedBox args={[0.1, 0.16, 0.03]} radius={0.008} material={M.inkMatte} />
        <mesh position={[0, 0.06, 0.016]} material={G.green}>
          <planeGeometry args={[0.03, 0.008]} />
        </mesh>
      </group>
    </group>
  )
}

/** Emplacements des réalisations « sécurité » (caissons au mur). */
const SECURITY_FRAMES: Array<{ position: [number, number, number]; rotation: number; w: number; h: number }> = [
  { position: [9.83, 2.3, -59.8], rotation: FACE_MINUS_X, w: 1.9, h: 1.15 },
  { position: [9.83, 2.3, -69.1], rotation: FACE_MINUS_X, w: 2.1, h: 1.15 },
  { position: [3.6, 2.3, -71.83], rotation: 0, w: 2.2, h: 1.3 },
]

export function SecuriteStation({ quality }: { quality: Quality }) {
  const ceiling = 4.2
  const realisations = useSite((s) => s.realisations)
  const products = useSite((s) => s.products)
  const items = useMemo(() => realisationItems(realisationsOf(realisations, 'securite')), [realisations])
  const forSale = productsOf(products, 'securite').slice(0, 3)
  return (
    <group>
      {items.slice(0, SECURITY_FRAMES.length).map((item, i) => {
        const slot = SECURITY_FRAMES[i]!
        return <Frame key={item.key} item={item} maxW={slot.w} maxH={slot.h} mat={false} position={slot.position} rotation-y={slot.rotation} />
      })}
      {/* placé en coordonnées de la pièce : pas de grossissement au survol, seulement le clic */}
      <Interactive onSelect={() => useApp.getState().open({ type: 'machine', id: 'videosurveillance' })} hoverScale={1}>
        <CctvSystem quality={quality} />
      </Interactive>
      <DomeCamera position={[6.2, ceiling, -63.2]} />
      <DomeCamera position={[-4.5, ceiling, -57]} />
      <SmokeDetector position={[2.6, ceiling, -61.4]} />
      <SmokeDetector position={[-2.6, ceiling, -66]} />
      <Sprinkler position={[2.6, ceiling, -65]} />
      <Sprinkler position={[-2.6, ceiling, -60]} />
      <Turnstile position={[6.6, 0, -66.4]} />
      <AccessDoor />
      <FirePanel position={[8.9, 0, -71.8]} />
      {/* poste de supervision sous l'écran de contrôle : l'opérateur regarde les caméras */}
      <group position={[8.95, 0, -65.6]}>
        <Desk w={0.8} d={1.8} />
        {[-0.38, 0.38].map((dz) => (
          <Monitor key={dz} variant="cctv" width={0.55} position={[0.12, 0.76, dz]} rotation-y={FACE_MINUS_X + (dz > 0 ? 0.18 : -0.18)} />
        ))}
        <Suspense fallback={null}>
          <Glb model="officeChair" height={0.95} position={[-0.95, 0, 0]} rotation-y={FACE_PLUS_X} />
        </Suspense>
      </group>
      <Suspense fallback={null}>
        <Glb model="extinguisher" height={0.62} position={[9.6, 0.05, -70.6]} rotation-y={FACE_MINUS_X} />
      </Suspense>
      <group position={[3.9, 0, -62.6]}>
        <WhiteTable w={0.9} d={2.7} />
        {forSale.map((p, i) => (
          <ProductDisplay key={p.id} product={p} position={[0, 0.9, -0.9 + i * 0.9]} rotation-y={FACE_MINUS_X + 0.4} scale={1.6} seed={i} />
        ))}
      </group>
    </group>
  )
}
