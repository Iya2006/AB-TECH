import { ContactShadows, PerformanceMonitor, Sky, Stars, useEnvironment } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { easing } from 'maath'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { CAMERA_KEYS } from '../journey/chapters'
import type { Quality } from '../lib/device'
import { loading } from '../lib/loading'
import { journey } from '../lib/scroll'
import { useApp, type Mood } from '../lib/store'
import { outsideHdri, preloadFirstView, preloadRest } from './assets'
import { buildInteriorEnvironment } from './interiorEnv'
import { CreationStation, EvenementielStation, ImpressionStation, ObjetsStation, TextileStation } from './stations/Atelier'
import { InformatiqueStation, SecuriteStation } from './stations/TechStations'
import { TextureWarmup } from './textureQueue'
import { Exterior } from './world/Exterior'
import { Hall } from './world/Hall'
import { Reception } from './world/Reception'

// avancement réel pour l'écran de chargement (seule la façade est demandée tant qu'il est affiché)
THREE.DefaultLoadingManager.onProgress = (_, loaded, total) => {
  if (!useApp.getState().ready) loading.set(total ? loaded / total : 0)
}
// dès le téléchargement de ce module (lancé à l'ouverture de la page) : la façade d'abord
preloadFirstView(useApp.getState().mood)

/* ------------------------------------------------------------------ */
/* Caméra pilotée par le scroll                                        */
/* ------------------------------------------------------------------ */

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * Trajectoire continue (spline centripète) passant par chaque point de vue : la caméra ne s'arrête plus
 * net à chaque poste, elle infléchit sa course comme quelqu'un qui marche. Les cadrages restent exacts.
 */
const PATH = {
  pos: new THREE.CatmullRomCurve3(CAMERA_KEYS.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal'),
  look: new THREE.CatmullRomCurve3(CAMERA_KEYS.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal'),
}

function sampleCamera(p: number, pos: THREE.Vector3, look: THREE.Vector3) {
  let i = 0
  while (i < CAMERA_KEYS.length - 2 && p > CAMERA_KEYS[i + 1]!.t) i++
  const a = CAMERA_KEYS[i]!
  const b = CAMERA_KEYS[i + 1]!
  const s = Math.min(1, Math.max(0, (p - a.t) / (b.t - a.t)))
  // léger ralenti aux points de vue (le temps de regarder le poste), sans arrêt complet
  const eased = s + (smootherstep(s) - s) * 0.4
  const u = (i + eased) / (CAMERA_KEYS.length - 1)
  PATH.pos.getPoint(u, pos)
  PATH.look.getPoint(u, look)
}

function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const target = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), [])
  const look = useRef(new THREE.Vector3())
  const pointer = useRef({ x: 0, y: 0 })
  const portrait = size.width < size.height

  useEffect(() => {
    sampleCamera(journey.progress, camera.position, look.current)
    camera.lookAt(look.current)
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [camera])

  useEffect(() => {
    const aspect = size.width / size.height
    // En portrait, on élargit le champ pour garder chaque poste dans le cadre.
    camera.fov = aspect >= 1 ? 45 : Math.min(74, 45 + (1 - aspect) * 58)
    camera.updateProjectionMatrix()
  }, [camera, size])

  useFrame((_, dt) => {
    sampleCamera(journey.progress, target.pos, target.look)
    target.pos.x += pointer.current.x * 0.22
    target.pos.y += pointer.current.y * 0.1
    // portrait : regard un peu plus bas, le sujet remonte dans l'écran (le texte occupe le bas)
    if (portrait) target.look.y -= 0.9
    easing.damp3(camera.position, target.pos, 0.16, dt)
    easing.damp3(look.current, target.look, 0.16, dt)
    camera.lookAt(look.current)
  })
  return null
}

/* ------------------------------------------------------------------ */
/* Zones et ambiance                                                   */
/* ------------------------------------------------------------------ */

type Zone = 'outside' | 'inside' | 'overview'
const zoneAt = (p: number): Zone => (p < 0.105 ? 'outside' : p > 0.95 ? 'overview' : 'inside')

/** Zone courante (rue / atelier / vue aérienne), mise à jour seulement quand elle change. */
function useZone() {
  const [zone, setZone] = useState<Zone>(() => zoneAt(journey.progress))
  useFrame(() => {
    const z = zoneAt(journey.progress)
    if (z !== zone) setZone(z)
  })
  return zone
}

interface Ambience {
  bg: string
  fogNear: number
  fogFar: number
  hemi: number
  sun: number
  exposure: number
}

const AMBIENCE: Record<Mood, Record<Zone, Ambience>> = {
  day: {
    outside: { bg: '#cfe1f3', fogNear: 40, fogFar: 160, hemi: 0.9, sun: 2.6, exposure: 1 },
    // brouillard intérieur très léger : les postes du fond restent nets
    inside: { bg: '#eef2f7', fogNear: 34, fogFar: 130, hemi: 1.0, sun: 1.2, exposure: 1 },
    overview: { bg: '#8fa6bf', fogNear: 60, fogFar: 220, hemi: 0.95, sun: 2.4, exposure: 1 },
  },
  night: {
    outside: { bg: '#05070d', fogNear: 22, fogFar: 95, hemi: 0.1, sun: 0.35, exposure: 1.05 },
    inside: { bg: '#eef2f7', fogNear: 34, fogFar: 130, hemi: 1.05, sun: 0.9, exposure: 1 },
    overview: { bg: '#05070d', fogNear: 40, fogFar: 140, hemi: 0.3, sun: 0.3, exposure: 1.05 },
  },
}

/**
 * Reflets : l'HDRI de la rue dehors, l'environnement de l'atelier (calculé une fois, après la façade) dedans.
 * Changer de zone ne fait qu'échanger deux textures déjà prêtes.
 */
function EnvironmentSwitch({ zone }: { zone: Zone }) {
  const mood = useApp((s) => s.mood)
  const outside = useEnvironment({ files: outsideHdri(mood) })
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const [interior, setInterior] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    // calcul différé : la façade est déjà affichée, le visiteur ne voit rien
    const id = window.setTimeout(() => setInterior(buildInteriorEnvironment(gl)), 1200)
    return () => window.clearTimeout(id)
  }, [gl])
  useEffect(() => () => interior?.dispose(), [interior])

  useEffect(() => {
    const inside = zone === 'inside' && interior
    scene.environment = inside ? interior : outside
    scene.environmentIntensity = inside ? 0.85 : mood === 'day' ? 0.9 : 0.35
  }, [zone, interior, outside, mood, scene])
  useEffect(
    () => () => {
      scene.environment = null
    },
    [scene],
  )
  return null
}

function Atmosphere({ zone, quality }: { zone: Zone; quality: Quality }) {
  const mood = useApp((s) => s.mood)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sun = useRef<THREE.DirectionalLight>(null)
  const fog = useMemo(() => new THREE.Fog('#05070d', 30, 120), [])
  const bg = useMemo(() => new THREE.Color('#05070d'), [])
  const targetBg = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    scene.fog = fog
    scene.background = bg
    return () => {
      scene.fog = null
      scene.background = null
    }
  }, [scene, fog, bg])

  useFrame((_, dt) => {
    const a = AMBIENCE[mood][zone]
    targetBg.set(a.bg)
    easing.dampC(bg, targetBg, 0.4, dt)
    fog.color.copy(bg)
    fog.near = THREE.MathUtils.damp(fog.near, a.fogNear, 3, dt)
    fog.far = THREE.MathUtils.damp(fog.far, a.fogFar, 3, dt)
    gl.toneMappingExposure = THREE.MathUtils.damp(gl.toneMappingExposure, a.exposure, 3, dt)
    if (hemi.current) hemi.current.intensity = THREE.MathUtils.damp(hemi.current.intensity, a.hemi, 3, dt)
    if (sun.current) sun.current.intensity = THREE.MathUtils.damp(sun.current.intensity, a.sun, 3, dt)
  })

  const day = mood === 'day'
  // À l'intérieur, l'atelier est éclairé comme en journée (seule la rue change avec l'heure).
  const lit = day || zone === 'inside'
  const shadows = quality === 'high'

  // Ombres du soleil : la lumière les projette toujours (basculer castShadow recompilerait tous les matériaux
  // au passage de la porte) ; à l'intérieur, on cesse simplement de les recalculer.
  useEffect(() => {
    gl.shadowMap.autoUpdate = zone !== 'inside'
    gl.shadowMap.needsUpdate = true
  }, [gl, zone])

  return (
    <>
      {/* couleurs en propriétés (et non en arguments) : la lumière n'est jamais recréée en changeant de zone */}
      <hemisphereLight ref={hemi} color={lit ? '#dcebff' : '#7d8fb8'} groundColor={lit ? '#dfe4ec' : '#1c2230'} intensity={1} />
      <directionalLight
        ref={sun}
        position={day ? [14, 20, 16] : [-12, 22, 12]}
        color={day ? '#fff4e2' : '#9db7ff'}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      <Suspense fallback={null}>
        <EnvironmentSwitch zone={zone} />
      </Suspense>
      {day ? (
        <Sky distance={450} sunPosition={[14, 20, 16]} turbidity={3.2} rayleigh={1.1} mieCoefficient={0.004} mieDirectionalG={0.85} />
      ) : (
        <Stars radius={120} depth={40} count={2500} factor={3.2} saturation={0} fade speed={0.4} />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Post-traitement                                                     */
/* ------------------------------------------------------------------ */

function Effects({ quality }: { quality: Quality }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    // Le tone mapping est appliqué par le composer (après le bloom).
    gl.toneMapping = THREE.NoToneMapping
    return () => {
      gl.toneMapping = THREE.NeutralToneMapping
    }
  }, [gl])
  // Occlusion ambiante (N8AO) : réservée aux appareils puissants.
  return quality === 'high' ? (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.6} distanceFalloff={0.6} intensity={2.2} halfRes />
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.65} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.3} darkness={0.42} />
    </EffectComposer>
  ) : (
    // anticrénelage léger en qualité moyenne : bords nets sans surcharger la carte graphique
    <EffectComposer multisampling={2}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.65} radius={0.7} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.3} darkness={0.42} />
    </EffectComposer>
  )
}

/* ------------------------------------------------------------------ */
/* Monde                                                               */
/* ------------------------------------------------------------------ */

/** Un poste de l'atelier, avec sa zone d'ombre au sol (x, z, largeur, profondeur). */
const STATIONS: Array<{ z: number; shadow: [number, number, number, number]; render: (quality: Quality) => ReactNode }> = [
  { z: -10, shadow: [-6.3, -9.6, 2.6, 3.8], render: () => <CreationStation /> },
  { z: -18, shadow: [6.2, -18.5, 3.4, 9], render: () => <ImpressionStation /> },
  { z: -26, shadow: [-6.2, -27.4, 3.2, 7], render: () => <TextileStation /> },
  { z: -36, shadow: [6.0, -36.3, 3.2, 7.4], render: () => <ObjetsStation /> },
  { z: -44, shadow: [-6.6, -44, 4.6, 6.6], render: () => <EvenementielStation /> },
  { z: -56, shadow: [-6.4, -56, 2.6, 6], render: () => <InformatiqueStation /> },
  { z: -64, shadow: [5.0, -64.5, 4, 6], render: (quality) => <SecuriteStation quality={quality} /> },
]

const isNear = (z: number, ahead: number, behind: number, cameraZ: number) => {
  const dz = cameraZ - z
  return journey.progress > 0.93 || (dz < ahead && dz > -behind)
}

/**
 * Ne dessine la façade que lorsque la caméra en est proche : beaucoup moins d'objets à chaque image.
 * Les premières images la montrent quoi qu'il arrive, pour préparer ombres et shaders sous l'écran de chargement.
 */
function Near({ z, ahead = 34, behind = 7, children }: { z: number; ahead?: number; behind?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const frames = useRef(0)
  useFrame(({ camera }) => {
    if (!ref.current) return
    frames.current++
    ref.current.visible = frames.current < 4 || isNear(z, ahead, behind, camera.position.z)
  })
  return <group ref={ref}>{children}</group>
}

/**
 * Poste de l'intérieur, monté après la façade. Tant que la carte graphique compile ses matériaux (en tâche de fond,
 * sans figer l'image), il reste caché ; ensuite il n'est dessiné que lorsque la caméra en est proche.
 */
function Station({ z, shadow, quality, children }: { z: number; shadow: [number, number, number, number]; quality: Quality; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const [warm, setWarm] = useState(false)
  const frames = useRef(0)

  useLayoutEffect(() => {
    const group = ref.current
    if (!group) return
    let off = false
    group.visible = true
    gl.compileAsync(group, camera, scene)
      .catch(() => {})
      .finally(() => !off && setWarm(true))
    group.visible = false
    return () => {
      off = true
    }
  }, [gl, camera, scene])

  useFrame(({ camera }) => {
    if (!ref.current) return
    if (!warm) {
      ref.current.visible = false
      return
    }
    // trois images visibles au départ : l'ombre de contact se calcule une fois, objets en place
    frames.current++
    ref.current.visible = frames.current < 4 || isNear(z, 34, 7, camera.position.z)
  })

  const [x, sz, w, d] = shadow
  return (
    <group ref={ref}>
      {children}
      {warm && quality !== 'low' && <ContactShadows position={[x, 0.006, sz]} scale={[w, d]} resolution={256} frames={1} far={1.6} blur={2.2} opacity={0.4} />}
    </group>
  )
}

/**
 * La façade et l'entrée : seules attendues avant de lever le rideau. Prêtes quand leurs modèles, leurs textures
 * et l'éclairage de la rue sont chargés, puis dessinés quelques images (shaders compilés, textures envoyées).
 */
function FirstView({ onReady }: { onReady: () => void }) {
  useEnvironment({ files: outsideHdri(useApp.getState().mood) })
  const frames = useRef(0)
  useFrame(() => {
    if (++frames.current === 3) onReady()
  })
  return (
    <>
      <Near z={0} ahead={200} behind={6}>
        <Exterior />
      </Near>
      <Hall />
      {/* l'accueil (vu à travers la vitrine) arrive juste après : il ne retarde pas le lever de rideau */}
      <Suspense fallback={null}>
        <Near z={-3.6} ahead={40} behind={8}>
          <Reception />
        </Near>
      </Suspense>
    </>
  )
}

function World({ quality, onLoaded }: { quality: Quality; onLoaded: () => void }) {
  const [inside, setInside] = useState(false)
  const onReady = useCallback(() => {
    onLoaded()
    preloadRest()
    // les postes de l'intérieur se chargent ensuite, pendant que le visiteur découvre la façade
    setTimeout(() => setInside(true), 400)
  }, [onLoaded])
  return (
    <group>
      <Suspense fallback={null}>
        <FirstView onReady={onReady} />
      </Suspense>
      {inside &&
        STATIONS.map((s) => (
          <Suspense key={s.z} fallback={null}>
            <Station z={s.z} shadow={s.shadow} quality={quality}>
              {s.render(quality)}
            </Station>
          </Suspense>
        ))}
    </group>
  )
}

function Scene({ quality, onLoaded }: { quality: Quality; onLoaded: () => void }) {
  const zone = useZone()
  return (
    <>
      <Atmosphere zone={zone} quality={quality} />
      <CameraRig />
      <TextureWarmup />
      <World quality={quality} onLoaded={onLoaded} />
      {quality !== 'low' && <Effects quality={quality} />}
    </>
  )
}

// Jamais sous la résolution native de l'écran (flou), sans dépasser ce que la carte graphique tient.
const DPR: Record<Quality, [number, number]> = {
  high: [1, 1.75],
  medium: [1, 1.35],
  // un peu au-dessus de 1 : textes et panneaux restent lisibles sur les écrans très denses des téléphones
  low: [1, 1.25],
}

const DOWNGRADE: Record<Quality, Quality> = { high: 'medium', medium: 'low', low: 'low' }
const MAX_RESTARTS = 3

export function JourneyScene({ active, onLoaded }: { active: boolean; onLoaded: () => void }) {
  const quality = useApp((s) => s.quality)
  const setQuality = useApp((s) => s.setQuality)
  // Si la carte graphique « décroche » (contexte WebGL perdu), on relance la scène en qualité basse
  // au lieu de laisser un écran noir figé.
  const [epoch, setEpoch] = useState(0)
  const watch = (gl: THREE.WebGLRenderer) => {
    gl.domElement.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault()
        if (epoch >= MAX_RESTARTS) return
        setQuality('low')
        setTimeout(() => setEpoch((n) => n + 1), 300)
      },
      { once: true },
    )
  }
  return (
    <Canvas
      key={epoch}
      className="!absolute inset-0"
      dpr={DPR[quality]}
      shadows={quality === 'high' ? 'soft' : false}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping }}
      camera={{ fov: 45, near: 0.05, far: 600, position: [0, 4.6, 21] }}
      onCreated={({ gl }) => watch(gl)}
    >
      <PerformanceMonitor flipflops={2} bounds={() => [40, 58]} onDecline={() => setQuality(DOWNGRADE[useApp.getState().quality])} />
      <Scene quality={quality} onLoaded={onLoaded} />
    </Canvas>
  )
}
