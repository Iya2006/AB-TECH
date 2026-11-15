import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { PrintSpec } from '../lib/mockup/engine'
import { useApp } from '../lib/store'
import { Garment3D, useGarmentAsset, uvToZone, type GarmentModel, type Place, type PrintSide } from '../three/real/Garment3D'
import { usePrintTexture } from '../three/real/print'

/**
 * Essayage en vraie 3D (Studio) : le vêtement tourne sous le doigt, le visuel se pose sur le tissu
 * (il suit les plis et prend la lumière) et se déplace en le faisant glisser directement sur le vêtement.
 * Chargé à la demande, comme les cartes de visite.
 */

export interface Studio3DApi {
  /** Image de la création (vue de trois quarts du côté imprimé), pour le devis ou le téléchargement. */
  capture: () => Promise<Blob | null>
}

export interface Studio3DProps {
  model: GarmentModel
  color: string
  print: PrintSpec | null
  place: Place
  side: PrintSide
  onPlace: (place: Place) => void
  /** Vue rapprochée sur le marquage. */
  zoom: boolean
  /** Montre la zone imprimable en pointillés. */
  guide: boolean
  active: boolean
  api: MutableRefObject<Studio3DApi | null>
  /** Le modèle est chargé et affiché (appelé à chaque changement de produit). */
  onReady?: () => void
}

const FOV = 30
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
/** Angle de trois quarts : le volume se lit mieux que de face. */
const THREE_QUARTER = 0.3

/**
 * Éclairage de studio photo : grande boîte à lumière en haut à gauche, débouchage doux à droite, contre-jour
 * qui détache les épaules. L'ambiance reste sombre pour que les plis du tissu se lisent, même en blanc.
 */
export function StudioLights({ shadows = true }: { shadows?: boolean }) {
  return (
    <>
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
        <color attach="background" args={['#6f7782']} />
        <Lightformer form="rect" intensity={6.5} position={[-2.8, 3.0, 3.2]} scale={[3.6, 3, 1]} target={[0, 0.4, 0]} />
        <Lightformer form="rect" intensity={1.1} position={[3.6, 1.4, 1.6]} scale={[3, 4, 1]} target={[0, 0.4, 0]} />
        <Lightformer form="rect" intensity={3.4} position={[1.4, 2.6, -3.6]} scale={[4, 2, 1]} target={[0, 0.4, 0]} />
        <Lightformer form="rect" intensity={2.2} position={[-3.4, 1.8, -2.2]} scale={[2, 3, 1]} target={[0, 0.4, 0]} />
        <Lightformer form="rect" intensity={0.45} position={[0, -2, 0]} scale={[6, 6, 1]} target={[0, 0.4, 0]} color="#dfe6ee" />
      </Environment>
      <directionalLight
        position={[-2.2, 3.4, 2.6]}
        intensity={1.25}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-left={-1.1}
        shadow-camera-right={1.1}
        shadow-camera-top={1.3}
        shadow-camera-bottom={-0.6}
      />
    </>
  )
}

interface Orbit {
  /** Décalage choisi par le visiteur autour du côté affiché (radians). */
  az: number
  el: number
  touched: boolean
}

function Scene({ model, color, print, place, side, onPlace, zoom, guide, api, onReady }: Omit<Studio3DProps, 'active'>) {
  const { meta, bounds } = useGarmentAsset(model)
  // monté une fois le modèle téléchargé : le cadre peut retirer son indicateur de chargement
  useEffect(() => onReady?.(), [model, onReady])
  const texture = usePrintTexture(print, meta.zones[side].cm)
  const layer = useMemo(() => (texture ? { texture, place } : null), [texture, place])
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const quality = useApp((s) => s.quality)

  const orbit = useRef<Orbit>({ az: THREE_QUARTER, el: 0.06, touched: false })
  const pose = useRef({ az: THREE_QUARTER + 0.5, el: 0.2, dist: 3.2, ty: 0.36 })
  /** Plateau tournant : c'est le vêtement qui tourne, pas la caméra — le côté regardé reste sous la lumière. */
  const turntable = useRef<THREE.Group>(null)
  const printDrag = useRef<{ dx: number; dy: number } | null>(null)
  const latest = useRef({ place, side, onPlace, hasPrint: !!print })
  latest.current = { place, side, onPlace, hasPrint: !!print }

  // changer de côté ramène la vue de trois quarts (le vêtement fait un demi-tour)
  useEffect(() => {
    orbit.current.az = THREE_QUARTER
    orbit.current.el = 0.06
  }, [side, model])

  const height = bounds.max.y - bounds.min.y
  const halfWidth = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))
  /** Distance qui cadre tout le vêtement, quel que soit le format du cadre. */
  const fit = () => Math.max((height * 0.66) / TAN, (halfWidth * 1.28) / (TAN * (size.width / size.height)))

  const setView = (az: number, el: number, dist: number, ty: number) => {
    if (turntable.current) turntable.current.rotation.y = -az
    camera.position.set(0, ty + Math.sin(el) * dist, Math.cos(el) * dist)
    camera.lookAt(0, ty, 0)
  }

  useFrame(({ clock }, dt) => {
    const o = orbit.current
    const p = pose.current
    const base = latest.current.side === 'back' ? Math.PI : 0
    // tant que le visiteur n'a rien touché : léger balancement, pour montrer que c'est de la 3D
    const sway = o.touched ? 0 : Math.sin(clock.elapsedTime * 0.55) * 0.2
    const k = Math.min(1, dt * 6)
    p.az += (base + o.az + sway - p.az) * k
    p.el += (o.el - p.el) * k
    p.dist += (fit() * (zoom ? 0.56 : 1) - p.dist) * k
    p.ty += (height * (zoom ? 0.64 : 0.5) - p.ty) * k
    setView(p.az, p.el, p.dist, p.ty)
  })

  // rotation au doigt ou à la souris (le glisser du visuel a la priorité)
  useEffect(() => {
    const el = gl.domElement
    let start: { x: number; y: number; az: number; el: number; mouse: boolean } | null = null
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      start = { x: e.clientX, y: e.clientY, az: orbit.current.az, el: orbit.current.el, mouse: e.pointerType === 'mouse' }
      orbit.current.touched = true
    }
    const move = (e: PointerEvent) => {
      if (!start || printDrag.current) return
      orbit.current.az = start.az - (e.clientX - start.x) * 0.0085
      // au doigt, le geste vertical fait défiler la page : seule la souris incline la vue
      if (start.mouse) orbit.current.el = THREE.MathUtils.clamp(start.el + (e.clientY - start.y) * 0.005, -0.3, 0.7)
    }
    const up = () => {
      start = null
      printDrag.current = null
    }
    // un doigt posé sur le visuel le déplace : la page ne doit pas défiler pendant ce geste
    const touch = (e: TouchEvent) => {
      if (printDrag.current) e.preventDefault()
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    el.addEventListener('touchmove', touch, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('touchmove', touch)
    }
  }, [gl])

  /** Position du pointeur dans la zone d'impression (0–1), ou null hors du tissu. */
  const inZone = (e: ThreeEvent<PointerEvent>) => {
    if (!e.uv || !e.object.userData.garment) return null
    return uvToZone(meta.zones[latest.current.side], e.uv)
  }
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const p = inZone(e)
    const { place: pl, hasPrint } = latest.current
    if (!p || !hasPrint) return
    const half = pl.s / 2
    if (Math.abs(p.x - pl.x) > half || Math.abs(p.y - pl.y) > half) return
    printDrag.current = { dx: pl.x - p.x, dy: pl.y - p.y }
    orbit.current.touched = true
  }
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const p = inZone(e)
    const d = printDrag.current
    const { place: pl, hasPrint } = latest.current
    if (d && p) {
      latest.current.onPlace({ ...pl, x: p.x + d.dx, y: p.y + d.dy })
      return
    }
    const over = !!p && hasPrint && Math.abs(p.x - pl.x) <= pl.s / 2 && Math.abs(p.y - pl.y) <= pl.s / 2
    gl.domElement.style.cursor = over ? 'move' : 'grab'
  }

  // capture : vue de trois quarts du côté imprimé, sans les pointillés, sur le fond du studio
  useEffect(() => {
    api.current = {
      capture: () =>
        new Promise((resolve) => {
          const guides: Array<{ value: THREE.Vector4 }> = []
          scene.traverse((o) => {
            const u = ((o as THREE.Mesh).material as THREE.Material | undefined)?.userData?.fabric as { uGuideColor: { value: THREE.Vector4 } } | undefined
            if (u) guides.push(u.uGuideColor)
          })
          const shown = guides.map((g) => g.value.w)
          guides.forEach((g) => (g.value.w = 0))
          const base = latest.current.side === 'back' ? Math.PI : 0
          setView(base + THREE_QUARTER, 0.06, fit(), height * 0.5)
          scene.updateMatrixWorld()
          gl.render(scene, camera)
          const source = gl.domElement
          const canvas = document.createElement('canvas')
          canvas.width = source.width
          canvas.height = source.height
          const ctx = canvas.getContext('2d')!
          const g = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.38, 0, canvas.width / 2, canvas.height * 0.38, Math.max(canvas.width, canvas.height) * 0.75)
          g.addColorStop(0, '#f7f9fc')
          g.addColorStop(1, '#d9e1ec')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(source, 0, 0)
          guides.forEach((gd, i) => (gd.value.w = shown[i]!))
          canvas.toBlob(resolve, 'image/jpeg', 0.92)
        }),
    }
    return () => {
      api.current = null
    }
  })

  const shadows = quality !== 'low'
  return (
    <>
      <StudioLights shadows={shadows} />
      <group ref={turntable}>
      <Garment3D
        model={model}
        color={color}
        front={side === 'front' ? layer : null}
        back={side === 'back' ? layer : null}
        guide={guide ? side : null}
        shadows={shadows}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
      />
      <ContactShadows key={model} position={[0, -0.14, 0]} scale={2.6} blur={2.8} far={1.3} opacity={0.3} frames={1} resolution={512} />
      </group>
    </>
  )
}

export default function Studio3D({ active, ...props }: Studio3DProps) {
  const quality = useApp((s) => s.quality)
  return (
    <Canvas
      className="!absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      shadows={quality !== 'low'}
      dpr={quality === 'high' ? [1, 2] : quality === 'medium' ? [1, 1.5] : [1, 1.25]}
      frameloop={active ? 'always' : 'never'}
      camera={{ fov: FOV, near: 0.05, far: 40, position: [1.2, 0.8, 3] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  )
}
