import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { journey } from '../../lib/scroll'
import { useApp } from '../../lib/store'
import { usePbr } from '../assets'
import { G, M, PALETTE } from '../materials'
import { concreteTexture, stationSignTexture, techSignTexture } from '../textures'
import { ceilingTileTexture, wallPanelTexture } from './interiorTextures'

export const HALL = {
  halfWidth: 10,
  height: 6,
  end: -72,
  techStart: -50,
  techCeiling: 4.2,
}

const COLUMNS_Z = [-12.6, -22.6, -33.5, -48.6]

/** Panneaux suspendus au-dessus des postes. */
const SIGNS: Array<{ num: string; title: string; position: [number, number, number]; rotation: number }> = [
  { num: '01', title: 'Création', position: [-6.3, 4.75, -9.6], rotation: Math.PI / 2 },
  { num: '02', title: 'Impression', position: [6.4, 4.75, -17.4], rotation: -Math.PI / 2 },
  { num: '03', title: 'Textile', position: [-6.4, 4.75, -27.2], rotation: Math.PI / 2 },
  { num: '04', title: 'Objets', position: [6.2, 4.75, -36.3], rotation: -Math.PI / 2 },
  { num: '05', title: 'Événementiel', position: [-6.8, 4.75, -44], rotation: Math.PI / 2 },
  { num: '06', title: 'Informatique', position: [-6.2, 3.55, -55.6], rotation: Math.PI / 2 },
  { num: '07', title: 'Sécurité', position: [5.2, 3.55, -63.2], rotation: -Math.PI / 2 },
]

/* ------------------------------------------------------------------ */
/* Dalles lumineuses du plafond (animation d'accueil)                  */
/* ------------------------------------------------------------------ */

interface PanelGrid {
  y: number
  rows: number[]
  cols: number[]
  /** Progression à laquelle la rangée 0 s'allume. */
  startAt: number
  step: number
}

const ATELIER_PANELS: PanelGrid = {
  y: 5.985,
  rows: Array.from({ length: 16 }, (_, i) => -2.5 - i * 3),
  cols: [-6.5, -2.2, 2.2, 6.5],
  startAt: 0.1,
  step: 0.0045,
}
const TECH_PANELS: PanelGrid = {
  y: 4.185,
  rows: Array.from({ length: 7 }, (_, i) => -52 - i * 3),
  cols: [-6.5, -2.2, 2.2, 6.5],
  startAt: 0.765,
  step: 0.004,
}

function CeilingPanels({ grid }: { grid: PanelGrid }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const count = grid.rows.length * grid.cols.length
  const on = useMemo(() => new THREE.Color('#f4f8ff').multiplyScalar(2.2), [])
  const dim = useMemo(() => new THREE.Color('#c9d3e0').multiplyScalar(0.55), [])
  const tmp = useMemo(() => new THREE.Color(), [])
  const levels = useRef<number[]>(Array(grid.rows.length).fill(0))

  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const mat = new THREE.Matrix4().makeRotationX(Math.PI / 2)
    grid.rows.forEach((z, r) =>
      grid.cols.forEach((x, c) => {
        mat.setPosition(x, grid.y, z)
        m.setMatrixAt(r * grid.cols.length + c, mat)
        m.setColorAt(r * grid.cols.length + c, dim)
      }),
    )
    m.instanceMatrix.needsUpdate = true
  }, [grid, dim])

  useFrame((_, dt) => {
    const m = mesh.current
    if (!m) return
    const p = journey.progress
    // La nuit, vues de la rue, les dalles restent en veilleuse : on voit l'atelier sans qu'il soit « allumé ».
    const idle = useApp.getState().mood === 'night' ? 0.35 : 0.6
    let changed = false
    grid.rows.forEach((_, r) => {
      const target = p > grid.startAt + r * grid.step ? 1 : idle
      const cur = levels.current[r]!
      const next = THREE.MathUtils.damp(cur, target, 6, dt)
      if (Math.abs(next - cur) > 0.002) {
        levels.current[r] = next
        tmp.copy(dim).lerp(on, next)
        grid.cols.forEach((_, c) => m.setColorAt(r * grid.cols.length + c, tmp))
        changed = true
      }
    })
    if (changed && m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <planeGeometry args={[1.5, 0.55]} />
      <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

/** Spots LED encastrés entre les rangées de dalles lumineuses (une seule instance : 1 appel de dessin). */
const downlightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4e2').multiplyScalar(2.2), toneMapped: false })
function Downlights({ y, rows }: { y: number; rows: number[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const cols = [-8.6, -4.35, 0, 4.35, 8.6]
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const mat = new THREE.Matrix4()
    const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2)
    rows.forEach((z, r) => cols.forEach((x, c) => m.setMatrixAt(r * cols.length + c, mat.makeTranslation(x, y, z).multiply(rot))))
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, y])
  return (
    <instancedMesh ref={ref} args={[undefined, downlightMat, rows.length * cols.length]}>
      <circleGeometry args={[0.075, 16]} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */

function StationSigns() {
  return (
    <group>
      {SIGNS.map((s) => (
        <group key={s.num} position={s.position} rotation-y={s.rotation}>
          {[-0.95, 0.95].map((x) => (
            <mesh key={x} position={[x, 0.7, 0]} material={M.steel}>
              <cylinderGeometry args={[0.004, 0.004, 1.2, 4]} />
            </mesh>
          ))}
          <mesh position-z={-0.012} material={M.navy}>
            <boxGeometry args={[2.3, 0.6, 0.02]} />
          </mesh>
          {[0.001, -0.025].map((z, i) => (
            <mesh key={z} position-z={z} rotation-y={i ? Math.PI : 0}>
              <planeGeometry args={[2.28, 0.57]} />
              <meshBasicMaterial map={stationSignTexture(s.num, s.title)} toneMapped={false} color={[1.15, 1.15, 1.15]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

const aisleMat = new THREE.MeshStandardMaterial({ color: '#dfe6ef', roughness: 0.28, metalness: 0.05 })

/** Murs d'accent en lames de chêne derrière plusieurs postes (une seule instance : 1 appel de dessin). */
const SLAT_WALLS: Array<{ side: -1 | 1; z0: number; z1: number }> = [
  { side: -1, z0: -6.2, z1: -13.2 }, // création
  { side: 1, z0: -13.8, z1: -23.4 }, // impression
  { side: -1, z0: -22.8, z1: -32 }, // textile
  { side: 1, z0: -32.6, z1: -40.4 }, // objets
]
function FeatureSlats() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const { halfWidth: hw } = HALL
  const slats = useMemo(() => SLAT_WALLS.flatMap(({ side, z0, z1 }) => Array.from({ length: Math.floor((z0 - z1) / 0.17) }, (_, i) => [side * (hw - 0.04), z0 - 0.085 - i * 0.17] as const)), [hw])
  useEffect(() => {
    const m = new THREE.Matrix4()
    slats.forEach(([x, z], i) => ref.current?.setMatrixAt(i, m.makeTranslation(x, 2.25, z)))
    if (!ref.current) return
    ref.current.instanceMatrix.needsUpdate = true
    // volume englobant recalculé sur les instances placées (sinon l'ensemble est jugé hors champ)
    ref.current.computeBoundingSphere()
  }, [slats])
  return (
    <instancedMesh ref={ref} args={[undefined, M.oak, slats.length]}>
      <boxGeometry args={[0.06, 4.3, 0.085]} />
    </instancedMesh>
  )
}

export function Hall() {
  const { halfWidth: hw, height: h, end, techStart, techCeiling: ch } = HALL
  const length = -end
  const floor = usePbr('floor', [6, 22])
  const walls = usePbr('plaster', [18, 2])
  // Des textures téléchargées on garde le relief et la rugosité (réalisme), pas la couleur
  // (trop sale pour un atelier moderne) : sol béton lissé clair, murs blancs.
  const floorMat = useMemo(() => {
    const map = concreteTexture().clone()
    map.wrapS = map.wrapT = THREE.RepeatWrapping
    map.repeat.set(5, 18)
    map.needsUpdate = true
    // béton ciré satiné : il renvoie la lumière des dalles du plafond (rendu « boutique moderne »)
    return new THREE.MeshStandardMaterial({
      map,
      normalMap: floor.normalMap,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughnessMap: floor.roughnessMap,
      color: '#eef2f7',
      roughness: 0.36,
      metalness: 0.04,
    })
  }, [floor])
  // murs en grands panneaux (joints tous les 1,2 m), relief d'enduit des textures téléchargées
  const [wallMat, endWallMat] = useMemo(
    () =>
      [length, hw * 2 + 0.6].map(
        (span) =>
          new THREE.MeshStandardMaterial({
            map: wallPanelTexture(span / 2.4, 1),
            normalMap: walls.normalMap,
            normalScale: new THREE.Vector2(0.35, 0.35),
            color: PALETTE.wall,
            roughness: 0.9,
          }),
      ),
    [walls, length, hw],
  )
  // faux plafond en dalles de 60 cm (légèrement émissif : jamais de plafond gris sale), un par volume
  const [ceilingMat, techCeilingMat] = useMemo(
    () =>
      [-techStart, techStart - end].map((span) => {
        const map = ceilingTileTexture((hw * 2) / 2.4, span / 2.4)
        return new THREE.MeshStandardMaterial({ map, emissiveMap: map, color: PALETTE.ceiling, roughness: 1, emissive: '#dfe6f0', emissiveIntensity: 0.45 })
      }),
    [hw, techStart, end],
  )

  const depth = techStart - end
  const zc = (techStart + end) / 2
  const opening = 1.6
  const paneW = hw - opening

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, end / 2]} material={floorMat} receiveShadow>
        <planeGeometry args={[hw * 2, length]} />
      </mesh>
      {/* allée centrale : résine gris perle bordée de deux filets lumineux */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, (techStart - 1) / 2]} material={aisleMat} receiveShadow>
        <planeGeometry args={[2.8, -techStart - 1]} />
      </mesh>
      {[-1.42, 1.42].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, 0.005, (techStart - 1) / 2]} material={G.blue}>
          <planeGeometry args={[0.035, -techStart - 1]} />
        </mesh>
      ))}
      <FeatureSlats />

      {/* murs (l'extérieur forme les côtés du bâtiment) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (hw + 0.15), h / 2, end / 2]} material={wallMat}>
          <boxGeometry args={[0.3, h, length]} />
        </mesh>
      ))}
      <mesh position={[0, h / 2, end - 0.15]} material={endWallMat}>
        <boxGeometry args={[hw * 2 + 0.6, h, 0.3]} />
      </mesh>

      {/* plinthes et filets lumineux bleus */}
      {[-1, 1].flatMap((s) => [
        <mesh key={`p${s}`} position={[s * (hw - 0.01), 0.06, end / 2]} rotation-y={-s * (Math.PI / 2)} material={M.accent}>
          <planeGeometry args={[length, 0.12]} />
        </mesh>,
        <mesh key={`l${s}`} position={[s * (hw - 0.012), 3.2, (techStart - 0.2) / 2]} rotation-y={-s * (Math.PI / 2)} material={G.blue}>
          <planeGeometry args={[-techStart - 0.2, 0.025]} />
        </mesh>,
      ])}

      {/* plafond de l'atelier (visible seulement par en dessous) */}
      <mesh rotation-x={Math.PI / 2} position={[0, h, techStart / 2]} material={ceilingMat}>
        <planeGeometry args={[hw * 2, -techStart]} />
      </mesh>
      <CeilingPanels grid={ATELIER_PANELS} />
      <Downlights y={5.99} rows={Array.from({ length: 15 }, (_, i) => -4 - i * 3)} />

      {COLUMNS_Z.flatMap((z) =>
        [-1, 1].map((s) => (
          <mesh key={`${z}${s}`} position={[s * (hw - 0.25), h / 2, z]} material={M.plinth}>
            <boxGeometry args={[0.5, h, 0.5]} />
          </mesh>
        )),
      )}

      <StationSigns />

      {/* Boutique Tech : plafond bas, cloison vitrée */}
      <mesh rotation-x={Math.PI / 2} position={[0, ch, zc]} material={techCeilingMat}>
        <planeGeometry args={[hw * 2, depth]} />
      </mesh>
      <CeilingPanels grid={TECH_PANELS} />
      <Downlights y={ch - 0.01} rows={Array.from({ length: 6 }, (_, i) => -53.5 - i * 3)} />
      <mesh position={[0, (ch + h) / 2, techStart]} material={M.navy}>
        <boxGeometry args={[hw * 2, h - ch, 0.2]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (opening + paneW / 2), ch / 2, techStart]} material={M.glass}>
            <planeGeometry args={[paneW, ch]} />
          </mesh>
          {[opening, opening + paneW / 3, opening + (paneW * 2) / 3].map((x) => (
            <mesh key={x} position={[s * x, ch / 2, techStart]} material={M.aluminium}>
              <boxGeometry args={[0.06, ch, 0.08]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 3.05, techStart]} material={M.aluminium}>
        <boxGeometry args={[opening * 2, 0.06, 0.08]} />
      </mesh>
      <mesh position={[0, 3.6, techStart]} material={M.glass}>
        <planeGeometry args={[opening * 2, 1.1]} />
      </mesh>
      <mesh position={[0, 5.0, techStart + 0.11]}>
        <planeGeometry args={[4.4, 0.55]} />
        <meshBasicMaterial map={techSignTexture()} transparent toneMapped={false} color={[1.6, 1.6, 1.6]} />
      </mesh>
      {/* lumière d'ambiance de la boutique */}
      <pointLight position={[-5.5, 3.6, -56]} intensity={6} distance={10} decay={2} color="#ffffff" />
      <pointLight position={[5, 3.6, -64]} intensity={6} distance={10} decay={2} color="#ffffff" />
    </group>
  )
}
