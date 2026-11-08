import type { ThreeElements } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Boîte aux arêtes arrondies, à l'identique de celle de drei, mais dont la forme n'est calculée qu'une fois
 * par taille : l'atelier en compte plus de cent cinquante, et le lissage des arêtes (toCreasedNormals) coûtait
 * plus d'une demi-seconde au chargement. Les copies partagent la même géométrie (jamais libérée : elle sert encore).
 */

const EPS = 0.00001
const cache = new Map<string, THREE.BufferGeometry>()

function shapeOf(width: number, height: number, radius0: number) {
  const shape = new THREE.Shape()
  const radius = radius0 - EPS
  shape.absarc(EPS, EPS, EPS, -Math.PI / 2, -Math.PI, true)
  shape.absarc(EPS, height - radius * 2, EPS, Math.PI, Math.PI / 2, true)
  shape.absarc(width - radius * 2, height - radius * 2, EPS, Math.PI / 2, 0, true)
  shape.absarc(width - radius * 2, EPS, EPS, 0, -Math.PI / 2, true)
  return shape
}

export function roundedBoxGeometry(width: number, height: number, depth: number, radius = 0.05, smoothness = 4, bevelSegments = 4, steps = 1, creaseAngle = 0.4) {
  const key = `${width}|${height}|${depth}|${radius}|${smoothness}|${bevelSegments}|${steps}|${creaseAngle}`
  let geometry = cache.get(key)
  if (!geometry) {
    const extruded = new THREE.ExtrudeGeometry(shapeOf(width, height, radius), {
      depth: depth - radius * 2,
      bevelEnabled: true,
      bevelSegments: bevelSegments * 2,
      steps,
      bevelSize: radius - EPS,
      bevelThickness: radius,
      curveSegments: smoothness,
    })
    extruded.center()
    geometry = toCreasedNormals(extruded, creaseAngle)
    if (geometry !== extruded) extruded.dispose()
    cache.set(key, geometry)
  }
  return geometry
}

type Props = Omit<ThreeElements['mesh'], 'args' | 'geometry'> & {
  args?: [width?: number, height?: number, depth?: number]
  radius?: number
  smoothness?: number
  bevelSegments?: number
  steps?: number
  creaseAngle?: number
}

export function RoundedBox({ args: [width = 1, height = 1, depth = 1] = [], radius = 0.05, smoothness = 4, bevelSegments = 4, steps = 1, creaseAngle = 0.4, children, ...rest }: Props) {
  const geometry = useMemo(
    () => roundedBoxGeometry(width, height, depth, radius, smoothness, bevelSegments, steps, creaseAngle),
    [width, height, depth, radius, smoothness, bevelSegments, steps, creaseAngle],
  )
  return (
    <mesh geometry={geometry} {...rest}>
      {children}
    </mesh>
  )
}
