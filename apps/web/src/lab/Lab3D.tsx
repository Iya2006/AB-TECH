import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BRAND } from '../config/brand'
import { drawPrint } from '../lib/print'
import { StudioLights } from '../sections/Studio3D'
import { Garment3D, type GarmentModel } from '../three/real/Garment3D'

/**
 * Banc d'essai des modèles 3D (développement uniquement) : /labo?m=tshirt&c=%232563eb&az=30&el=10&d=2.2&print=1
 */
function samplePrint(ink: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  drawPrint(ctx, 8, 8, 752, 1008, { text: BRAND.name, ink, sub: 'Impression · Branding' })
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.flipY = false
  tex.anisotropy = 8
  return tex
}

/** Contrôles visuels : ?dbg=face (faces avant en vert, arrière en rouge), ?dbg=uv, ?dbg=ao */
function Debug({ mode }: { mode: string }) {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const id = setInterval(() => {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh || !mesh.userData.garment || mesh.userData.dbg) return
        const src = mesh.material as THREE.MeshPhysicalMaterial
        mesh.userData.dbg = true
        mesh.material = new THREE.ShaderMaterial({
          side: THREE.DoubleSide,
          uniforms: { map: { value: src.aoMap } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader:
            mode === 'face'
              ? 'varying vec2 vUv; void main(){ gl_FragColor = gl_FrontFacing ? vec4(0.,1.,0.,1.) : vec4(1.,0.,0.,1.); }'
              : mode === 'uv'
                ? 'varying vec2 vUv; void main(){ gl_FragColor = vec4(vUv, 0., 1.); }'
                : 'uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.); }',
        })
      })
    }, 500)
    return () => clearInterval(id)
  }, [scene, mode])
  return null
}

export default function Lab3D() {
  const q = new URLSearchParams(location.search)
  const model = (q.get('m') ?? 'tshirt') as GarmentModel
  const color = q.get('c') ?? '#f5f3ee'
  const az = (Number(q.get('az') ?? 25) * Math.PI) / 180
  const el = (Number(q.get('el') ?? 8) * Math.PI) / 180
  const d = Number(q.get('d') ?? 2.3)
  const ty = Number(q.get('ty') ?? 0.36)
  const ink = q.get('ink') ?? '#0e0e10'
  const print = useMemo(() => (q.get('print') ? { texture: samplePrint(ink), place: { x: 0.5, y: 0.42, s: Number(q.get('s') ?? 0.72) } } : null), [])
  const position: [number, number, number] = [Math.sin(az) * Math.cos(el) * d, ty + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d]
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#e9edf2' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position, fov: 30, near: 0.05, far: 50 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}>
        <color attach="background" args={['#e9edf2']} />
        <StudioLights />
        <Suspense fallback={null}>
          <Garment3D model={model} color={color} front={q.get('side') === 'back' ? null : print} back={q.get('side') === 'back' ? print : null} />
        </Suspense>
        <ContactShadows position={[0, -0.12, 0]} scale={2.4} blur={2.6} far={1.2} opacity={0.32} />
        {q.get('dbg') && <Debug mode={q.get('dbg')!} />}
        <OrbitControls target={[0, ty, 0]} />
      </Canvas>
    </div>
  )
}
