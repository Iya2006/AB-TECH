import * as THREE from 'three'

/**
 * Nuancier de l'atelier : clair, moderne, accents bleus.
 * Matériaux partagés : une seule instance chacun (moins de shaders à compiler).
 */
export const PALETTE = {
  wall: '#edf2f9',
  ceiling: '#f8fafc',
  floor: '#dde3ea',
  accent: '#2563eb',
  accentLight: '#60a5fa',
  accentSoft: '#dbeafe',
  navy: '#0b1b3a',
  ink: '#0f172a',
}

const std = (color: string, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })
const phys = (color: string, roughness: number, clearcoat = 0.6) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat, clearcoatRoughness: 0.2 })

export const M = {
  paper: std('#f6f5f1', 0.9),
  white: std('#ffffff', 0.55),
  plinth: std('#f4f7fb', 0.6),
  wall: std(PALETTE.wall, 0.95),
  ink: std('#151821', 0.5),
  inkMatte: std('#1c1f27', 0.85),
  graphite: std('#3b4250', 0.55),
  steel: std('#aab1ba', 0.32, 0.85),
  darkSteel: std('#2c3138', 0.38, 0.75),
  chrome: std('#dfe3e8', 0.12, 1),
  aluminium: std('#c9ced6', 0.28, 0.9),
  wood: std('#b48d63', 0.65),
  oak: std('#d6b98f', 0.7),
  plasticWhite: phys('#f5f7fa', 0.35),
  plasticGrey: phys('#c7ccd3', 0.4),
  plasticDark: phys('#22262e', 0.4),
  accent: std(PALETTE.accent, 0.45),
  accentSoft: std(PALETTE.accentSoft, 0.8),
  navy: std(PALETTE.navy, 0.5, 0.2),
  red: phys('#d4202a', 0.3),
  facadeTrim: std('#1f242c', 0.45, 0.6),
  plant: std('#3f6b3a', 0.9),
  soil: std('#2d241c', 1),
  kraft: std('#c9a97c', 0.9),
  cork: std('#b98b5e', 0.95),
  rubber: std('#14161a', 0.9),
  glass: new THREE.MeshPhysicalMaterial({
    color: '#dbe7f0',
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    envMapIntensity: 1.6,
  }),
  smokedGlass: new THREE.MeshPhysicalMaterial({
    color: '#0d1117',
    roughness: 0.06,
    metalness: 0.2,
    transparent: true,
    opacity: 0.85,
  }),
  screenOff: phys('#07090d', 0.15, 1),
}

/** Matériau lumineux (au-delà de 1 pour déclencher le bloom). */
export function glow(color: string, intensity = 2) {
  const c = new THREE.Color(color).multiplyScalar(intensity)
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
}

export const G = {
  warm: glow('#fff1d6', 2.4),
  warmSoft: glow('#ffe7c2', 1.4),
  panel: glow('#f4f8ff', 2.1),
  blue: glow('#60a5fa', 2.4),
  cyan: glow('#5fd8ff', 2.2),
  red: glow('#ff2a2a', 3),
  green: glow('#3dff8a', 2.4),
  white: glow('#ffffff', 1.6),
}
