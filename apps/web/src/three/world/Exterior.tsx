import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { BRAND } from '../../config/brand'
import { FONT } from '../../lib/print'
import { journey } from '../../lib/scroll'
import { useSite } from '../../lib/site'
import { useApp } from '../../lib/store'
import { fitImage, useFittedTexture, useLazyTexture, usePbr } from '../assets'
import { thumb } from '../Gallery'
import { G, M } from '../materials'
import { Glb } from '../models/devices'
import { createCanvas, drawScreenSlide, openSignTexture, SCREEN_SLIDES, signTexture, subSignTexture, toTexture, vinylTexture } from '../textures'
import { loadImage } from '../textureQueue'
import { BikeRack, BladeSign, Canopy, GlassSheen, Parking, StreetFurniture, Totem, WallWasher } from './Storefront'
import { compositePanelTexture, neighbourTexture, signHaloTexture, stoneCladTexture } from './storefrontTextures'

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const W = 10.45 // demi-largeur de la façade

function Block({ x: [x0, x1], y: [y0, y1], z: [z0, z1], material }: { x: [number, number]; y: [number, number]; z: [number, number]; material: THREE.Material }) {
  return (
    <mesh position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} material={material} castShadow receiveShadow>
      <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Devanture moderne                                                   */
/* ------------------------------------------------------------------ */

const darkMetal = new THREE.MeshStandardMaterial({ color: '#1a202b', roughness: 0.42, metalness: 0.65 })
const whitePanel = new THREE.MeshStandardMaterial({ color: '#f1f4f8', roughness: 0.5 })
const granite = new THREE.MeshStandardMaterial({ color: '#262b34', roughness: 0.3, metalness: 0.15 })

const PORTAL = 8.6 // demi-largeur du portique de la vitrine
const GLASS_TOP = 3.75

/** Grande vitrine à montants fins, de part et d'autre de la porte. */
function Glazing() {
  const panes = (dir: -1 | 1) => {
    const from = 1.3
    const step = (PORTAL - 0.45 - from) / 3
    return [0, 1, 2, 3].map((k) => dir * (from + k * step))
  }
  return (
    <group position-z={0.1}>
      {[-1, 1].map((dir) => {
        const cx = dir * ((PORTAL - 0.45 + 1.3) / 2)
        const w = PORTAL - 0.45 - 1.3
        return (
          <group key={dir}>
            <mesh position={[cx, (GLASS_TOP + 0.12) / 2, 0]} material={M.glass}>
              <planeGeometry args={[w, GLASS_TOP - 0.12]} />
            </mesh>
            {panes(dir as -1 | 1).map((x) => (
              <mesh key={x} position={[x, GLASS_TOP / 2, 0.02]} material={darkMetal}>
                <boxGeometry args={[0.06, GLASS_TOP, 0.1]} />
              </mesh>
            ))}
          </group>
        )
      })}
      {/* imposte au-dessus des portes */}
      <mesh position={[0, (GLASS_TOP + 3.05) / 2, 0]} material={M.glass}>
        <planeGeometry args={[2.6, GLASS_TOP - 3.05]} />
      </mesh>
      <mesh position={[0, 3.05, 0.02]} material={darkMetal}>
        <boxGeometry args={[(PORTAL - 0.45) * 2, 0.07, 0.1]} />
      </mesh>
      <mesh position={[0, 0.1, 0.02]} material={darkMetal}>
        <boxGeometry args={[(PORTAL - 0.45) * 2, 0.08, 0.1]} />
      </mesh>
    </group>
  )
}

/** Vitrine de gauche : de vrais T-shirts sur un portant, une casquette sur un cube. */
function TextileWindow() {
  const tees = ['tshirt-noir', 'tshirt', 'polo-marine'].map((f) => `/media/catalogue/${f}.webp`)
  return (
    <group position={[-5.0, 0, -0.75]}>
      <mesh position={[0, 2.5, 0]} rotation-z={Math.PI / 2} material={M.chrome}>
        <cylinderGeometry args={[0.014, 0.014, 2.6, 10]} />
      </mesh>
      {[-1.15, 1.15].map((x) => (
        <mesh key={x} position={[x, 2.95, 0]} material={M.chrome}>
          <cylinderGeometry args={[0.006, 0.006, 0.9, 6]} />
        </mesh>
      ))}
      {tees.map((url, i) => (
        <WindowPhoto key={url} url={url} height={0.95} position={[-0.75 + i * 0.75, 2.53, 0.02 * i]} anchor="top" />
      ))}
      <mesh position={[1.6, 0.3, 0.2]} material={whitePanel} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
      </mesh>
      <WindowPhoto url="/media/catalogue/casquette-noir.webp" height={0.3} position={[1.6, 0.6, 0.2]} anchor="bottom" />
    </group>
  )
}

function WindowPhoto({ url, height, anchor, ...props }: { url: string; height: number; anchor: 'top' | 'bottom'; position: [number, number, number] }) {
  const tex = useLazyTexture(url, 512)
  if (!tex) return null
  const img = tex.image as { width: number; height: number }
  const w = height * (img.width / img.height)
  return (
    <mesh {...props} position-y={props.position[1] + (anchor === 'top' ? -height / 2 : height / 2)}>
      <planeGeometry args={[w, height]} />
      <meshBasicMaterial map={tex} alphaTest={0.45} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Diapositive de l'espace pro sur l'écran de vitrine : image plein cadre, nom de la marque et repères. */
function drawImageSlide(ctx: CanvasRenderingContext2D, w: number, h: number, images: HTMLImageElement[], index: number) {
  const img = images[index % images.length]!
  ctx.fillStyle = '#0a1020'
  ctx.fillRect(0, 0, w, h)
  fitImage(ctx, img, w, h, 'cover')
  const g = ctx.createLinearGradient(0, h * 0.78, 0, h)
  g.addColorStop(0, 'rgba(10,16,32,0)')
  g.addColorStop(1, 'rgba(10,16,32,0.75)')
  ctx.fillStyle = g
  ctx.fillRect(0, h * 0.78, w, h * 0.22)
  ctx.font = `600 30px ${FONT.sans}`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(BRAND.name, 50, h - 56)
  images.forEach((_, i) => {
    ctx.fillStyle = i === index % images.length ? '#ffffff' : 'rgba(255,255,255,0.35)'
    ctx.fillRect(w - 50 - (images.length - i) * 34, h - 70, 24, 6)
  })
}

/** Vitrine de droite : un écran vertical fait défiler les images de l'espace pro (ou les prestations). */
function ServiceScreen() {
  const { ctx, tex } = useMemo(() => {
    const canvas = createCanvas(720, 1152)
    const ctx = canvas.getContext('2d')!
    drawScreenSlide(ctx, 720, 1152, 0)
    return { ctx, tex: toTexture(canvas) }
  }, [])
  const urls = useSite((s) => s.settings.display.screen)
  const [images, setImages] = useState<HTMLImageElement[]>([])
  useEffect(() => {
    let off = false
    Promise.allSettled(urls.map((u) => loadImage(thumb(u, 1200)))).then((results) => {
      if (!off) setImages(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
    })
    return () => {
      off = true
    }
  }, [urls])
  const slide = useRef(-1)
  useFrame(({ clock }) => {
    if (journey.progress > 0.2) return
    const count = images.length || SCREEN_SLIDES.length
    // une image de l'espace pro reste un peu plus longtemps à l'écran
    const next = Math.floor(clock.elapsedTime / (images.length ? 4.5 : 3.5)) % count
    const key = images.length * 100 + next
    if (key === slide.current) return
    slide.current = key
    if (images.length) drawImageSlide(ctx, 720, 1152, images, next)
    else drawScreenSlide(ctx, 720, 1152, next)
    tex.needsUpdate = true
  })
  return (
    <group position={[5.1, 0, -0.75]}>
      <RoundedBox args={[1.56, 2.42, 0.08]} radius={0.03} position={[0, 1.62, 0]} material={darkMetal} />
      <mesh position={[0, 1.62, 0.042]}>
        <planeGeometry args={[1.46, 2.32]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.2, 0]} material={darkMetal}>
        <boxGeometry args={[0.08, 0.4, 0.08]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={darkMetal}>
        <boxGeometry args={[0.7, 0.04, 0.45]} />
      </mesh>
    </group>
  )
}

/** Borne lumineuse du trottoir. */
function Bollard({ x, z, glow }: { x: number; z: number; glow: THREE.Material }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.4} material={darkMetal} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.8, 16]} />
      </mesh>
      <mesh position-y={0.72} material={glow}>
        <cylinderGeometry args={[0.083, 0.083, 0.06, 16]} />
      </mesh>
    </group>
  )
}

function SlidingDoor({ side }: { side: -1 | 1 }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(() => {
    const open = smooth(0.06, 0.1, journey.progress)
    if (ref.current) ref.current.position.x = side * (0.625 + open * 1.2)
  })
  return (
    <group ref={ref} position={[side * 0.625, 0, -0.28]}>
      <mesh position={[0, 1.5, 0]} material={M.glass}>
        <planeGeometry args={[1.2, 3]} />
      </mesh>
      {[
        [0, 2.98, 1.25, 0.05],
        [0, 0.03, 1.25, 0.06],
        [-0.6, 1.5, 0.05, 3],
        [0.6, 1.5, 0.05, 3],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x!, y!, 0]} material={M.facadeTrim}>
          <boxGeometry args={[w!, h!, 0.06]} />
        </mesh>
      ))}
      <mesh position={[-side * 0.45, 1.25, 0.06]} material={M.chrome}>
        <boxGeometry args={[0.03, 0.9, 0.03]} />
      </mesh>
    </group>
  )
}

/** Réverbère : s'allume la nuit (ampoule + lumière ponctuelle). */
function StreetLamp({ x, z }: { x: number; z: number }) {
  const light = useRef<THREE.PointLight>(null)
  const bulb = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((_, dt) => {
    const night = useApp.getState().mood === 'night' && journey.progress < 0.2
    if (light.current) light.current.intensity = THREE.MathUtils.damp(light.current.intensity, night ? 40 : 0, 4, dt)
    if (bulb.current) bulb.current.color.setScalar(THREE.MathUtils.damp(bulb.current.color.r, night ? 3 : 0.9, 4, dt))
  })
  return (
    <group position={[x, 0, z]}>
      <Suspense fallback={null}>
        <Glb model="streetLamp" height={5.2} shadows />
      </Suspense>
      <pointLight ref={light} position={[0, 4.6, 0]} intensity={0} distance={16} decay={2} color="#ffd59a" />
      <mesh position={[0, 4.75, 0]}>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshBasicMaterial ref={bulb} color={[0.9, 0.9, 0.9]} toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * Immeubles voisins, séparés de l'atelier par une ruelle : enduit, fenêtres à encadrement, rez-de-chaussée
 * en retrait. La nuit, quelques fenêtres s'allument (carte d'émission).
 */
function Neighbours() {
  const mats = useMemo(
    () =>
      [0, 1].map((i) => {
        const map = neighbourTexture(false).clone()
        const emissiveMap = neighbourTexture(true).clone()
        for (const t of [map, emissiveMap]) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping
          // un motif = 4 travées de fenêtres sur 4 étages (≈ 10 × 10 m)
          t.repeat.set(2.2, 0.82)
          t.offset.set(i * 0.37, 0)
          t.needsUpdate = true
        }
        return new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 0, color: i ? '#c9c2b6' : '#a9b0b8', roughness: 0.85 })
      }),
    [],
  )
  useFrame((_, dt) => {
    const target = useApp.getState().mood === 'night' ? 1.4 : 0
    for (const m of mats) m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, target, 2, dt)
  })
  return (
    <group>
      <Block x={[-34, -12.4]} y={[2.4, 10.5]} z={[-14, -1.2]} material={mats[0]!} />
      <Block x={[12.4, 34]} y={[2.4, 9]} z={[-14, -1.2]} material={mats[1]!} />
      {/* rez-de-chaussée en retrait (commerces voisins rideau baissé) */}
      <Block x={[-34, -12.4]} y={[0, 2.4]} z={[-14, -1.8]} material={M.facadeTrim} />
      <Block x={[12.4, 34]} y={[0, 2.4]} z={[-14, -1.8]} material={M.facadeTrim} />
    </group>
  )
}

export function Exterior() {
  const pavement = usePbr('pavement', [16, 3])
  const asphalt = usePbr('asphalt', [10, 6])
  const wood = usePbr('wood', [3, 1])
  const pavementMat = useMemo(() => new THREE.MeshStandardMaterial({ ...pavement, color: '#d8dadf', roughness: 0.9 }), [pavement])
  const asphaltMat = useMemo(() => new THREE.MeshStandardMaterial({ ...asphalt, color: '#9aa0a8', roughness: 0.85 }), [asphalt])
  // Matières de la façade : panneaux composites anthracite en partie haute, pierre claire sur les piliers,
  // bois chaleureux sous l'auvent.
  const compositeMat = useMemo(() => new THREE.MeshStandardMaterial({ map: compositePanelTexture((W * 2) / 1.5, (8 - GLASS_TOP - 0.65) / 1), roughness: 0.45, metalness: 0.5 }), [])
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ map: stoneCladTexture((W - PORTAL) / 1.2, (GLASS_TOP + 0.65) / 1.2), roughness: 0.6 }), [])
  const soffitMat = useMemo(() => new THREE.MeshStandardMaterial({ ...wood, color: '#e3c49c', roughness: 0.6 }), [wood])
  const halo = useMemo(() => new THREE.MeshBasicMaterial({ map: signHaloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [])

  const signMat = useRef<THREE.MeshBasicMaterial>(null)
  const photoMat = useRef<THREE.MeshBasicMaterial>(null)
  const subMat = useRef<THREE.MeshBasicMaterial>(null)
  // l'enseigne réelle de l'atelier (photo envoyée dans l'espace pro), entière sur le bandeau bleu nuit
  const signUrl = useSite((s) => s.settings.display.sign)
  const signPhoto = useFittedTexture(signUrl ? thumb(signUrl, 2048) : null, 2048, 400, 'contain', '#101a38')
  const openMat = useRef<THREE.MeshBasicMaterial>(null)
  const downlights = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  const roof = useRef<THREE.Group>(null)
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b4250', roughness: 0.8, transparent: true }), [])
  const readyAt = useRef<number | null>(null)

  // L'enseigne s'allume (léger grésillement) à la fin du chargement ; plus vive la nuit.
  useFrame(({ clock }) => {
    const { ready, mood } = useApp.getState()
    if (ready && readyAt.current === null) readyAt.current = clock.elapsedTime
    const t = readyAt.current === null ? 0 : clock.elapsedTime - readyAt.current
    const flicker = t < 0.2 ? 0 : t < 1.3 ? (Math.sin(t * 60) > 0.2 ? 1 : 0.15) * Math.min(1, t) : 1
    const night = mood === 'night'
    if (signMat.current) signMat.current.color.setScalar(0.4 + flicker * (night ? 2.6 : 1.3))
    // halo des lettres sur le panneau : discret le jour, il « déborde » la nuit
    halo.opacity = flicker * (night ? 0.9 : 0.35)
    // une photo garde ses vraies couleurs : éclairage doux, sans surexposition
    if (photoMat.current) photoMat.current.color.setScalar(0.35 + flicker * (night ? 0.8 : 0.65))
    if (subMat.current) subMat.current.color.setScalar(0.4 + flicker * (night ? 1.3 : 0.9))
    if (openMat.current) openMat.current.color.setScalar(0.3 + flicker * (night ? 2.4 : 1.2))
    downlights.color.setRGB(2.6, 2.4, 2.1).multiplyScalar(night ? 1 : 0.45)
    // Vue aérienne finale : la toiture se soulève et s'efface (effet maquette).
    const lift = smooth(0.93, 0.985, journey.progress)
    if (roof.current) {
      roof.current.position.y = lift * 7
      roof.current.visible = lift < 0.999
      roofMat.opacity = 1 - lift
    }
  })

  return (
    <group>
      {/* Terrain autour du bâtiment (visible en vue aérienne : effet maquette) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, -30]} material={asphaltMat} receiveShadow>
        <planeGeometry args={[300, 300]} />
      </mesh>
      {/* Trottoir, bordure, chaussée */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 6.1]} material={pavementMat} receiveShadow>
        <planeGeometry args={[70, 12]} />
      </mesh>
      <Block x={[-35, 35]} y={[0, 0.14]} z={[12, 12.3]} material={M.plasticGrey} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 32]} material={asphaltMat} receiveShadow>
        <planeGeometry args={[70, 40]} />
      </mesh>
      {[-12, -4, 4, 12].map((x) => (
        <mesh key={x} rotation-x={-Math.PI / 2} position={[x, -0.01, 20]} material={M.white}>
          <planeGeometry args={[3, 0.15]} />
        </mesh>
      ))}
      {/* sol des ruelles */}
      {[-1, 1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[s * 11.4, 0.001, -6]} material={pavementMat}>
          <planeGeometry args={[2, 12]} />
        </mesh>
      ))}

      {/* Façade : panneaux composites anthracite en partie haute, piliers en pierre, portique autour de la vitrine */}
      <Block x={[-W, W]} y={[GLASS_TOP + 0.65, 8]} z={[-0.2, 0.2]} material={compositeMat} />
      <Block x={[-W, -PORTAL]} y={[0, GLASS_TOP + 0.65]} z={[-0.2, 0.26]} material={stoneMat} />
      <Block x={[PORTAL, W]} y={[0, GLASS_TOP + 0.65]} z={[-0.2, 0.26]} material={stoneMat} />
      {/* soubassement en pierre sombre sous les vitrines */}
      <Block x={[-PORTAL + 0.45, -1.3]} y={[0, 0.34]} z={[0.1, 0.26]} material={granite} />
      <Block x={[1.3, PORTAL - 0.45]} y={[0, 0.34]} z={[0.1, 0.26]} material={granite} />
      {/* appliques sur la pierre, auvent, enseigne drapeau */}
      {[-1, 1].map((s) => (
        <WallWasher key={s} x={s * ((W + PORTAL) / 2)} y={2.5} z={0.33} />
      ))}
      <Canopy wood={soffitMat} />
      <BladeSign x={W - 0.55} y={5.7} />
      <GlassSheen
        panes={[-1, 1].map((s) => ({ x: s * ((PORTAL - 0.45 + 1.3) / 2), w: PORTAL - 0.45 - 1.3, h: GLASS_TOP - 0.12, y: (GLASS_TOP + 0.12) / 2, z: 0.115 }))}
      />
      {/* portique en saillie : montants, linteau, soffite éclairé */}
      <Block x={[-PORTAL, -PORTAL + 0.45]} y={[0, GLASS_TOP + 0.65]} z={[-0.2, 1.0]} material={darkMetal} />
      <Block x={[PORTAL - 0.45, PORTAL]} y={[0, GLASS_TOP + 0.65]} z={[-0.2, 1.0]} material={darkMetal} />
      <Block x={[-PORTAL, PORTAL]} y={[GLASS_TOP, GLASS_TOP + 0.65]} z={[-0.2, 1.0]} material={darkMetal} />
      <mesh position={[0, GLASS_TOP - 0.012, 0.97]} material={G.white}>
        <boxGeometry args={[(PORTAL - 0.45) * 2, 0.022, 0.03]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (PORTAL - 0.46), GLASS_TOP / 2, 0.97]} material={G.blue}>
          <boxGeometry args={[0.022, GLASS_TOP, 0.03]} />
        </mesh>
      ))}
      <Glazing />
      {/* marche d'entrée en granit sombre */}
      <Block x={[-PORTAL - 0.4, PORTAL + 0.4]} y={[0, 0.1]} z={[0.2, 1.6]} material={granite} />

      {/* Toiture : acrotère métallique, toit, équipements */}
      <Block x={[-W - 0.15, W + 0.15]} y={[8, 8.7]} z={[-0.3, 0.35]} material={M.facadeTrim} />
      <group ref={roof}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * W, 7.35, -36.3]} material={roofMat}>
            <boxGeometry args={[0.3, 2.7, 72]} />
          </mesh>
        ))}
        <mesh position={[0, 6.02, -36]} rotation-x={-Math.PI / 2} material={roofMat}>
          <planeGeometry args={[W * 2, 72]} />
        </mesh>
        {[-6, 5].map((x) => (
          <RoundedBox key={x} args={[1.8, 1.1, 1.2]} radius={0.05} position={[x, 6.6, -4]} material={M.plasticGrey} castShadow />
        ))}
      </group>

      {/* Porte coulissante, enseigne « OUVERT » sur l'imposte */}
      <SlidingDoor side={-1} />
      <SlidingDoor side={1} />
      <mesh position={[0, 3.4, 0.13]}>
        <planeGeometry args={[1.5, 0.56]} />
        <meshBasicMaterial ref={openMat} map={openSignTexture()} transparent toneMapped={false} />
      </mesh>

      {/* spots encastrés dans le soffite du portique */}
      {[-6.6, -4.4, -2.2, 0, 2.2, 4.4, 6.6].map((x) => (
        <mesh key={x} position={[x, GLASS_TOP - 0.003, 0.6]} rotation-x={Math.PI / 2} material={downlights}>
          <circleGeometry args={[0.07, 20]} />
        </mesh>
      ))}

      {/* vitrines garnies + adhésifs des prestations */}
      <Suspense fallback={null}>
        <TextileWindow />
      </Suspense>
      <ServiceScreen />
      {/* adhésifs des prestations en haut des vitrines, au-dessus des têtes : la vitrine reste dégagée */}
      {/* posés devant les montants (bandeau continu, lisible d'un seul tenant) */}
      <mesh position={[-4.95, 3.38, 0.178]}>
        <planeGeometry args={[6.2, 0.44]} />
        <meshBasicMaterial map={vinylTexture('IMPRESSION · TEXTILE · OBJETS')} transparent />
      </mesh>
      <mesh position={[4.95, 3.38, 0.178]}>
        <planeGeometry args={[6.2, 0.44]} />
        <meshBasicMaterial map={vinylTexture('INFORMATIQUE · SÉCURITÉ')} transparent />
      </mesh>

      {/* Enseigne : grand panneau bleu nuit, lettres lumineuses, filet bleu */}
      <RoundedBox args={[11.4, 2.4, 0.16]} radius={0.05} position={[0, 6.3, 0.28]} material={M.navy} />
      <mesh position={[0, 5.12, 0.37]} material={G.blue}>
        <boxGeometry args={[11.2, 0.03, 0.01]} />
      </mesh>
      {signPhoto ? (
        <mesh position={[0, 6.3, 0.362]}>
          <planeGeometry args={[11.1, 2.17]} />
          <meshBasicMaterial ref={photoMat} map={signPhoto} toneMapped={false} />
        </mesh>
      ) : (
        <>
          {/* lettres boîtier : halo sur le panneau, chants sombres (épaisseur vue de biais), faces lumineuses */}
          <mesh position={[0, 6.48, 0.366]} material={halo}>
            <planeGeometry args={[10.2, 1.7]} />
          </mesh>
          <mesh position={[0, 6.488, 0.39]}>
            <planeGeometry args={[9.4, 1.47]} />
            <meshBasicMaterial map={signTexture()} transparent color={[0.16, 0.2, 0.3]} />
          </mesh>
          <mesh position={[0, 6.5, 0.42]}>
            <planeGeometry args={[9.4, 1.47]} />
            <meshBasicMaterial ref={signMat} map={signTexture()} transparent toneMapped={false} />
          </mesh>
          <mesh position={[0, 5.55, 0.362]}>
            <planeGeometry args={[9, 0.42]} />
            <meshBasicMaterial ref={subMat} map={subSignTexture()} transparent toneMapped={false} />
          </mesh>
        </>
      )}
      {[-3.9, 3.9].map((x) => (
        <Bollard key={x} x={x} z={3.4} glow={downlights} />
      ))}

      {/* abords : totem, places clients, arceaux, mobilier urbain */}
      <Totem position={[-5.6, 0, 10.3]} />
      <Parking />
      <BikeRack position={[4.9, 0, 4.4]} />
      {/* mobilier urbain : il arrive juste après la façade, sans la retarder */}
      <Suspense fallback={null}>
        <StreetFurniture />
      </Suspense>
      {/* équipements techniques sur les murs de la ruelle (chargés après la façade) */}
      <Suspense fallback={null}>
        <Glb model="aircon" height={0.9} position={[-10.95, 2.4, -4.5]} rotation-y={-Math.PI / 2} />
        <Glb model="utilityBox" height={1.3} position={[10.95, 0, -2.4]} rotation-y={Math.PI / 2} />
      </Suspense>

      {/* Lumières de façade : visibles surtout la nuit */}
      <pointLight position={[0, 3.4, 1.4]} intensity={6} distance={7} decay={2} color="#ffe6c4" />
      {/* l'atelier éclaire la vitrine de l'intérieur (une seule source : chaque lumière coûte sur tous les pixels) */}
      <pointLight position={[0, 3.2, -3.5]} intensity={22} distance={14} decay={2} color="#f4f8ff" />

      <Suspense fallback={null}>
        {[-2.85, 2.85].map((x) => (
          <group key={x} position={[x, 0.1, 1.15]}>
            <RoundedBox args={[0.7, 0.55, 0.7]} radius={0.03} position-y={0.275} material={M.facadeTrim} castShadow />
            <Glb model="plant" height={1.3} position-y={0.5} />
          </group>
        ))}
      </Suspense>
      <StreetLamp x={-7.5} z={10.8} />
      <StreetLamp x={7.5} z={10.8} />
      <Neighbours />
    </group>
  )
}
