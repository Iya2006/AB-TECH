import * as THREE from 'three'

const targets = new WeakMap<THREE.WebGLRenderer, THREE.WebGLRenderTarget>()

/**
 * Compile en arrière-plan (KHR_parallel_shader_compile : l'image ne se fige pas) les shaders d'un groupe d'objets,
 * dans la variante réellement utilisée. Avec post-traitement (bloom…), la scène est dessinée dans une image
 * intermédiaire (couleurs linéaires, sans tone mapping) : ce ne sont pas les mêmes shaders que pour un dessin
 * direct à l'écran. Compilés pour l'écran, ils seraient recompilés au premier affichage, en figeant l'image.
 */
export function precompile(gl: THREE.WebGLRenderer, object: THREE.Object3D, camera: THREE.Camera, scene: THREE.Scene, offscreen: boolean) {
  const previous = gl.getRenderTarget()
  if (offscreen) {
    let target = targets.get(gl)
    if (!target) targets.set(gl, (target = new THREE.WebGLRenderTarget(1, 1)))
    gl.setRenderTarget(target)
  }
  try {
    return gl.compileAsync(object, camera, scene)
  } finally {
    gl.setRenderTarget(previous)
  }
}

const TEXTURE_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'bumpMap', 'lightMap', 'clearcoatNormalMap'] as const

/** Textures des matériaux d'un groupe : à envoyer à la carte graphique en avance, une par image. */
export function texturesOf(object: THREE.Object3D) {
  const found = new Set<THREE.Texture>()
  object.traverse((o) => {
    const material = (o as THREE.Mesh).material
    if (!material) return
    for (const m of Array.isArray(material) ? material : [material]) {
      const props = m as unknown as Record<string, unknown>
      for (const key of TEXTURE_KEYS) {
        const t = props[key]
        if (t instanceof THREE.Texture && t.image) found.add(t)
      }
    }
  })
  return [...found]
}

/**
 * Verre « transmissif » (extension glTF KHR_materials_transmission) : pour la réfraction, Three.js redessine alors
 * toute la scène une seconde fois à chaque image, avec d'autres shaders. Ici, un simple verre transparent :
 * même allure à cette taille, une seule passe.
 */
export function plainGlass(object: THREE.Object3D) {
  object.traverse((o) => {
    const material = (o as THREE.Mesh).material
    if (!material) return
    for (const m of Array.isArray(material) ? material : [material]) {
      const p = m as THREE.MeshPhysicalMaterial
      if (p.isMeshPhysicalMaterial && p.transmission > 0) {
        p.transmission = 0
        p.thickness = 0
        p.transparent = true
        p.opacity = Math.min(p.opacity, 0.3)
        p.depthWrite = false
        p.needsUpdate = true
      }
    }
  })
}
