import { useGLTF, useTexture } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { createFabricMaterial, createRibMaterial, MODELS_BASE, NO_PRINT, tintFabric, type FabricKind } from './fabric'

/**
 * Vêtements en vraie 3D : maillages issus d'une simulation de tissu (tools/models-3d), dépliés comme leur
 * patron. Le visuel du client se pose dans ce dépliage : il suit les plis et prend la lumière du tissu.
 */

export type GarmentModel = 'tshirt' | 'polo' | 'sweat' | 'pull'
export type PrintSide = 'front' | 'back'

/** Position du visuel dans sa zone : centre (0–1, depuis le coin haut gauche) et taille (1 = toute la zone). */
export interface Place {
  x: number
  y: number
  s: number
}

export interface PrintLayer {
  texture: THREE.Texture
  place: Place
}

interface Zone {
  /** Dans le dépliage, origine en bas à gauche : u, v, largeur, hauteur. */
  uv: [number, number, number, number]
  /** Taille réelle de la zone imprimable, en centimètres. */
  cm: [number, number]
}

export interface GarmentMeta {
  model: string
  metersPerUv: number
  zones: Record<PrintSide, Zone>
}

const FABRIC: Record<GarmentModel, FabricKind> = { tshirt: 'jersey', polo: 'jersey', sweat: 'molleton', pull: 'molleton' }

export const garmentUrl = (model: GarmentModel) => `${MODELS_BASE}/${model}.glb`
const aoUrl = (model: GarmentModel) => `${MODELS_BASE}/${model}-ao.webp`

export function preloadGarment(model: GarmentModel) {
  useGLTF.preload(garmentUrl(model), false, true)
  useTexture.preload(aoUrl(model))
}

interface GarmentPart {
  geometry: THREE.BufferGeometry
  /** Les positions sont compressées (entiers) : cette matrice les remet à l'échelle réelle, en mètres. */
  matrix: THREE.Matrix4
}

interface GarmentAsset {
  fabric: GarmentPart
  rib: GarmentPart | null
  meta: GarmentMeta
}

/** Géométries et réglages d'un vêtement (partagés entre toutes ses copies). */
export function useGarmentAsset(model: GarmentModel): GarmentAsset {
  // décodeur meshopt embarqué (pas de téléchargement externe)
  const gltf = useGLTF(garmentUrl(model), false, true)
  return useMemo(() => {
    let fabric: GarmentPart | null = null
    let rib: GarmentPart | null = null
    let meta: GarmentMeta | null = null
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const raw = (o.userData as { abtech?: string }).abtech
      if (raw) meta = JSON.parse(raw) as GarmentMeta
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const part = { geometry: mesh.geometry, matrix: mesh.matrixWorld.clone() }
      if ((mesh.material as THREE.Material).name.startsWith('cote')) rib = part
      else fabric = part
    })
    if (!fabric || !meta) throw new Error(`Modèle 3D incomplet : ${model}`)
    return { fabric, rib, meta }
  }, [gltf, model])
}

/** Rectangle du visuel dans le dépliage tel que le lit la carte graphique (origine en haut à gauche). */
export function printRect(zone: Zone, place: Place, target = new THREE.Vector4()) {
  const [u, v, w, h] = zone.uv
  const top = 1 - (v + h)
  const pw = w * place.s
  const ph = h * place.s
  return target.set(u + place.x * w - pw / 2, top + place.y * h - ph / 2, pw, ph)
}

/** Position dans la zone (0–1) d'un point du dépliage : sert à déplacer le visuel en le faisant glisser sur le tissu. */
export function uvToZone(zone: Zone, uv: THREE.Vector2) {
  const [u, v, w, h] = zone.uv
  return { x: (uv.x - u) / w, y: (uv.y - (1 - (v + h))) / h }
}

/** Zone (devant ou dos) contenant un point du dépliage, sinon null. */
export function zoneAt(meta: GarmentMeta, uv: THREE.Vector2): PrintSide | null {
  for (const side of ['front', 'back'] as const) {
    const p = uvToZone(meta.zones[side], uv)
    if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) return side
  }
  return null
}

type GroupProps = Omit<ThreeElements['group'], 'children'>

export function Garment3D({
  model,
  color,
  front = null,
  back = null,
  shadows = true,
  ...props
}: GroupProps & { model: GarmentModel; color: string; front?: PrintLayer | null; back?: PrintLayer | null; shadows?: boolean }) {
  const { fabric, rib, meta } = useGarmentAsset(model)
  const ao = useTexture(aoUrl(model))
  const materials = useMemo(() => ({ fabric: createFabricMaterial(FABRIC[model], meta.metersPerUv), rib: createRibMaterial() }), [model, meta])
  useEffect(
    () => () => {
      materials.fabric.dispose()
      materials.rib.dispose()
    },
    [materials],
  )

  useLayoutEffect(() => {
    // même convention que le modèle (origine de l'image en haut à gauche)
    ao.flipY = false
    ao.colorSpace = THREE.NoColorSpace
    ao.needsUpdate = true
    materials.fabric.aoMap = ao
    materials.fabric.needsUpdate = true
  }, [ao, materials])

  useLayoutEffect(() => {
    tintFabric(materials.fabric, color)
    tintFabric(materials.rib, color)
  }, [color, materials])

  useLayoutEffect(() => {
    const u = materials.fabric.userData.fabric
    u.uPrintFront.value = front?.texture ?? NO_PRINT
    u.uPrintBack.value = back?.texture ?? NO_PRINT
    if (front) printRect(meta.zones.front, front.place, u.uRectFront.value)
    if (back) printRect(meta.zones.back, back.place, u.uRectBack.value)
  }, [front, back, materials, meta])

  return (
    <group {...props}>
      <mesh geometry={fabric.geometry} matrix={fabric.matrix} matrixAutoUpdate={false} material={materials.fabric} castShadow={shadows} receiveShadow={shadows} userData={{ garment: meta }} />
      {rib && <mesh geometry={rib.geometry} matrix={rib.matrix} matrixAutoUpdate={false} material={materials.rib} castShadow={shadows} />}
    </group>
  )
}
