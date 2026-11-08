import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFittedModel, usePbr, type ModelId } from '../assets'
import { RoundedBox } from '../RoundedBox'
import { Warm } from '../Warm'
import { G, M } from '../materials'
import { productBoxFaceTexture, screenTexture, type ScreenVariant } from '../textures'
import type { GroupProps } from './products'

/** Modèle 3D importé (Poly Haven), mis à l'échelle automatiquement. */
export function Glb({ model, height, width, shadows = false, ...props }: GroupProps & { model: ModelId; height?: number; width?: number; shadows?: boolean }) {
  const object = useFittedModel(model, { height, width }, shadows)
  return (
    <group {...props}>
      {/* modèle arrivé après son poste : préparé avant d'apparaître (voir Warm) */}
      <Warm>
        <primitive object={object} />
      </Warm>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Informatique                                                        */
/* ------------------------------------------------------------------ */

export function Monitor({ variant = 'design', width = 0.62, ...props }: GroupProps & { variant?: ScreenVariant; width?: number }) {
  const h = width * 0.58
  return (
    <group {...props}>
      <RoundedBox args={[0.22, 0.012, 0.17]} radius={0.005} position-y={0.006} material={M.aluminium} />
      <RoundedBox args={[0.05, h * 0.9, 0.018]} radius={0.008} position={[0, h * 0.45, -0.055]} rotation-x={-0.12} material={M.aluminium} />
      <group position={[0, h * 0.78, 0]}>
        <RoundedBox args={[width, h, 0.022]} radius={0.01} smoothness={3} material={M.plasticWhite} />
        <mesh position-z={0.0115}>
          <planeGeometry args={[width - 0.024, h - 0.05]} />
          <meshBasicMaterial map={screenTexture(variant)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

export function Tower({ color = '#1c1f27', ...props }: GroupProps & { color?: string }) {
  return (
    <group {...props}>
      <RoundedBox args={[0.2, 0.44, 0.42]} radius={0.012} position-y={0.22}>
        <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.3, 0.211]} material={M.smokedGlass}>
        <planeGeometry args={[0.16, 0.22]} />
      </mesh>
      <mesh position={[0.06, 0.4, 0.212]} material={G.blue}>
        <circleGeometry args={[0.008, 16]} />
      </mesh>
      {[0.13, 0.11].map((y) => (
        <mesh key={y} position={[0, y, 0.212]} material={M.graphite}>
          <planeGeometry args={[0.14, 0.004]} />
        </mesh>
      ))}
    </group>
  )
}

/** Touches du clavier : un seul objet instancié (56 touches = 1 appel de rendu). */
function Keys() {
  const mesh = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = mesh.current
    if (!m) return
    const mat = new THREE.Matrix4()
    let i = 0
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 14; c++) {
        mat.makeTranslation(-0.195 + c * 0.03, 0.016, -0.045 + r * 0.03)
        m.setMatrixAt(i++, mat)
      }
    m.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={mesh} args={[undefined, M.plasticGrey, 56]}>
      <boxGeometry args={[0.024, 0.006, 0.024]} />
    </instancedMesh>
  )
}

export function KeyboardSet({ color = '#f5f7fa', ...props }: GroupProps & { color?: string }) {
  return (
    <group {...props}>
      <RoundedBox args={[0.44, 0.014, 0.14]} radius={0.006} position-y={0.007}>
        <meshPhysicalMaterial color={color} roughness={0.4} clearcoat={0.4} />
      </RoundedBox>
      <Keys />
      <mesh position={[0.3, 0.012, 0.01]} scale={[1, 0.5, 1.5]}>
        <sphereGeometry args={[0.026, 24, 16]} />
        <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.6} />
      </mesh>
    </group>
  )
}

export function Router({ color = '#f2f2f2', ...props }: GroupProps & { color?: string }) {
  return (
    <group {...props}>
      <RoundedBox args={[0.26, 0.045, 0.17]} radius={0.015} position-y={0.0225}>
        <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.6} />
      </RoundedBox>
      {[-0.09, -0.03, 0.03, 0.09].map((x, i) => (
        <group key={x} position={[x, 0.045, -0.07]} rotation={[-0.15, 0, (i - 1.5) * 0.12]}>
          <mesh position-y={0.08} material={M.plasticDark}>
            <capsuleGeometry args={[0.008, 0.15, 4, 8]} />
          </mesh>
        </group>
      ))}
      {[-0.08, -0.05, -0.02, 0.01].map((x) => (
        <mesh key={x} position={[x, 0.03, 0.0855]} material={G.blue}>
          <circleGeometry args={[0.004, 12]} />
        </mesh>
      ))}
    </group>
  )
}

/** Boîte produit étiquetée (SSD, onduleur, accessoires…). */
export function ProductBox({ name, color = '#2563eb', size = [0.26, 0.3, 0.12], ...props }: GroupProps & { name: string; color?: string; size?: [number, number, number] }) {
  const materials = useMemo(() => {
    const face = new THREE.MeshStandardMaterial({ map: productBoxFaceTexture(name, color), roughness: 0.6 })
    const side = new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    return [side, side, side, side, face, side]
  }, [name, color])
  return (
    <group {...props}>
      <mesh position-y={size[1] / 2} material={materials}>
        <boxGeometry args={size} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Mobilier                                                            */
/* ------------------------------------------------------------------ */

export function OfficeChair({ color = '#1e293b', ...props }: GroupProps & { color?: string }) {
  return (
    <group {...props}>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i} rotation-y={a}>
            <mesh position={[0, 0.06, 0.16]} rotation-x={Math.PI / 2} material={M.graphite}>
              <capsuleGeometry args={[0.014, 0.3, 4, 8]} />
            </mesh>
            <mesh position={[0, 0.025, 0.32]} material={M.rubber}>
              <sphereGeometry args={[0.025, 12, 8]} />
            </mesh>
          </group>
        )
      })}
      <mesh position-y={0.27} material={M.chrome}>
        <cylinderGeometry args={[0.022, 0.026, 0.36, 16]} />
      </mesh>
      <RoundedBox args={[0.48, 0.07, 0.46]} radius={0.03} position-y={0.48}>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[0.46, 0.55, 0.06]} radius={0.04} position={[0, 0.82, -0.22]} rotation-x={-0.1}>
        <meshStandardMaterial color={color} roughness={0.85} />
      </RoundedBox>
    </group>
  )
}

/** Plateau en chêne texturé sur piètement métal. */
export function Desk({ w, d, h = 0.76, legs = 'steel', ...props }: GroupProps & { w: number; d: number; h?: number; legs?: 'steel' | 'white' }) {
  const wood = usePbr('wood', [w / 1.2, d / 1.2])
  const legMat = legs === 'white' ? M.white : M.darkSteel
  return (
    <group {...props}>
      <RoundedBox args={[w, 0.04, d]} radius={0.01} position-y={h - 0.02} castShadow>
        <meshStandardMaterial {...wood} roughness={0.75} />
      </RoundedBox>
      {/* piètement en cadre (deux montants, patin au sol, traverse haute) : un vrai bureau, pas un bloc */}
      {[-1, 1].map((sx) => (
        <group key={sx} position-x={sx * (w / 2 - 0.08)}>
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, (h - 0.04) / 2, sz * (d / 2 - 0.1)]} material={legMat}>
              <boxGeometry args={[0.045, h - 0.04, 0.045]} />
            </mesh>
          ))}
          <mesh position-y={0.02} material={legMat}>
            <boxGeometry args={[0.05, 0.04, d - 0.12]} />
          </mesh>
          <mesh position-y={h - 0.07} material={legMat}>
            <boxGeometry args={[0.04, 0.04, d - 0.2]} />
          </mesh>
        </group>
      ))}
      {/* voile de fond en retrait */}
      <mesh position={[-(w / 2 - 0.14), h * 0.62, 0]} material={legMat}>
        <boxGeometry args={[0.012, h * 0.45, d - 0.3]} />
      </mesh>
    </group>
  )
}

export function WhiteTable({ w, d, h = 0.9, ...props }: GroupProps & { w: number; d: number; h?: number }) {
  return (
    <group {...props}>
      <RoundedBox args={[w, 0.05, d]} radius={0.012} position-y={h - 0.025} material={M.plasticWhite} castShadow />
      <RoundedBox args={[w - 0.1, h - 0.05, d - 0.2]} radius={0.01} position-y={(h - 0.05) / 2} material={M.white} />
      <mesh position={[0, 0.06, d / 2 - 0.099]} material={M.accent}>
        <boxGeometry args={[w - 0.1, 0.04, 0.002]} />
      </mesh>
    </group>
  )
}
