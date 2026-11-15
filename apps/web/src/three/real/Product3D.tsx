import { useGLTF, useTexture } from '@react-three/drei'
import type { ThreeElements } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useApp } from '../../lib/store'
import {
  alphaTexture,
  createCeramicMaterial,
  createPlainFabricMaterial,
  createFabricMaterial,
  createLacquerMaterial,
  createRibMaterial,
  MODELS_BASE,
  NO_AO,
  NO_PRINT,
  patternRepeat,
  tintFabric,
  type FabricKind,
  type FabricMaterial,
} from './fabric'

/**
 * Produits en vraie 3D (tools/models-3d) :
 * - vêtements issus d'une simulation de tissu, dépliés comme leur patron ;
 * - objets modélisés (mug, gourde…), dont la paroi imprimable est dépliée autour de l'objet.
 * Le visuel du client se pose dans ce dépliage : il suit la forme et prend la lumière de la matière.
 */

export type Model3D = 'tshirt' | 'polo' | 'sweat' | 'pull' | 'tote' | 'mug' | 'gourde' | 'casquette' | 'snapback' | 'trucker'
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

export interface ProductMeta {
  model: string
  /** « objet » : mug, gourde… ; absent pour un vêtement. */
  kind?: 'objet'
  fabric?: FabricKind
  /** Vêtements : échelle du dépliage (mètres par demi-largeur de texture). */
  metersPerUv?: number
  /** Objets en tissu (casquette) : répétitions de la toile sur le dépliage. */
  repeat?: [number, number]
  height: number
  zones: Partial<Record<PrintSide, Zone>> & { front: Zone }
}

/** `lod` : version allégée, pour la visite de l'atelier (des dizaines de produits à l'écran, vus de loin). */
export const modelUrl = (model: Model3D, lod = false) => `${MODELS_BASE}/${model}${lod ? '-lod' : ''}.glb`
const aoUrl = (model: Model3D) => `${MODELS_BASE}/${model}-ao.webp`
/** Les vêtements ont une carte d'ombres des plis ; les objets rangent leurs ombres dans leurs sommets. */
const HAS_AO_MAP: Record<Model3D, boolean> = { tshirt: true, polo: true, sweat: true, pull: true, tote: true, mug: false, gourde: false, casquette: false, snapback: false, trucker: false }
/** Modèles dont le dos est imprimable. */
export const HAS_BACK: Record<Model3D, boolean> = { tshirt: true, polo: true, sweat: true, pull: true, tote: true, mug: true, gourde: false, casquette: false, snapback: false, trucker: false }

/** Modèle 3D d'une forme de produit du catalogue (null : pas de modèle, le produit reste en photo). */
const MODELS: readonly Model3D[] = ['tshirt', 'polo', 'sweat', 'pull', 'tote', 'mug', 'gourde', 'casquette', 'snapback', 'trucker']
export const model3dOf = (model: string): Model3D | null => ((MODELS as readonly string[]).includes(model) ? (model as Model3D) : null)

export function preloadModel(model: Model3D, lod = false) {
  useGLTF.preload(modelUrl(model, lod), false, true)
  if (HAS_AO_MAP[model]) useTexture.preload(aoUrl(model))
}

type PartKind = 'print' | 'cote' | 'bouton' | 'bouchon' | 'filet' | 'interieur' | 'capuche' | 'cordon'

interface Part {
  geometry: THREE.BufferGeometry
  /** Les positions sont compressées (entiers) : cette matrice les remet à l'échelle réelle, en mètres. */
  matrix: THREE.Matrix4
  kind: PartKind
  /** Nom de la matière dans le fichier (tissu, ceramique, metal…). */
  name: string
}

interface ProductAsset {
  parts: Part[]
  meta: ProductMeta
  /** Encombrement réel, en mètres (base de l'objet à y = 0). */
  bounds: THREE.Box3
}

const PART_KINDS: PartKind[] = ['cote', 'bouton', 'bouchon', 'filet', 'interieur', 'capuche', 'cordon']
const partKind = (name: string): PartKind => PART_KINDS.find((k) => name.startsWith(k)) ?? 'print'

/** Géométries et réglages d'un produit (partagés entre toutes ses copies). */
export function useProductAsset(model: Model3D, lod = false): ProductAsset {
  // décodeur meshopt embarqué (pas de téléchargement externe)
  const gltf = useGLTF(modelUrl(model, lod), false, true)
  return useMemo(() => {
    const parts: Part[] = []
    let meta: ProductMeta | null = null
    const bounds = new THREE.Box3()
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const raw = (o.userData as { abtech?: string }).abtech
      if (raw) meta = JSON.parse(raw) as ProductMeta
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const name = (mesh.material as THREE.Material).name
      parts.push({ geometry: mesh.geometry, matrix: mesh.matrixWorld.clone(), kind: partKind(name), name })
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld))
    })
    if (!parts.some((p) => p.kind === 'print') || !meta) throw new Error(`Modèle 3D incomplet : ${model}`)
    return { parts, meta, bounds }
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

/** Position dans la zone (0–1) d'un point du dépliage : sert à déplacer le visuel en le faisant glisser sur le produit. */
export function uvToZone(zone: Zone, uv: THREE.Vector2) {
  const [u, v, w, h] = zone.uv
  return { x: (uv.x - u) / w, y: (uv.y - (1 - (v + h))) / h }
}

const FULL_ZONE: Place = { x: 0.5, y: 0.5, s: 1 }
const LIGHT = new THREE.Color('#f4f2ec')
const noRaycast = () => null
/** Mailles du filet : environ 3 mm, sur le dépliage de la calotte (tour de tête × hauteur développée). */
const netTexture = () => alphaTexture('filet', 18, 4.5)

function printableMaterial(name: string, meta: ProductMeta, detail: boolean): FabricMaterial {
  if (name.startsWith('ceramique')) return createCeramicMaterial()
  if (name.startsWith('metal')) return createLacquerMaterial()
  const fabric = meta.fabric ?? 'jersey'
  return createFabricMaterial(fabric, meta.repeat ?? patternRepeat(fabric, meta.metersPerUv ?? 1), detail)
}

type GroupProps = Omit<ThreeElements['group'], 'children'>

export function Product3D({
  model,
  color,
  front = null,
  back = null,
  guide = null,
  shadows = true,
  lod = false,
  proxy = false,
  ...props
}: GroupProps & {
  model: Model3D
  color: string
  front?: PrintLayer | null
  back?: PrintLayer | null
  /** Affiche en pointillés la zone imprimable du devant ou du dos. */
  guide?: PrintSide | null
  shadows?: boolean
  /**
   * Version de la visite : maillage allégé, et matières sans relief de maille (à cette distance la maille est
   * plus fine qu'un pixel : elle ne ferait que scintiller).
   */
  lod?: boolean
  /**
   * Clic et survol testés sur une simple boîte englobante au lieu des milliers de triangles du modèle
   * (visite : le pointeur est testé à chaque mouvement contre tous les produits).
   */
  proxy?: boolean
}) {
  const { parts, meta, bounds } = useProductAsset(model, lod)
  const materials = useMemo(() => {
    const printable = parts.find((p) => p.kind === 'print')!
    const detail = !lod
    const print = printableMaterial(printable.name, meta, detail)
    // ombres rangées dans les sommets (objets) : elles multiplient la couleur
    const vertexAo = !!printable.geometry.attributes.color
    print.vertexColors = vertexAo
    /** La pièce a des ombres rangées dans ses sommets (sans elles, activer les couleurs de sommets la rendrait noire). */
    const shaded = (kind: PartKind) => !!parts.find((p) => p.kind === kind)?.geometry.attributes.color
    const make: Record<Exclude<PartKind, 'print'>, () => THREE.Material> = {
      cote: () => createRibMaterial(detail),
      // capuche : même molleton que le corps, ombres rangées dans ses sommets
      capuche: () => createPlainFabricMaterial(meta.fabric ?? 'molleton', detail, shaded('capuche')),
      cordon: () => new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.9, vertexColors: shaded('cordon') }),
      bouton: () => new THREE.MeshPhysicalMaterial({ color: '#f1efe9', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      bouchon: () => new THREE.MeshPhysicalMaterial({ color: '#1b1d21', roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4, vertexColors: vertexAo }),
      // filet du trucker : trous découpés par une texture, visible des deux côtés
      filet: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide, alphaMap: netTexture(), alphaTest: 0.5, alphaToCoverage: true, vertexColors: vertexAo }),
      // bandeau intérieur de la casquette
      interieur: () => new THREE.MeshStandardMaterial({ color: '#23262b', roughness: 0.95, side: THREE.DoubleSide, vertexColors: vertexAo }),
    }
    // seules les matières des pièces présentes sont créées (une casquette n'a ni bord-côte ni bouton)
    const out: { print: FabricMaterial } & Partial<Record<PartKind, THREE.Material>> = { print }
    for (const { kind } of parts) if (kind !== 'print' && !out[kind]) out[kind] = make[kind]()
    // appareils modestes, dans la visite : pas de duvet (le calcul le plus coûteux de la matière textile)
    if (lod && useApp.getState().quality === 'low') {
      for (const m of Object.values(out)) if (m instanceof THREE.MeshPhysicalMaterial) m.sheen = 0
    }
    return out
  }, [parts, meta, lod])
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  useLayoutEffect(() => {
    const u = materials.print.userData.fabric
    const zone = guide ? meta.zones[guide] : null
    u.uGuideColor.value.w = zone ? 0.9 : 0
    if (zone) printRect(zone, FULL_ZONE, u.uGuide.value)
  }, [guide, materials, meta])

  useLayoutEffect(() => {
    tintFabric(materials.print, color)
    for (const kind of ['cote', 'capuche'] as const) if (materials[kind]) tintFabric(materials[kind] as THREE.MeshPhysicalMaterial, color)
    ;(materials.filet as THREE.MeshStandardMaterial | undefined)?.color.set(color)
    // cordons et boutons ton sur ton, éclaircis (nacre sur les teintes sombres)
    for (const kind of ['cordon', 'bouton'] as const) (materials[kind] as THREE.MeshStandardMaterial | undefined)?.color.set(color).lerp(LIGHT, 0.55)
  }, [color, materials])

  useLayoutEffect(() => {
    const u = materials.print.userData.fabric
    const zf = meta.zones.front
    const zb = meta.zones.back
    u.uPrintFront.value = front?.texture ?? NO_PRINT
    u.uPrintBack.value = (zb && back?.texture) || NO_PRINT
    if (front) printRect(zf, front.place, u.uRectFront.value)
    if (back && zb) printRect(zb, back.place, u.uRectBack.value)
  }, [front, back, materials, meta])

  return (
    <group {...props}>
      {HAS_AO_MAP[model] && <AoMap model={model} material={materials.print} />}
      {parts.map((part, i) => (
        <mesh
          key={i}
          geometry={part.geometry}
          matrix={part.matrix}
          matrixAutoUpdate={false}
          material={materials[part.kind]}
          castShadow={shadows}
          receiveShadow={shadows}
          userData={part.kind === 'print' ? { printable: meta } : undefined}
          {...(proxy ? { raycast: noRaycast } : {})}
        />
      ))}
      {proxy && <ProxyBox bounds={bounds} />}
    </group>
  )
}

/** Boîte invisible à la taille du produit : reçoit clics et survols à la place du modèle. */
function ProxyBox({ bounds }: { bounds: THREE.Box3 }) {
  const size = useMemo(() => bounds.getSize(new THREE.Vector3()), [bounds])
  const center = useMemo(() => bounds.getCenter(new THREE.Vector3()), [bounds])
  return (
    <mesh position={center}>
      <boxGeometry args={[size.x, size.y, Math.max(size.z, 0.04)]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  )
}

/** Ombres des plis d'un vêtement (calculées par Blender dans le dépliage du patron). */
function AoMap({ model, material }: { model: Model3D; material: FabricMaterial }) {
  const ao = useTexture(aoUrl(model))
  useLayoutEffect(() => {
    // même convention que le modèle (origine de l'image en haut à gauche)
    ao.flipY = false
    ao.colorSpace = THREE.NoColorSpace
    ao.needsUpdate = true
    material.aoMap = ao
    material.needsUpdate = true
    return () => {
      material.aoMap = NO_AO
    }
  }, [ao, material])
  return null
}
