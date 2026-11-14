import * as THREE from 'three'

/**
 * Matières textiles réalistes : maille en relief (carte de normales), duvet du tissu (sheen), ombres des plis
 * (occlusion calculée par Blender dans le dépliage du patron) et impression du visuel du client.
 *
 * Le visuel n'est pas « collé » sur une grande texture : c'est un calque à part, placé dans le dépliage par un
 * rectangle (uniform). Le déplacer ou l'agrandir ne renvoie donc rien à la carte graphique, et il reste net.
 */

const BASE = '/assets/models3d'
export const MODELS_BASE = BASE

export type FabricKind = 'jersey' | 'molleton' | 'toile'

/** Taille réelle d'une répétition de la texture de relief, en mètres. */
const TILE: Record<FabricKind | 'cote', number> = { jersey: 0.032, molleton: 0.04, toile: 0.02, cote: 0.04 }

const loader = new THREE.TextureLoader()
const textures = new Map<string, THREE.Texture>()

/** Carte de normales répétable, partagée (une instance par réglage de répétition). */
export function reliefTexture(name: FabricKind | 'cote', repeatX: number, repeatY: number) {
  const key = `${name}:${repeatX.toFixed(3)}:${repeatY.toFixed(3)}`
  let tex = textures.get(key)
  if (!tex) {
    tex = loader.load(`${BASE}/tex/${name}-n.webp`)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
    tex.colorSpace = THREE.NoColorSpace
    tex.anisotropy = 8
    textures.set(key, tex)
  }
  return tex
}

function pixel(r: number, g: number, b: number, a: number) {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
}
/** Aucune impression. */
export const NO_PRINT = pixel(0, 0, 0, 0)
/** Aucune ombre de pli (en attendant la carte d'occlusion). */
export const NO_AO = pixel(255, 255, 255, 255)

export interface FabricUniforms {
  uPrintFront: { value: THREE.Texture }
  uPrintBack: { value: THREE.Texture }
  /** Rectangle du visuel dans le dépliage : u, v (coin bas gauche), largeur, hauteur. */
  uRectFront: { value: THREE.Vector4 }
  uRectBack: { value: THREE.Vector4 }
  /** Rugosité de l'encre (plus lisse que le tissu) et part de duvet qu'elle laisse passer. */
  uInk: { value: THREE.Vector2 }
  /** Assombrissement de l'envers du tissu, et part de l'occlusion appliquée aussi à la lumière directe. */
  uShade: { value: THREE.Vector2 }
}

export type FabricMaterial = THREE.MeshPhysicalMaterial & { userData: { fabric: FabricUniforms } }

const FRAG_HEAD = /* glsl */ `
uniform sampler2D uPrintFront;
uniform sampler2D uPrintBack;
uniform vec4 uRectFront;
uniform vec4 uRectBack;
uniform vec2 uInk;
uniform vec2 uShade;
float abInk = 0.0;
vec4 abPrint(sampler2D map, vec4 rect, vec2 uv) {
  vec2 p = (uv - rect.xy) / rect.zw;
  vec4 c = texture2D(map, p);
  // hors du rectangle : rien
  c.a *= step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
  return c;
}
`

const FRAG_COLOR = /* glsl */ `
#ifdef USE_AOMAP
  float abAo = texture2D(aoMap, vAoMapUv).r;
  if (gl_FrontFacing) {
    vec4 pf = abPrint(uPrintFront, uRectFront, vAoMapUv);
    vec4 pb = abPrint(uPrintBack, uRectBack, vAoMapUv);
    diffuseColor.rgb = mix(diffuseColor.rgb, pf.rgb, pf.a);
    diffuseColor.rgb = mix(diffuseColor.rgb, pb.rgb, pb.a);
    abInk = max(pf.a, pb.a);
    diffuseColor.rgb *= mix(1.0, abAo, uShade.y);
  } else {
    diffuseColor.rgb *= uShade.x * mix(1.0, abAo, 0.5);
  }
#endif
`

/**
 * Tissu : couleur unie, relief de maille, duvet, plis ombrés, et jusqu'à deux impressions (devant, dos).
 * `metersPerUv` : échelle du dépliage (voir tools/models-3d) ; elle règle la taille de la maille.
 */
export function createFabricMaterial(kind: FabricKind, metersPerUv: number): FabricMaterial {
  const tile = TILE[kind]
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: kind === 'toile' ? 0.92 : 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
    aoMap: NO_AO,
    aoMapIntensity: 1,
    // le dépliage est deux fois plus large que haut : u couvre 2 × metersPerUv, v couvre metersPerUv
    normalMap: reliefTexture(kind, (2 * metersPerUv) / tile, metersPerUv / tile),
    normalScale: new THREE.Vector2(0.55, 0.55),
    sheen: kind === 'toile' ? 0.35 : 0.8,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color('#ffffff'),
  }) as FabricMaterial
  const uniforms: FabricUniforms = {
    uPrintFront: { value: NO_PRINT },
    uPrintBack: { value: NO_PRINT },
    uRectFront: { value: new THREE.Vector4(0, 0, 1, 1) },
    uRectBack: { value: new THREE.Vector4(0, 0, 1, 1) },
    uInk: { value: new THREE.Vector2(0.62, 0.25) },
    uShade: { value: new THREE.Vector2(0.62, 0.45) },
  }
  material.userData.fabric = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uInk.x, abInk);`)
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor *= mix(1.0, uInk.y, abInk);\n#endif`,
      )
  }
  material.customProgramCacheKey = () => 'abtech-fabric'
  return material
}

/** Bord-côte (col, poignets) : même teinte que le vêtement, côtes en relief. Dépliage métrique (1 = 4 cm). */
export function createRibMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.95,
    side: THREE.DoubleSide,
    normalMap: reliefTexture('cote', 1, 1),
    normalScale: new THREE.Vector2(0.9, 0.9),
    sheen: 0.7,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color('#ffffff'),
  })
}

/** Teinte du duvet : un voile clair de la couleur du tissu (plus marqué sur les teintes sombres). */
export function tintFabric(material: THREE.MeshPhysicalMaterial, color: string) {
  material.color.set(color)
  const hsl = { h: 0, s: 0, l: 0 }
  material.color.getHSL(hsl)
  material.sheenColor.setHSL(hsl.h, hsl.s * 0.5, Math.min(1, hsl.l * 0.6 + 0.4))
}
