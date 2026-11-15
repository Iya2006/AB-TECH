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

/** Texture de découpe répétable (filet). */
export function alphaTexture(name: string, repeatX: number, repeatY: number) {
  const key = `a:${name}:${repeatX}:${repeatY}`
  let tex = textures.get(key)
  if (!tex) {
    tex = loader.load(`${BASE}/tex/${name}-a.webp`)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
    tex.colorSpace = THREE.NoColorSpace
    tex.anisotropy = 4
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
  /** Repère de la zone imprimable (pointillés) : rectangle dans le dépliage, couleur et opacité (0 : masqué). */
  uGuide: { value: THREE.Vector4 }
  uGuideColor: { value: THREE.Vector4 }
}

export type FabricMaterial = THREE.MeshPhysicalMaterial & { userData: { fabric: FabricUniforms } }

const FRAG_HEAD = /* glsl */ `
uniform sampler2D uPrintFront;
uniform sampler2D uPrintBack;
uniform vec4 uRectFront;
uniform vec4 uRectBack;
uniform vec2 uInk;
uniform vec2 uShade;
uniform vec4 uGuide;
uniform vec4 uGuideColor;
float abInk = 0.0;
// contour en pointillés d'un rectangle du dépliage, d'épaisseur constante à l'écran
float abGuide(vec4 rect, vec2 uv) {
  vec2 g = (uv - rect.xy) / rect.zw;
  vec2 t = fwidth(g) * 1.6;
  vec2 d = min(g, 1.0 - g);
  float lx = (1.0 - smoothstep(0.0, t.x, abs(d.x))) * step(-t.y, d.y);
  float ly = (1.0 - smoothstep(0.0, t.y, abs(d.y))) * step(-t.x, d.x);
  // le dépliage est deux fois plus large que haut : tirets réguliers le long des quatre côtés
  float dash = step(0.5, fract((g.x * rect.z * 2.0 + g.y * rect.w) * 55.0));
  return max(lx, ly) * dash;
}
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
    if (uGuideColor.a > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, uGuideColor.rgb, abGuide(uGuide, vAoMapUv) * uGuideColor.a);
  } else {
    diffuseColor.rgb *= uShade.x * mix(1.0, abAo, 0.5);
  }
#endif
`

/**
 * Rend une matière « imprimable » : jusqu'à deux visuels (devant, dos) posés dans le dépliage, ombres des plis
 * appliquées aussi à la lumière directe, envers assombri, repère de la zone imprimable.
 * `ink` : rugosité de l'encre et part de duvet qu'elle laisse passer ; `shade` : envers, occlusion directe.
 */
export function makePrintable(base: THREE.MeshPhysicalMaterial, ink: [number, number], shade: [number, number]): FabricMaterial {
  const material = base as FabricMaterial
  // la carte d'occlusion (même vide) donne au shader les coordonnées du dépliage
  if (!material.aoMap) material.aoMap = NO_AO
  const uniforms: FabricUniforms = {
    uPrintFront: { value: NO_PRINT },
    uPrintBack: { value: NO_PRINT },
    uRectFront: { value: new THREE.Vector4(0, 0, 1, 1) },
    uRectBack: { value: new THREE.Vector4(0, 0, 1, 1) },
    uInk: { value: new THREE.Vector2(ink[0], ink[1]) },
    uShade: { value: new THREE.Vector2(shade[0], shade[1]) },
    uGuide: { value: new THREE.Vector4(0, 0, 1, 1) },
    uGuideColor: { value: new THREE.Vector4(0.145, 0.388, 0.922, 0) },
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

/**
 * Tissu : couleur unie, relief de maille, duvet, plis ombrés, et jusqu'à deux impressions (devant, dos).
 * `repeat` : nombre de répétitions de la maille sur le dépliage (u, v).
 */
export function createFabricMaterial(kind: FabricKind, repeat: [number, number]): FabricMaterial {
  return makePrintable(
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: kind === 'toile' ? 0.92 : 0.96,
      metalness: 0,
      side: THREE.DoubleSide,
      aoMapIntensity: 1,
      normalMap: reliefTexture(kind, repeat[0], repeat[1]),
      normalScale: new THREE.Vector2(0.55, 0.55),
      sheen: kind === 'toile' ? 0.35 : 0.8,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color('#ffffff'),
    }),
    [0.62, 0.25],
    [0.62, 0.45],
  )
}

/** Répétitions de la maille pour un vêtement déplié comme son patron (texture 2:1, `metersPerUv` par demi-largeur). */
export function patternRepeat(kind: FabricKind, metersPerUv: number): [number, number] {
  return [(2 * metersPerUv) / TILE[kind], metersPerUv / TILE[kind]]
}

/** Céramique émaillée (mug) : l'impression est prise sous l'émail, aussi brillante que le reste. */
export function createCeramicMaterial(): FabricMaterial {
  return makePrintable(
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide }),
    [0.16, 1],
    [0.92, 0],
  )
}

/** Métal laqué (gourde) : légèrement satiné, l'encre un peu plus mate que la laque. */
export function createLacquerMaterial(): FabricMaterial {
  return makePrintable(
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.34, metalness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.28 }),
    [0.5, 1],
    [1, 0],
  )
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
