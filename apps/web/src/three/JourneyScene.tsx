import { ContactShadows, PerformanceMonitor, Sky, Stars, useEnvironment } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { easing } from 'maath'
import { ToneMappingMode } from 'postprocessing'
import { memo, startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { CAMERA_KEYS } from '../journey/chapters'
import type { Quality } from '../lib/device'
import { whenIdle } from '../lib/idle'
import { boot, loading } from '../lib/loading'
import { journey } from '../lib/scroll'
import { useApp, type Mood } from '../lib/store'
import { outsideHdri, preloadFirstView, preloadRest } from './assets'
import { buildInteriorEnvironment } from './interiorEnv'
// (avant preloadFirstView : sur téléphone, les textures allégées sont demandées dès le premier téléchargement)
import { LIGHT_TEXTURES } from './mobileTextures'
import { CreationStation, EvenementielStation, ImpressionStation, ObjetsStation, TextileStation } from './stations/Atelier'
import { InformatiqueStation, SecuriteStation } from './stations/TechStations'
import { TextureWarmup } from './textureQueue'
import { useWarm, Warm, WarmRoot } from './Warm'
import { Exterior } from './world/Exterior'
import { Hall } from './world/Hall'
import { Reception } from './world/Reception'

// avancement réel pour l'écran de chargement (seule la façade est demandée tant qu'il est affiché)
THREE.DefaultLoadingManager.onProgress = (_, loaded, total) => {
  if (!useApp.getState().ready) loading.set(total ? loaded / total : 0)
}
// dès le téléchargement de ce module (lancé à l'ouverture de la page) : la façade d'abord
preloadFirstView(useApp.getState().mood)

/**
 * Délai après la fin du chargement (ms) pendant lequel rien de lourd ne démarre : l'écran de chargement
 * s'ouvre sur la façade (1 s environ) et ne doit pas hoqueter.
 */
const AFTER_INTRO = 1300

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
  const hdri = useEnvironment({ files: outsideHdri(mood) })
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  // Les deux reflets sont préparés ici, chacun d'un bloc, pendant le démarrage (l'écran de chargement attend
  // la fin de ces étapes pour animer son verre). Sinon Three.js prépare celui de la rue au premier dessin
  // d'une matière, au beau milieu de la mise en place de la façade, et tout se fige en même temps.
  const street = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const target = pmrem.fromEquirectangular(hdri)
    pmrem.dispose()
    return target
  }, [gl, hdri])
  useEffect(() => () => street.dispose(), [street])
  const outside = street.texture
  const interior = useMemo(() => buildInteriorEnvironment(gl), [gl])
  useEffect(() => () => interior.dispose(), [interior])

  useEffect(() => {
    const inside = zone === 'inside'
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
/* Lumières                                                            */
/* ------------------------------------------------------------------ */

/**
 * Les lumières ponctuelles de la visite : toujours dans la scène, toujours en même nombre. Three.js compile
 * les shaders de chaque matière pour un nombre donné de lumières ; en masquer une (la façade, dès qu'on est entré)
 * recompilait toutes les matières d'un coup et figeait l'image plus d'une seconde. Seule leur intensité change.
 * Deux d'entre elles servent tour à tour aux réverbères de la rue (la nuit) puis à la boutique tech, au fond
 * de l'atelier : les deux ne sont jamais visibles en même temps.
 */
const ROAMING = [
  { street: [-7.5, 4.6, 10.8], shop: [-5.5, 3.6, -56] },
  { street: [7.5, 4.6, 10.8], shop: [5, 3.6, -64] },
] as const
/** Avant ce point du parcours, la caméra est côté rue (réverbères) ; après, côté atelier (boutique tech). */
const STREET_UNTIL = 0.3

function RoamingLight({ street, shop }: (typeof ROAMING)[number]) {
  const ref = useRef<THREE.PointLight>(null)
  const place = useRef<'street' | 'shop' | null>(null)
  useFrame((_, dt) => {
    const light = ref.current
    if (!light) return
    const wanted = journey.progress < STREET_UNTIL ? 'street' : 'shop'
    // elle ne change de place qu'une fois éteinte : on ne la voit jamais sauter
    if (place.current !== wanted && light.intensity < 0.05) {
      place.current = wanted
      const [x, y, z] = wanted === 'street' ? street : shop
      light.position.set(x, y, z)
      light.color.set(wanted === 'street' ? '#ffd59a' : '#ffffff')
      light.distance = wanted === 'street' ? 16 : 10
    }
    const lampOn = useApp.getState().mood === 'night' && journey.progress < 0.2
    const target = place.current !== wanted ? 0 : wanted === 'shop' ? 6 : lampOn ? 40 : 0
    light.intensity = THREE.MathUtils.damp(light.intensity, target, 4, dt)
  })
  return <pointLight ref={ref} intensity={0} decay={2} />
}

function LightRig() {
  return (
    <>
      {/* façade (visible surtout la nuit), et l'atelier qui éclaire sa vitrine de l'intérieur */}
      <pointLight position={[0, 3.4, 1.4]} intensity={6} distance={7} decay={2} color="#ffe6c4" />
      <pointLight position={[0, 3.2, -3.5]} intensity={22} distance={14} decay={2} color="#f4f8ff" />
      {ROAMING.map((spot, i) => (
        <RoamingLight key={i} {...spot} />
      ))}
    </>
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
 * Poste de l'intérieur, monté après la façade, un à la fois. Il reste caché le temps que la carte graphique
 * compile ses matières (en tâche de fond) et reçoive ses textures ; ensuite il n'est dessiné que lorsque
 * la caméra en est proche.
 */
function Station({ z, shadow, quality, onWarm, children }: { z: number; shadow: [number, number, number, number]; quality: Quality; onWarm: () => void; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const { warm, scope, Provider } = useWarm(ref, onWarm)
  const frames = useRef(0)

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
    <Provider value={scope}>
      <group ref={ref} visible={false}>
        {children}
        {warm && quality !== 'low' && <ContactShadows position={[x, 0.006, sz]} scale={[w, d]} resolution={256} frames={1} far={1.6} blur={2.2} opacity={0.4} />}
      </group>
    </Provider>
  )
}

// Compilation de la façade lancée : reflets et premières images sont faits (le plus lourd pour la carte
// graphique), le verre de l'écran de chargement peut s'animer (il tourne à part, dans un worker).
// Repères de temps (performance.mark, sans coût) : lus par les mesures de fluidité.
const onFirstViewCompile = () => {
  performance.mark('3d:facade-compile')
  boot.set()
}
const onFirstViewWarm = () => void performance.mark('3d:facade-prete')

/**
 * La façade et l'entrée : seules attendues avant de lever le rideau. Une fois leurs modèles, leurs textures et
 * l'éclairage de la rue chargés, elles restent cachées pendant que la carte graphique compile leurs matières
 * en tâche de fond, puis elles sont dessinées quelques images. Mémorisée (comme Scene et les postes) :
 * un nouveau rendu de la page ne redessine jamais tout l'arbre 3D d'un coup.
 */
const FirstView = memo(function FirstView({ onReady }: { onReady: () => void }) {
  useEnvironment({ files: outsideHdri(useApp.getState().mood) })
  const ref = useRef<THREE.Group>(null)
  const { warm, scope, Provider } = useWarm(ref, onFirstViewWarm, onFirstViewCompile)
  const frames = useRef(0)
  useFrame(() => {
    if (!warm) return
    frames.current++
    if (frames.current === 3) onReady()
  })
  return (
    <Provider value={scope}>
      <group ref={ref} visible={warm}>
        <Near z={0} ahead={200} behind={6}>
          <Exterior />
        </Near>
        <Hall />
        {/* l'accueil (vu à travers la vitrine) arrive juste après : il ne retarde pas le lever de rideau */}
        <Suspense fallback={null}>
          <Warm>
            <Near z={-3.6} ahead={40} behind={8}>
              <Reception />
            </Near>
          </Warm>
        </Suspense>
      </group>
    </Provider>
  )
})

/** Un poste et son chargement ; mémorisé : monter le poste suivant ne redessine pas les précédents. */
const StationSlot = memo(function StationSlot({ index, quality, onWarm }: { index: number; quality: Quality; onWarm: (index: number) => void }) {
  const s = STATIONS[index]!
  const warmed = useCallback(() => {
    performance.mark(`3d:poste-${index}-pret`)
    onWarm(index)
  }, [onWarm, index])
  return (
    <Suspense fallback={null}>
      <Station z={s.z} shadow={s.shadow} quality={quality} onWarm={warmed}>
        {s.render(quality)}
      </Station>
    </Suspense>
  )
})

function World({ quality, onLoaded }: { quality: Quality; onLoaded: () => void }) {
  const ready = useApp((s) => s.ready)
  // La façade se monte en transition, après la toute première image : React la construit par petits morceaux
  // (géométries, textures dessinées, objets 3D) entre deux images, au lieu d'un seul bloc de plus d'une demi-seconde.
  const [first, setFirst] = useState(false)
  useEffect(() => startTransition(() => setFirst(true)), [])
  // postes montés : un à la fois, chacun quand le précédent est prêt et que le navigateur a du temps libre
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!ready) return
    // après l'ouverture de l'écran de chargement : rien ne doit la faire hoqueter
    const id = window.setTimeout(() => {
      preloadRest()
      mountNext(1)
    }, AFTER_INTRO)
    return () => window.clearTimeout(id)
  }, [ready])
  // en transition : React prépare le poste par petits morceaux (géométries, textures dessinées), entre deux images
  const mountNext = (n: number) => void whenIdle(() => startTransition(() => setCount((c) => Math.max(c, n))))
  const next = useCallback((i: number) => mountNext(i + 2), [])
  return (
    <group>
      {first && (
        <Suspense fallback={null}>
          <FirstView onReady={onLoaded} />
        </Suspense>
      )}
      {STATIONS.slice(0, count).map((s, i) => (
        <StationSlot key={s.z} index={i} quality={quality} onWarm={next} />
      ))}
    </group>
  )
}

/**
 * Fluidité d'abord : si l'image ralentit durablement, la scène est dessinée en un peu moins de pixels
 * (l'œil ne le voit presque pas). On ne touche jamais aux matières, aux ombres ni aux effets en cours de route :
 * cela recompilerait toute la scène d'un coup, au pire moment.
 */
function AdaptiveResolution({ quality, onDpr }: { quality: Quality; onDpr: (dpr: number) => void }) {
  const ready = useApp((s) => s.ready)
  const viewport = useThree((s) => s.viewport.dpr)
  const current = useRef(viewport)
  current.current = viewport
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!ready) return
    // mesure une fois l'atelier installé (les premiers postes se préparent juste après l'arrivée)
    const id = window.setTimeout(() => setOn(true), AFTER_INTRO + 3000)
    return () => window.clearTimeout(id)
  }, [ready])
  if (!on) return null
  const [low, high] = DPR[quality]
  const max = Math.min(Math.max(low, window.devicePixelRatio || 1), high)
  const apply = (next: number) => {
    const dpr = Math.round(next * 100) / 100
    if (dpr !== current.current) onDpr(dpr)
  }
  return (
    <PerformanceMonitor
      flipflops={4}
      bounds={() => [45, 58]}
      onDecline={() => apply(Math.max(MIN_DPR, current.current * 0.85))}
      onIncline={() => apply(Math.min(max, current.current * 1.1))}
    />
  )
}

const Scene = memo(function Scene({ quality, onLoaded, onDpr }: { quality: Quality; onLoaded: () => void; onDpr: (dpr: number) => void }) {
  const zone = useZone()
  return (
    <WarmRoot offscreen={quality !== 'low'}>
      <Atmosphere zone={zone} quality={quality} />
      <LightRig />
      <CameraRig />
      <TextureWarmup />
      <World quality={quality} onLoaded={onLoaded} />
      {quality !== 'low' && <Effects quality={quality} />}
      <AdaptiveResolution quality={quality} onDpr={onDpr} />
    </WarmRoot>
  )
})

// Jamais sous la résolution native de l'écran (flou), sans dépasser ce que la carte graphique tient.
const DPR: Record<Quality, [number, number]> = {
  high: [1, 1.75],
  medium: [1, 1.35],
  // un peu au-dessus de 1 : textes et panneaux restent lisibles sur les écrans très denses des téléphones
  low: [1, 1.25],
}
/** Plancher de l'adaptation : en dessous, l'image deviendrait floue. */
const MIN_DPR = 0.75

const MAX_RESTARTS = 3

// mémorisée : la page se redessine souvent autour (chapitres, fenêtres), la scène seulement si `active` change
export const JourneyScene = memo(function JourneyScene({ active, onLoaded }: { active: boolean; onLoaded: () => void }) {
  const quality = useApp((s) => s.quality)
  const setQuality = useApp((s) => s.setQuality)
  // résolution réduite par AdaptiveResolution (null : celle de l'écran) ; gardée ici, sinon chaque nouveau
  // rendu du Canvas (visite en pause, fenêtre ouverte…) la remettrait à sa valeur de départ
  const [dpr, setDpr] = useState<number | null>(null)
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
      dpr={dpr ?? DPR[quality]}
      shadows={quality === 'high' ? 'soft' : false}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: quality === 'low', powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping }}
      camera={{ fov: 45, near: 0.05, far: 600, position: [0, 4.6, 21] }}
      onCreated={({ gl, scene }) => {
        performance.mark('3d:canvas')
        // mesures (?perf) : inventaire de la mémoire graphique
        if (new URLSearchParams(location.search).has('perf')) Object.assign(window, { __three: { gl, scene } })
        // appareils modestes : aucune texture au-delà de 1 024 px sur la carte graphique (Three.js réduit au besoin)
        if (LIGHT_TEXTURES) gl.capabilities.maxTextureSize = Math.min(gl.capabilities.maxTextureSize, 1024)
        // en production, pas de lecture des journaux de compilation (allers-retours avec la carte graphique)
        gl.debug.checkShaderErrors = import.meta.env.DEV
        watch(gl)
      }}
    >
      <Scene quality={quality} onLoaded={onLoaded} onDpr={setDpr} />
    </Canvas>
  )
})
