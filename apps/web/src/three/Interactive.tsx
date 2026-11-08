import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { GroupProps } from './models/products'

/**
 * Rend un objet de l'atelier cliquable : léger grossissement au survol, curseur main,
 * et ouverture de la galerie / fiche produit au clic (un glisser n'est pas un clic).
 */
export function Interactive({ onSelect, children, hoverScale = 1.05, ...props }: GroupProps & { onSelect: () => void; children: ReactNode; hoverScale?: number }) {
  const inner = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  useFrame((_, dt) => {
    const g = inner.current
    if (!g) return
    const target = hover ? hoverScale : 1
    const s = THREE.MathUtils.damp(g.scale.x, target, 10, dt)
    g.scale.setScalar(s)
  })
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(true)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHover(false)
    document.body.style.cursor = ''
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    document.body.style.cursor = ''
    onSelect()
  }
  return (
    <group {...props}>
      <group ref={inner} onPointerOver={over} onPointerOut={out} onClick={click}>
        {children}
      </group>
    </group>
  )
}
