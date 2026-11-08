import { useEnvironment, useGLTF, useTexture } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { Mood } from '../lib/store'
import { plainGlass } from './precompile'
import { loadBitmap, makeBitmapTexture, makeTexture } from './textureQueue'

/**
 * Ressources réalistes CC0 (Poly Haven) : textures PBR, éclairages HDRI et modèles 3D.
 * Fichiers dans public/assets/ph — compressés pour rester légers sur mobile.
 */
const BASE = '/assets/ph'

export const HDRI = {
  interior: `${BASE}/hdri/decor_shop.hdr`,
  day: `${BASE}/hdri/hausdorf_clear_sky.hdr`,
  night: `${BASE}/hdri/cobblestone_street_night.hdr`,
}

export const MODEL = {
  laptop: `${BASE}/models/classic_laptop/classic_laptop.gltf`,
  cameraBullet: `${BASE}/models/security_camera_01/security_camera_01.gltf`,
  cameraDome: `${BASE}/models/security_camera_02/security_camera_02.gltf`,
  extinguisher: `${BASE}/models/korean_fire_extinguisher_01/korean_fire_extinguisher_01.gltf`,
  plant: `${BASE}/models/potted_plant_02/potted_plant_02.gltf`,
  deskLamp: `${BASE}/models/desk_lamp_arm_01/desk_lamp_arm_01.gltf`,
  steelShelves: `${BASE}/models/steel_frame_shelves_02/steel_frame_shelves_02.gltf`,
  streetLamp: `${BASE}/models/street_lamp_01/street_lamp_01.gltf`,
  // showroom (v6)
  bench: `${BASE}/models/modular_street_seating/modular_street_seating.gltf`,
  bin: `${BASE}/models/metal_trash_can/metal_trash_can.gltf`,
  planter: `${BASE}/models/planter_box_01/planter_box_01.gltf`,
  aircon: `${BASE}/models/exterior_aircon_unit/exterior_aircon_unit.gltf`,
  utilityBox: `${BASE}/models/utility_box_01/utility_box_01.gltf`,
  cashRegister: `${BASE}/models/CashRegister_01/CashRegister_01.gltf`,
  barStool: `${BASE}/models/bar_chair_round_01/bar_chair_round_01.gltf`,
  sofa: `${BASE}/models/sofa_03/sofa_03.gltf`,
  coffeeTable: `${BASE}/models/modern_coffee_table_01/modern_coffee_table_01.gltf`,
  officeChair: `${BASE}/models/modern_arm_chair_01/modern_arm_chair_01.gltf`,
  pendant: `${BASE}/models/hanging_industrial_lamp/hanging_industrial_lamp.gltf`,
  succulent: `${BASE}/models/potted_plant_04/potted_plant_04.gltf`,
  stationery: `${BASE}/models/stationery_supplies/stationery_supplies.gltf`,
  clock: `${BASE}/models/wall_clock/wall_clock.gltf`,
  stockShelves: `${BASE}/models/steel_frame_shelves_03/steel_frame_shelves_03.gltf`,
  box: `${BASE}/models/cardboard_box_01/cardboard_box_01.gltf`,
  drawers: `${BASE}/models/drawer_cabinet/drawer_cabinet.gltf`,
  frame: `${BASE}/models/standing_picture_frame_01/standing_picture_frame_01.gltf`,
} as const
export type ModelId = keyof typeof MODEL

export type PbrRole = 'floor' | 'facade' | 'asphalt' | 'pavement' | 'wood' | 'plaster'

/** Jeu de textures PBR répété sur une surface (chaque appel a ses propres réglages de répétition). */
export function usePbr(role: PbrRole, repeat: [number, number]) {
  const maps = useTexture({
    map: `${BASE}/tex/${role}/diff.jpg`,
    normalMap: `${BASE}/tex/${role}/nor.jpg`,
    roughnessMap: `${BASE}/tex/${role}/rough.jpg`,
  })
  return useMemo(() => {
    const out = {} as typeof maps
    for (const [key, tex] of Object.entries(maps) as Array<[keyof typeof maps, THREE.Texture]>) {
      const t = tex.clone()
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat[0], repeat[1])
      t.anisotropy = 8
      t.colorSpace = key === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace
      t.needsUpdate = true
      out[key] = t
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, repeat[0], repeat[1]])
}

/**
 * Modèle 3D cloné, mis à l'échelle sur une hauteur (ou largeur) cible et posé au sol, centré.
 */
export function useFittedModel(id: ModelId, fit: { height?: number; width?: number; depth?: number }, shadows = false) {
  const { scene } = useGLTF(MODEL[id])
  return useMemo(() => {
    // matériaux partagés par toutes les copies : corrigés une fois (verre réfractif → verre simple, voir plainGlass)
    plainGlass(scene)
    const root = scene.clone(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const scale = fit.height ? fit.height / size.y : fit.width ? fit.width / size.x : fit.depth ? fit.depth / size.z : 1
    root.scale.setScalar(scale)
    const center = box.getCenter(new THREE.Vector3())
    root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = shadows
        mesh.receiveShadow = shadows
      }
    })
    const group = new THREE.Group()
    group.add(root)
    return group
  }, [scene, fit.height, fit.width, fit.depth, shadows])
}

/**
 * Charge une image distante en texture sans bloquer la scène (null tant qu'elle n'est pas prête).
 * Réduite à `max` px : assez pour un cadre vu de près, sans saturer la carte graphique.
 */
export function useLazyTexture(url: string | null | undefined, max = 1024) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) {
      setTex(null)
      return
    }
    let cancelled = false
    // décodée et réduite hors du fil principal
    loadBitmap(url, max)
      .then((bitmap) => (cancelled ? bitmap.close() : setTex(makeBitmapTexture(bitmap))))
      .catch(() => !cancelled && setTex(null))
    return () => {
      cancelled = true
    }
  }, [url, max])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

/** Dessine une image dans un canvas aux proportions d'un support : entière (contain) ou recadrée (cover). */
export function fitImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement | ImageBitmap, w: number, h: number, fit: 'contain' | 'cover') {
  const iw = ('naturalWidth' in img && img.naturalWidth) || img.width
  const ih = ('naturalHeight' in img && img.naturalHeight) || img.height
  const s = fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s)
}

/**
 * Image de l'espace pro (enseigne, photocall…) mise au format d'un support de l'atelier, sur un fond uni.
 * Null tant qu'elle n'est pas prête : le visuel généré reste affiché en attendant.
 */
export function useFittedTexture(url: string | null | undefined, w: number, h: number, fit: 'contain' | 'cover', background: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url) {
      setTex(null)
      return
    }
    let cancelled = false
    // décodée hors du fil principal : la dessiner dans le canvas ne coûte plus rien
    loadBitmap(url, Math.max(w, h), false)
      .then((img) => {
        if (cancelled) return img.close()
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = background
        ctx.fillRect(0, 0, w, h)
        fitImage(ctx, img, w, h, fit)
        img.close()
        setTex(makeTexture(canvas))
      })
      .catch(() => !cancelled && setTex(null))
    return () => {
      cancelled = true
    }
  }, [url, w, h, fit, background])
  useEffect(() => () => tex?.dispose(), [tex])
  return tex
}

/** Éclairage de la rue selon l'heure. */
export const outsideHdri = (mood: Mood) => (mood === 'day' ? HDRI.day : HDRI.night)

/** Ce que montre la façade dès l'arrivée : téléchargé en premier, seul. */
const FIRST_MODELS: ModelId[] = ['streetLamp', 'plant']
const FIRST_PBR: PbrRole[] = ['pavement', 'asphalt', 'floor', 'plaster', 'wood']
// même ordre que usePbr (map, normalMap, roughnessMap) : même entrée de cache
const pbrUrls = (role: PbrRole) => ['diff', 'nor', 'rough'].map((k) => `${BASE}/tex/${role}/${k}.jpg`)

export function preloadFirstView(mood: Mood) {
  useEnvironment.preload({ files: outsideHdri(mood) })
  FIRST_MODELS.forEach((id) => useGLTF.preload(MODEL[id]))
  FIRST_PBR.forEach((role) => useTexture.preload(pbrUrls(role)))
}

/**
 * Le reste de l'atelier, une fois la façade affichée : postes de l'intérieur et autres éclairages
 * (passer de la rue à l'atelier, ou du jour à la nuit, ne fait jamais « noir »).
 */
export function preloadRest() {
  // l'intérieur n'utilise plus d'HDRI (il se reflète dans ses propres dalles) : seuls jour et nuit de la rue
  useEnvironment.preload({ files: HDRI.day })
  useEnvironment.preload({ files: HDRI.night })
  Object.values(MODEL).forEach((url) => useGLTF.preload(url))
}
