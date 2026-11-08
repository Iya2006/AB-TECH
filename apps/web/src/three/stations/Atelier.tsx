import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { MachineId } from '../../lib/machines'
import { journey } from '../../lib/scroll'
import { productsOf, realisationsOf, useSite } from '../../lib/site'
import { useApp } from '../../lib/store'
import { useFittedTexture, useLazyTexture } from '../assets'
import { GalleryWall, realisationItems, thumb, type WallItem } from '../Gallery'
import { Interactive } from '../Interactive'
import { G, M } from '../materials'
import { CAP_MODELS, HANGING_MODELS } from '../../lib/mockup/catalog'
import { Desk, Glb, KeyboardSet, Monitor, OfficeChair, WhiteTable } from '../models/devices'
import { BusinessCard, Mug, type GroupProps } from '../models/products'
import { ProductDisplay } from '../ProductDisplay'
import { Pendant } from '../world/Reception'
import { CapCarousel, GarmentRail } from './Carousels'
import {
  cachedTexture,
  corkTexture,
  createCanvas,
  FONT,
  drawLogoConstruction,
  flagTexture,
  flyerTexture,
  LOGO_SKETCH_COUNT,
  logoSketchTexture,
  photocallTexture,
  posterTexture,
  rollupTexture,
  toTexture,
  type CardVariant,
} from '../textures'

const FACE_PLUS_X = Math.PI / 2
const FACE_MINUS_X = -Math.PI / 2
const inRange = (a: number, b: number) => journey.progress > a && journey.progress < b
const openCatalogue = (station: string) => () => useApp.getState().open({ type: 'catalogue', tab: 'realisations', station })
/** Ouvre la fiche d'un équipement de l'atelier. */
const machine = (id: MachineId) => () => useApp.getState().open({ type: 'machine', id })

/** Banderole événementielle (bâche à œillets) : ce que l'atelier imprime pour les événements. */
const eventBannerTexture = () =>
  cachedTexture('event-banner', 2048, 300, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, '#e5007d')
    g.addColorStop(1, '#7c3aed')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.font = `800 96px ${FONT.display}`
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.fillText('Vos événements, en grand.', 80, h / 2 + 4)
    ctx.font = `600 28px ${FONT.sans}`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.textAlign = 'right'
    ctx.fillText('BANDEROLES · KAKÉMONOS · PHOTOCALLS', w - 80, h / 2 + 4)
    // œillets
    ctx.fillStyle = '#d7dbe2'
    for (const x of [24, w / 2, w - 24]) for (const y of [24, h - 24]) {
      ctx.beginPath()
      ctx.arc(x, y, 9, 0, Math.PI * 2)
      ctx.fill()
    }
  })

/** Habillage imprimé du comptoir d'accueil événementiel. */
const eventCounterTexture = () =>
  cachedTexture('event-counter', 1024, 560, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#0f1d46')
    g.addColorStop(1, '#1d3b8f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 3
    for (let i = 1; i <= 8; i++) {
      ctx.beginPath()
      ctx.arc(w * 0.82, h * 0.2, i * 60, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.font = `800 96px ${FONT.display}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText('Accueil', 60, h * 0.55)
    ctx.font = `600 34px ${FONT.sans}`
    ctx.fillStyle = '#9cc5ff'
    ctx.fillText('Comptoir imprimé à vos couleurs', 62, h * 0.55 + 60)
    ;[COLORS_CMYK.c, COLORS_CMYK.m, COLORS_CMYK.y, '#ffffff'].forEach((c, i) => {
      ctx.fillStyle = c
      ctx.fillRect(62 + i * 70, h - 70, 60, 12)
    })
  })
const COLORS_CMYK = { c: '#00a0dc', m: '#e5007d', y: '#ffd400' }

/** Comptoir d'accueil d'événement (salon, inauguration) : habillage imprimé, plateau chêne. */
function EventCounter(props: GroupProps) {
  return (
    <group {...props}>
      <RoundedBox args={[1.8, 1.0, 0.55]} radius={0.04} position-y={0.5} material={M.white} castShadow />
      <mesh position={[0, 0.5, 0.276]}>
        <planeGeometry args={[1.72, 0.94]} />
        <meshStandardMaterial map={eventCounterTexture()} roughness={0.45} />
      </mesh>
      <RoundedBox args={[1.9, 0.04, 0.62]} radius={0.012} position-y={1.02} material={M.oak} />
      <Suspense fallback={null}>
        <Glb model="stationery" height={0.12} position={[0.5, 1.04, -0.05]} />
        <Glb model="succulent" height={0.34} position={[-0.6, 1.04, -0.08]} />
      </Suspense>
    </group>
  )
}

/** Console cadeaux contre le mur : coffrets, papeterie, plante, cadre ; bandeau lumineux sous le plateau. */
function GiftConsole(props: GroupProps) {
  return (
    <group {...props}>
      <RoundedBox args={[2.7, 0.68, 0.42]} radius={0.02} position-y={0.36} material={M.white} castShadow />
      <RoundedBox args={[2.8, 0.05, 0.46]} radius={0.012} position-y={0.725} material={M.oak} />
      <mesh position={[0, 0.69, 0.212]} material={G.warmSoft}>
        <boxGeometry args={[2.6, 0.012, 0.004]} />
      </mesh>
      <Suspense fallback={null}>
        <Glb model="box" height={0.26} position={[-0.95, 0.75, 0]} rotation-y={0.3} />
        <Glb model="box" height={0.2} position={[-0.62, 0.75, 0.04]} rotation-y={-0.4} />
        <Glb model="stationery" height={0.13} position={[-0.05, 0.75, 0]} />
        <Glb model="frame" height={0.3} position={[0.55, 0.75, -0.05]} rotation-y={-0.2} />
        <Glb model="succulent" height={0.42} position={[1.05, 0.75, 0]} />
      </Suspense>
    </group>
  )
}

/** Rouleaux de papier et de bâche debout dans un bac, à côté de la réserve. */
function PaperRolls(props: GroupProps) {
  const rolls: Array<[number, number, number, string]> = [
    [0, 0, 1.05, '#f4f2ec'],
    [0.16, 0.06, 0.95, '#ffffff'],
    [-0.12, 0.12, 1.12, '#e9eef5'],
    [0.08, -0.14, 0.9, '#f7f1e3'],
  ]
  return (
    <group {...props}>
      <mesh position-y={0.2} material={M.graphite}>
        <cylinderGeometry args={[0.3, 0.27, 0.4, 24, 1, true]} />
      </mesh>
      {rolls.map(([x, z, h, c]) => (
        <group key={`${x}${z}`} position={[x, h / 2 + 0.02, z]} rotation-z={x * 0.25}>
          <mesh>
            <cylinderGeometry args={[0.055, 0.055, h, 20]} />
            <meshStandardMaterial color={c} roughness={0.8} />
          </mesh>
          <mesh position-y={h / 2 + 0.001} material={M.kraft}>
            <cylinderGeometry args={[0.022, 0.022, 0.004, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Grandes affiches choisies dans l'espace pro (flyers, logos, événements…), prêtes à accrocher. */
function usePosterItems(station: string) {
  const posters = useSite((s) => s.settings.display.posters)
  return useMemo<WallItem[]>(() => posters.map((url, i) => ({ key: `poster-${i}-${url}`, image: url, onSelect: openCatalogue(station) })), [posters, station])
}

/** Au-delà, un mur devient illisible : le catalogue complet reste à un clic. */
const MAX_WALL = 10

/**
 * Réalisations d'un poste, puis les affiches de l'espace pro (`extra`), complétées par des visuels générés
 * tant qu'il n'y en a pas assez.
 */
function useWallItems(station: Parameters<typeof realisationsOf>[1], defaults: THREE.Texture[], min: number, extra: WallItem[] = []) {
  const realisations = useSite((s) => s.realisations)
  return useMemo(() => {
    const items: WallItem[] = [...realisationItems(realisationsOf(realisations, station)), ...extra].slice(0, MAX_WALL)
    for (let i = 0; items.length < min && i < defaults.length; i++) {
      items.push({ key: `default-${station}-${i}`, texture: defaults[i], onSelect: openCatalogue(station) })
    }
    return items
  }, [realisations, station, defaults, min, extra])
}

/* ------------------------------------------------------------------ */
/* 01 — Studio création                                               */
/* ------------------------------------------------------------------ */

function LogoScreen(props: GroupProps) {
  const { ctx, tex } = useMemo(() => {
    const canvas = createCanvas(1024, 576)
    const ctx = canvas.getContext('2d')!
    drawLogoConstruction(ctx, 1024, 576, 7)
    return { ctx, tex: toTexture(canvas) }
  }, [])
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (!inRange(0.12, 0.38)) return
    const t = clock.elapsedTime
    if (t - last.current < 1 / 30) return
    last.current = t
    drawLogoConstruction(ctx, 1024, 576, t)
    tex.needsUpdate = true
  })
  return (
    <group {...props}>
      <RoundedBox args={[5.2, 3.0, 0.08]} radius={0.03} position-z={-0.04} material={M.ink} />
      <mesh position-z={0.002}>
        <planeGeometry args={[5.0, 2.8125]} />
        <meshBasicMaterial map={tex} toneMapped={false} color={[1.05, 1.05, 1.05]} />
      </mesh>
    </group>
  )
}

const SWATCHES = ['#00a0dc', '#2563eb', '#5b3e96', '#e5007d', '#e8442e', '#f39200', '#ffd400', '#8fbf3f', '#0e0e10']

function SwatchFan(props: GroupProps) {
  const blades = useRef<Array<THREE.Group | null>>([])
  useFrame(({ clock }) => {
    const open = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.7)
    blades.current.forEach((g, i) => {
      if (g) g.rotation.y = (i - 4) * 0.14 * (0.25 + 0.75 * open)
    })
  })
  return (
    <group {...props}>
      {SWATCHES.map((c, i) => (
        <group key={c} ref={(el) => void (blades.current[i] = el)} position-y={i * 0.0035}>
          <mesh position={[0.1, 0, 0]}>
            <boxGeometry args={[0.18, 0.003, 0.045]} />
            <meshStandardMaterial color={c} roughness={0.6} />
          </mesh>
          <mesh position={[0.215, 0, 0]} material={M.paper}>
            <boxGeometry args={[0.05, 0.003, 0.045]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Tableau d'inspiration en liège : réalisations « création » (ou croquis par défaut), épinglées. */
function MoodBoard(props: GroupProps) {
  const defaults = useMemo(() => Array.from({ length: LOGO_SKETCH_COUNT }, (_, i) => logoSketchTexture(i)), [])
  const items = useWallItems('creation', defaults, 4)
  const cork = useMemo(() => {
    const t = corkTexture().clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(2, 1.4)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <group {...props}>
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 0.9, -0.04]} material={M.aluminium}>
          <boxGeometry args={[0.04, 1.8, 0.04]} />
        </mesh>
      ))}
      <RoundedBox args={[2.1, 1.45, 0.05]} radius={0.02} position={[0, 1.55, 0]} material={M.aluminium} />
      <mesh position={[0, 1.55, 0.026]}>
        <planeGeometry args={[2.0, 1.35]} />
        <meshStandardMaterial map={cork} roughness={0.95} />
      </mesh>
      <GalleryWall items={items} width={1.85} height={1.2} rows={items.length > 4 ? 2 : 1} gap={0.1} frame="white" position={[0, 1.55, 0.06]} />
    </group>
  )
}

export function CreationStation() {
  return (
    <group>
      <Interactive position={[-9.82, 2.75, -9.6]} rotation-y={FACE_PLUS_X} onSelect={machine('poste-creation')} hoverScale={1.02}>
        <LogoScreen />
      </Interactive>
      <group position={[-6.3, 0, -9.6]}>
        <Desk w={1.1} d={2.6} />
        <Monitor variant="design" width={0.68} position={[-0.3, 0.76, 0.1]} rotation-y={FACE_PLUS_X} />
        <KeyboardSet position={[0.08, 0.76, 0.1]} rotation-y={FACE_PLUS_X} scale={0.9} />
        <mesh position={[0.18, 0.766, 0.78]} rotation-y={0.2} material={M.inkMatte}>
          <boxGeometry args={[0.26, 0.012, 0.36]} />
        </mesh>
        <mesh position={[0.3, 0.775, 0.66]} rotation={[0, 0.6, Math.PI / 2]} material={M.graphite}>
          <capsuleGeometry args={[0.006, 0.14, 4, 8]} />
        </mesh>
        <SwatchFan position={[0.18, 0.765, -0.75]} />
        <mesh position={[0.28, 0.768, -0.25]} rotation={[-Math.PI / 2, 0, 0.12]}>
          <planeGeometry args={[0.21, 0.297]} />
          <meshStandardMaterial map={flyerTexture()} roughness={0.85} />
        </mesh>
        <Mug baseColor="#2563eb" ink="#ffffff" scale={1} position={[0.3, 0.76, 0.42]} />
        <Suspense fallback={null}>
          <Glb model="deskLamp" height={0.55} position={[-0.32, 0.76, -1.05]} rotation-y={1.9} />
          <Glb model="plant" height={0.9} position={[-0.35, 0, 1.75]} />
        </Suspense>
      </group>
      <Suspense fallback={<OfficeChair position={[-5.25, 0, -9.4]} rotation-y={-FACE_PLUS_X - 0.2} />}>
        {/* vrai fauteuil de bureau (Poly Haven) et caisson à tiroirs au bout du bureau */}
        <Glb model="officeChair" height={0.95} position={[-5.3, 0, -9.4]} rotation-y={-FACE_PLUS_X - 0.2} />
        <Glb model="drawers" height={0.68} position={[-6.25, 0, -11.35]} rotation-y={FACE_PLUS_X} />
      </Suspense>
      <MoodBoard position={[-8.0, 0, -13.1]} rotation-y={0.85} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* 02 — Impression                                                     */
/* ------------------------------------------------------------------ */

function WideFormatPrinter(props: GroupProps) {
  const carriage = useRef<THREE.Mesh>(null)
  const sheet = useRef<THREE.Mesh>(null)
  const sheetMat = useRef<THREE.MeshStandardMaterial>(null)
  const { geometry, map } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(0.9, 0.93)
    geometry.translate(0, -0.465, 0)
    const map = posterTexture(0).clone()
    map.needsUpdate = true
    return { geometry, map }
  }, [])

  // écran de commande : la progression de l'impression en cours, synchronisée avec la feuille qui sort
  const panel = useMemo(() => {
    const canvas = createCanvas(320, 200)
    return { ctx: canvas.getContext('2d')!, tex: toTexture(canvas), last: -1 }
  }, [])

  useFrame(({ clock }) => {
    if (!inRange(0.25, 0.5)) return
    const t = clock.elapsedTime % 7.5
    const printing = t < 5
    const s = Math.min(1, t / 5)
    if (carriage.current) carriage.current.position.x = printing ? Math.sin(t * 5) * 1.0 : 0
    if (sheet.current && sheetMat.current) {
      sheet.current.scale.y = Math.max(0.001, s)
      map.repeat.y = 0.73 * s
      map.offset.y = 1 - 0.73 * s
      sheetMat.current.opacity = t > 6.6 ? Math.max(0, 1 - (t - 6.6) / 0.6) : 1
    }
    const pct = Math.round(s * 100)
    if (pct !== panel.last) {
      panel.last = pct
      drawPrinterPanel(panel.ctx, 320, 200, pct)
      panel.tex.needsUpdate = true
    }
  })

  return (
    <group {...props}>
      {/* pieds, roulettes, traverse et panier de réception en tissu */}
      {[-1.15, 1.15].map((x) => (
        <group key={x} position-x={x}>
          <RoundedBox args={[0.08, 0.86, 0.45]} radius={0.02} position-y={0.47} material={M.graphite} />
          <RoundedBox args={[0.1, 0.05, 0.7]} radius={0.015} position-y={0.05} material={M.ink} />
          {[-0.3, 0.3].map((z) => (
            <mesh key={z} position={[0, 0.025, z]} rotation-z={Math.PI / 2} material={M.rubber}>
              <cylinderGeometry args={[0.025, 0.025, 0.03, 16]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.28, 0]} rotation-z={Math.PI / 2} material={M.graphite}>
        <cylinderGeometry args={[0.022, 0.022, 2.3, 12]} />
      </mesh>
      <mesh position={[0, 0.66, 0.2]} rotation={[0, 0, Math.PI / 2]} material={basketFabric}>
        <cylinderGeometry args={[0.26, 0.26, 2.22, 24, 1, true, Math.PI, Math.PI]} />
      </mesh>
      {/* corps : carter blanc, joues anthracite aérées, capot à fenêtre fumée (on voit la tête courir) */}
      <RoundedBox args={[2.2, 0.42, 0.62]} radius={0.05} smoothness={4} position-y={1.12} material={M.plasticWhite} castShadow />
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 1.2, 1.14, 0]}>
          <RoundedBox args={[0.24, 0.52, 0.68]} radius={0.05} smoothness={4} material={M.plasticDark} castShadow />
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[sx * 0.121, 0.12 - i * 0.05, -0.05]} rotation-y={sx * (Math.PI / 2)} material={M.ink}>
              <planeGeometry args={[0.36, 0.012]} />
            </mesh>
          ))}
        </group>
      ))}
      <RoundedBox args={[2.12, 0.08, 0.5]} radius={0.03} position-y={1.37} material={M.plasticDark} />
      <mesh position={[0, 1.3, 0.27]} rotation-x={-0.5} material={M.smokedGlass}>
        <planeGeometry args={[1.95, 0.16]} />
      </mesh>
      <mesh position={[0, 0.96, 0.312]} material={M.ink}>
        <boxGeometry args={[2.1, 0.025, 0.01]} />
      </mesh>
      <RoundedBox ref={carriage} args={[0.22, 0.12, 0.14]} radius={0.02} position={[0, 1.24, 0.2]} material={M.graphite} />
      {/* baie des cartouches (cyan, magenta, jaune, noir) sur la joue gauche */}
      {['#00a0dc', '#e5007d', '#ffd400', '#15171c'].map((c, i) => (
        <mesh key={c} position={[-1.29 + i * 0.058, 1.0, 0.342]}>
          <boxGeometry args={[0.042, 0.11, 0.012]} />
          <meshStandardMaterial color={c} roughness={0.35} />
        </mesh>
      ))}
      {/* pupitre de commande incliné et voyants, sur la joue droite */}
      <group position={[1.2, 1.44, 0.23]} rotation-x={-0.55}>
        <RoundedBox args={[0.22, 0.16, 0.035]} radius={0.012} material={M.plasticDark} />
        <mesh position-z={0.018}>
          <planeGeometry args={[0.19, 0.12]} />
          <meshBasicMaterial map={panel.tex} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[1.12, 1.24, 0.343]} material={G.green}>
        <circleGeometry args={[0.009, 10]} />
      </mesh>
      <mesh position={[1.15, 1.24, 0.343]} material={G.blue}>
        <circleGeometry args={[0.009, 10]} />
      </mesh>
      {/* rouleau de papier et ses moyeux à l'arrière */}
      <mesh position={[0, 0.78, -0.18]} rotation-z={Math.PI / 2} material={M.paper}>
        <cylinderGeometry args={[0.075, 0.075, 2.1, 32]} />
      </mesh>
      {[-1.07, 1.07].map((x) => (
        <mesh key={x} position={[x, 0.78, -0.18]} rotation-z={Math.PI / 2} material={M.graphite}>
          <cylinderGeometry args={[0.045, 0.045, 0.06, 16]} />
        </mesh>
      ))}
      <mesh ref={sheet} geometry={geometry} position={[0, 0.955, 0.33]} rotation-x={0.06}>
        <meshStandardMaterial ref={sheetMat} map={map} roughness={0.85} transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const basketFabric = new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.95, side: THREE.DoubleSide })

/** Écran de commande de l'imprimante grand format : travail en cours et progression. */
function drawPrinterPanel(ctx: CanvasRenderingContext2D, w: number, h: number, pct: number) {
  ctx.fillStyle = '#0b1220'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, w, 40)
  ctx.font = `600 20px ${FONT.sans}`
  ctx.fillStyle = '#93c5fd'
  ctx.fillText(pct < 100 ? 'Impression…' : 'Terminé', 14, 27)
  ctx.fillStyle = '#4ade80'
  ctx.beginPath()
  ctx.arc(w - 22, 20, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = `700 26px ${FONT.sans}`
  ctx.fillStyle = '#f1f5f9'
  ctx.fillText('Affiche 60 × 90', 14, 84)
  ctx.font = `500 18px ${FONT.sans}`
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('Papier photo satiné · CMJN', 14, 112)
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(14, 140, w - 28, 16)
  const g = ctx.createLinearGradient(14, 0, w - 14, 0)
  g.addColorStop(0, '#2563eb')
  g.addColorStop(1, '#22b8f0')
  ctx.fillStyle = g
  ctx.fillRect(14, 140, ((w - 28) * pct) / 100, 16)
  ctx.font = `700 20px ${FONT.mono}`
  ctx.fillStyle = '#e2e8f0'
  ctx.fillText(`${pct} %`, 14, 186)
}

/** Plotter de découpe : la lame suit le tracé dans l'adhésif, le lettrage sort à l'avant. */
function VinylCutter(props: GroupProps) {
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!head.current || !inRange(0.25, 0.5)) return
    const t = clock.elapsedTime
    // tracé : allers-retours rapides avec de petits arrêts (la lame découpe une lettre)
    head.current.position.x = Math.sin(t * 1.7) * 0.5 + Math.sin(t * 6.3) * 0.05
  })
  return (
    <group {...props}>
      {[-0.62, 0.62].map((x) => (
        <group key={x} position-x={x}>
          <mesh position-y={0.44} material={M.graphite}>
            <boxGeometry args={[0.05, 0.86, 0.05]} />
          </mesh>
          <RoundedBox args={[0.07, 0.04, 0.5]} radius={0.012} position-y={0.02} material={M.ink} />
        </group>
      ))}
      <mesh position={[0, 0.3, 0]} rotation-z={Math.PI / 2} material={M.graphite}>
        <cylinderGeometry args={[0.018, 0.018, 1.24, 10]} />
      </mesh>
      <RoundedBox args={[1.5, 0.2, 0.28]} radius={0.04} smoothness={4} position-y={0.98} material={M.plasticDark} castShadow />
      <RoundedBox args={[1.36, 0.06, 0.16]} radius={0.02} position={[0, 1.1, -0.02]} material={M.plasticWhite} />
      {/* galets presseurs et tête de coupe */}
      {[-0.5, 0, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.09, 0.1]} rotation-z={Math.PI / 2} material={M.plasticWhite}>
          <cylinderGeometry args={[0.022, 0.022, 0.05, 14]} />
        </mesh>
      ))}
      <group ref={head} position={[0, 1.1, 0.07]}>
        <RoundedBox args={[0.1, 0.08, 0.08]} radius={0.015} material={M.graphite} />
        <mesh position={[0, 0, 0.041]} material={G.blue}>
          <planeGeometry args={[0.03, 0.01]} />
        </mesh>
      </group>
      <mesh position={[0.56, 1.06, 0.141]} material={G.cyan}>
        <planeGeometry args={[0.16, 0.06]} />
      </mesh>
      {/* rouleau d'adhésif à l'arrière, lettrage découpé qui retombe à l'avant */}
      <mesh position={[0, 0.94, -0.2]} rotation-z={Math.PI / 2} material={vinylRoll}>
        <cylinderGeometry args={[0.05, 0.05, 1.28, 24]} />
      </mesh>
      <mesh position={[0, 0.78, 0.17]} rotation-x={0.12}>
        <planeGeometry args={[1.2, 0.36]} />
        <meshStandardMaterial map={cutVinylTexture()} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

const vinylRoll = new THREE.MeshPhysicalMaterial({ color: '#e5007d', roughness: 0.25, clearcoat: 0.8 })

/** Adhésif découpé (échenillé) sur son papier support. */
const cutVinylTexture = () =>
  cachedTexture('cut-vinyl', 768, 230, (ctx, w, h) => {
    ctx.fillStyle = '#ece7dc'
    ctx.fillRect(0, 0, w, h)
    ctx.font = `800 120px ${FONT.display}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e5007d'
    ctx.fillText('VOTRE LOGO', w / 2, h / 2 + 6)
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1.5
    ctx.strokeText('VOTRE LOGO', w / 2, h / 2 + 6)
  })

/** Copieur multifonction de production. */
function Copier(props: GroupProps) {
  const light = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (light.current) light.current.position.x = Math.sin(clock.elapsedTime * 1.4) * 0.22
  })
  return (
    <group {...props}>
      <RoundedBox args={[0.66, 0.7, 0.62]} radius={0.03} position-y={0.35} material={M.plasticWhite} castShadow />
      {/* trois magasins papier : joints et poignées encastrées */}
      {[0.12, 0.27, 0.42].map((y) => (
        <group key={y}>
          <mesh position={[0, y, 0.311]} material={M.plasticGrey}>
            <boxGeometry args={[0.6, 0.006, 0.002]} />
          </mesh>
          <mesh position={[0, y + 0.075, 0.312]} material={M.plasticDark}>
            <boxGeometry args={[0.16, 0.022, 0.004]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.6 / 2 - 0.05, 0.6, 0.312]} material={G.green}>
        <circleGeometry args={[0.008, 10]} />
      </mesh>
      {/* chargeur de documents avec sa pile, bac de sortie garni */}
      <RoundedBox args={[0.5, 0.06, 0.3]} radius={0.015} position={[0, 1.06, -0.1]} material={M.plasticGrey} />
      <mesh position={[0, 1.1, -0.1]} material={M.paper}>
        <boxGeometry args={[0.3, 0.025, 0.21]} />
      </mesh>
      <RoundedBox args={[0.26, 0.02, 0.34]} radius={0.008} position={[-0.42, 0.62, 0]} rotation-z={-0.12} material={M.plasticGrey} />
      <mesh position={[-0.42, 0.645, 0]} rotation-z={-0.12} material={M.paper}>
        <boxGeometry args={[0.21, 0.03, 0.297]} />
      </mesh>
      <RoundedBox args={[0.66, 0.24, 0.6]} radius={0.03} position-y={0.86} material={M.plasticWhite} />
      <RoundedBox args={[0.6, 0.05, 0.42]} radius={0.015} position={[0, 1.0, -0.06]} material={M.plasticGrey} />
      <mesh ref={light} position={[0, 0.985, -0.06]} material={G.blue}>
        <boxGeometry args={[0.02, 0.005, 0.4]} />
      </mesh>
      <group position={[0.22, 1.0, 0.27]} rotation-x={-0.6}>
        <RoundedBox args={[0.2, 0.13, 0.02]} radius={0.01} material={M.plasticDark} />
        <mesh position-z={0.011} material={G.blue}>
          <planeGeometry args={[0.17, 0.1]} />
        </mesh>
      </group>
    </group>
  )
}

/** Massicot (coupe-papier) : la lame descend régulièrement. */
function Guillotine(props: GroupProps) {
  const blade = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!blade.current || !inRange(0.25, 0.5)) return
    const t = clock.elapsedTime % 4
    blade.current.position.y = 0.32 - (t < 0.4 ? t / 0.4 : t < 0.8 ? 1 - (t - 0.4) / 0.4 : 0) * 0.14
  })
  return (
    <group {...props}>
      <RoundedBox args={[0.5, 0.06, 0.6]} radius={0.01} position-y={0.03} material={M.graphite} />
      <mesh position={[0, 0.07, 0.08]} material={M.paper}>
        <boxGeometry args={[0.32, 0.04, 0.42]} />
      </mesh>
      {[-0.27, 0.27].map((x) => (
        <mesh key={x} position={[x, 0.22, -0.18]} material={M.graphite}>
          <boxGeometry args={[0.04, 0.4, 0.06]} />
        </mesh>
      ))}
      <group ref={blade} position={[0, 0.32, -0.12]}>
        <mesh material={M.chrome}>
          <boxGeometry args={[0.52, 0.06, 0.02]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} material={M.red}>
          <boxGeometry args={[0.56, 0.05, 0.05]} />
        </mesh>
      </group>
    </group>
  )
}

const CARD_VARIANTS: CardVariant[] = ['paper', 'ink', 'kraft', 'magenta', 'paper', 'ink']

function FloatingCards(props: GroupProps) {
  const group = useRef<THREE.Group>(null)
  const cards = useRef<Array<THREE.Group | null>>([])
  useFrame(({ clock }) => {
    if (!inRange(0.25, 0.5)) return
    const t = clock.elapsedTime
    if (group.current) group.current.rotation.y = t * 0.18
    cards.current.forEach((c, i) => {
      if (!c) return
      c.position.y = Math.sin(t * 0.9 + i) * 0.04
      c.rotation.z = Math.sin(t * 0.6 + i * 2) * 0.12
    })
  })
  return (
    <group {...props}>
      <group ref={group}>
        {CARD_VARIANTS.map((v, i) => {
          const a = (i / CARD_VARIANTS.length) * Math.PI * 2
          return (
            <group key={i} position={[Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38]} rotation-y={-a + Math.PI / 2}>
              <group ref={(el) => void (cards.current[i] = el)}>
                <BusinessCard variant={v} scale={3.2} rotation-x={-0.25} />
              </group>
            </group>
          )
        })}
      </group>
    </group>
  )
}

export function ImpressionStation() {
  const posters = useMemo(() => [0, 1, 2, 3].map((i) => posterTexture(i)), [])
  const items = useWallItems('impression', posters, 4, usePosterItems('impression'))
  return (
    <group>
      {/* machines cliquables : leur fiche (ce qu'elles fabriquent, réalisations du poste, devis) */}
      <Interactive position={[6.4, 0, -17.4]} rotation-y={FACE_MINUS_X} onSelect={machine('grand-format')} hoverScale={1.02}>
        <WideFormatPrinter />
      </Interactive>
      <Interactive position={[8.3, 0, -13.4]} rotation-y={FACE_MINUS_X} onSelect={machine('copieur')} hoverScale={1.03}>
        <Copier />
      </Interactive>
      <Interactive position={[8.75, 0, -21.5]} rotation-y={FACE_MINUS_X} onSelect={machine('decoupe')} hoverScale={1.03}>
        <VinylCutter />
      </Interactive>
      {/* réserve : rayonnage de stock, cartons et rouleaux de papier */}
      <Suspense fallback={null}>
        <Glb model="stockShelves" height={2.0} position={[9.45, 0, -10.5]} rotation-y={FACE_MINUS_X} />
        <Glb model="box" height={0.42} position={[9.2, 0, -11.75]} rotation-y={0.3} />
        <Glb model="box" height={0.42} position={[9.25, 0.42, -11.7]} rotation-y={-0.2} />
        <Glb model="box" height={0.42} position={[8.6, 0, -11.9]} rotation-y={1.1} />
      </Suspense>
      <PaperRolls position={[8.7, 0, -9.3]} />
      <GalleryWall
        items={items}
        width={8.4}
        height={items.length > 5 ? 2.6 : 2.0}
        rows={items.length > 5 ? 2 : 1}
        gap={0.4}
        position={[9.84, 2.75, -18.6]}
        rotation-y={FACE_MINUS_X}
      />
      <group position={[5.5, 0, -21.6]}>
        <Desk w={1.0} d={2.4} h={0.9} legs="white" />
        <Interactive position={[0, 0.9, -0.7]} rotation-y={FACE_MINUS_X} onSelect={machine('massicot')} hoverScale={1.05}>
          <Guillotine />
        </Interactive>
        {[0.15, 0.45].map((z, i) => (
          <group key={z} position={[0.1, 0.9, z]} rotation-y={0.2 * i}>
            <mesh position-y={0.03 + i * 0.02} material={M.paper}>
              <boxGeometry args={[0.21, 0.06 + i * 0.04, 0.297]} />
            </mesh>
            <mesh position-y={0.061 + i * 0.04} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[0.21, 0.297]} />
              <meshStandardMaterial map={i ? posterTexture(1) : flyerTexture()} roughness={0.85} />
            </mesh>
          </group>
        ))}
        <FloatingCards position={[0, 1.5, 0.75]} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* 03 — Textile                                                        */
/* ------------------------------------------------------------------ */

/** Presse carrousel de sérigraphie : les bras tournent d'un quart de tour à chaque passage. */
function CarouselPress(props: GroupProps) {
  const arms = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!arms.current || !inRange(0.36, 0.62)) return
    const t = clock.elapsedTime / 3
    const step = Math.floor(t)
    const f = Math.min(1, (t - step) * 3)
    arms.current.rotation.y = (step + f * f * (3 - 2 * f)) * (Math.PI / 2)
  })
  const colors = ['#2563eb', '#e5007d', '#ffd400', '#0f172a']
  return (
    <group {...props}>
      <mesh position-y={0.03} material={M.graphite}>
        <cylinderGeometry args={[0.4, 0.45, 0.06, 32]} />
      </mesh>
      <mesh position-y={0.75} material={M.steel}>
        <cylinderGeometry args={[0.06, 0.06, 1.5, 16]} />
      </mesh>
      {/* plateaux fixes avec T-shirts */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation-y={(i * Math.PI) / 2 + Math.PI / 4}>
          <mesh position={[0, 0.82, 0.55]} material={M.graphite}>
            <boxGeometry args={[0.05, 0.05, 0.9]} />
          </mesh>
          <RoundedBox args={[0.42, 0.03, 0.5]} radius={0.01} position={[0, 0.86, 0.85]} material={M.aluminium} />
          <mesh position={[0, 0.88, 0.85]} rotation-x={-Math.PI / 2} material={M.paper}>
            <planeGeometry args={[0.36, 0.42]} />
          </mesh>
        </group>
      ))}
      {/* bras porte-écrans (encres de couleur) */}
      <group ref={arms} position-y={1.25}>
        {colors.map((c, i) => (
          <group key={c} rotation-y={(i * Math.PI) / 2 + Math.PI / 4}>
            <mesh position={[0, 0, 0.5]} material={M.steel}>
              <boxGeometry args={[0.05, 0.05, 0.8]} />
            </mesh>
            <mesh position={[0, -0.04, 0.85]}>
              <boxGeometry args={[0.46, 0.03, 0.54]} />
              <meshStandardMaterial color={c} roughness={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

function HeatPress(props: GroupProps) {
  const head = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!head.current || !inRange(0.36, 0.62)) return
    const t = clock.elapsedTime % 5
    const down = t < 1 ? t : t < 3 ? 1 : t < 4 ? 4 - t : 0
    head.current.rotation.x = -0.75 * (1 - down)
  })
  return (
    <group {...props}>
      <RoundedBox args={[0.46, 0.08, 0.6]} radius={0.015} position-y={0.04} material={M.graphite} />
      <mesh position-y={0.095} material={M.ink}>
        <boxGeometry args={[0.4, 0.03, 0.5]} />
      </mesh>
      <mesh position={[0, 0.3, -0.31]} material={M.graphite}>
        <boxGeometry args={[0.09, 0.5, 0.08]} />
      </mesh>
      {/* T-shirt en place sur le plateau */}
      <mesh position={[0, 0.112, 0.02]} rotation-x={-Math.PI / 2} material={M.paper}>
        <planeGeometry args={[0.36, 0.44]} />
      </mesh>
      {/* boîtier de commande : température et minuterie */}
      <group position={[0.13, 0.42, -0.31]}>
        <RoundedBox args={[0.2, 0.12, 0.07]} radius={0.012} material={M.plasticDark} />
        <mesh position={[-0.045, 0.012, 0.036]} material={G.red}>
          <planeGeometry args={[0.07, 0.03]} />
        </mesh>
        <mesh position={[0.045, 0.012, 0.036]} material={G.green}>
          <planeGeometry args={[0.05, 0.03]} />
        </mesh>
        {[-0.05, 0, 0.05].map((x) => (
          <mesh key={x} position={[x, -0.032, 0.036]} material={M.graphite}>
            <circleGeometry args={[0.009, 12]} />
          </mesh>
        ))}
      </group>
      <group ref={head} position={[0, 0.5, -0.3]}>
        <RoundedBox args={[0.42, 0.06, 0.5]} radius={0.01} position={[0, -0.33, 0.27]} material={M.steel} />
        <mesh position={[0, -0.12, 0.08]} rotation-x={0.6} material={M.graphite}>
          <boxGeometry args={[0.06, 0.4, 0.06]} />
        </mesh>
        <mesh position={[0, 0.02, 0.24]} rotation-z={Math.PI / 2} material={M.rubber}>
          <capsuleGeometry args={[0.024, 0.24, 4, 12]} />
        </mesh>
        {/* plateau chauffant : capot alu et plaque inférieure siliconée */}
        <mesh position={[0, -0.367, 0.27]} material={M.inkMatte}>
          <boxGeometry args={[0.4, 0.01, 0.48]} />
        </mesh>
      </group>
    </group>
  )
}

/** Portant face à l'allée (orienté vers la caméra du poste), table des casquettes devant. */
const RAIL_AT: [number, number, number] = [-5.25, 0, -25.2]
const RAIL_TURN = 1.15
const CAPS_AT: [number, number, number] = [-4.7, 0, -24.62]

export function TextileStation() {
  const products = useSite((s) => s.products)
  const textile = useMemo(() => productsOf(products, 'textile'), [products])
  const garments = useMemo(() => textile.filter((p) => HANGING_MODELS.includes(p.model)), [textile])
  const caps = useMemo(() => textile.filter((p) => CAP_MODELS.includes(p.model)), [textile])
  const realisations = useSite((s) => s.realisations)
  const items = useMemo(() => realisationItems(realisationsOf(realisations, 'textile')), [realisations])
  return (
    <group>
      <GarmentRail products={garments} station="textile" position={RAIL_AT} rotation-y={RAIL_TURN} />
      {caps.length > 0 && (
        <group position={CAPS_AT} rotation-y={RAIL_TURN}>
          <WhiteTable w={2.4} d={0.6} h={0.78} />
          <CapCarousel products={caps} station="textile" position={[0, 0.78, 0.02]} />
        </group>
      )}
      {items.length > 0 && (
        <GalleryWall items={items} width={6.2} height={0.95} position={[-9.84, 3.95, -27.5]} rotation-y={FACE_PLUS_X} />
      )}
      <group position={[-7.9, 0, -28.9]} rotation-y={0.5}>
        <Desk w={0.9} d={1.0} h={0.9} legs="white" />
        <Interactive position-y={0.9} rotation-y={FACE_PLUS_X} onSelect={machine('presse-chaud')} hoverScale={1.05}>
          <HeatPress />
        </Interactive>
      </group>
      <Interactive position={[-6.9, 0, -31.4]} onSelect={machine('carrousel')} hoverScale={1.03}>
        <CarouselPress />
      </Interactive>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* 04 — Objets & cadeaux                                               */
/* ------------------------------------------------------------------ */

const PLINTHS: Array<[number, number, number]> = [
  [5.3, -33.4, 0.85],
  [6.9, -34.8, 0.7],
  [5.2, -36.3, 0.75],
  [6.9, -37.8, 0.85],
  [5.45, -39.3, 0.8],
]

/** Le produit fait face au visiteur et pivote légèrement, comme posé sur un présentoir. */
function Presenter({ children, face, seed }: { children: ReactNode; face: number; seed: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current && inRange(0.48, 0.72)) ref.current.rotation.y = face + Math.sin(clock.elapsedTime * 0.6 + seed) * 0.22
  })
  return (
    <group ref={ref} rotation-y={face}>
      {children}
    </group>
  )
}

/** Point de vue du poste Objets (voir journey/chapters). */
const OBJETS_EYE = [2.5, -32.7] as const

export function ObjetsStation() {
  const products = useSite((s) => s.products)
  const objets = productsOf(products, 'objets')
  const realisations = useSite((s) => s.realisations)
  const items = useMemo(() => realisationItems(realisationsOf(realisations, 'objets')), [realisations])
  return (
    <group>
      {objets.slice(0, PLINTHS.length).map((p, i) => {
        const [x, z, h] = PLINTHS[i]!
        return (
          <group key={p.id} position={[x, 0, z]}>
            <RoundedBox args={[0.5, h, 0.5]} radius={0.015} position-y={h / 2} material={M.plinth} castShadow />
            <mesh position={[0, h - 0.3, 0.251]} material={M.accent}>
              <planeGeometry args={[0.5, 0.012]} />
            </mesh>
            <group position-y={h}>
              <Presenter face={Math.atan2(OBJETS_EYE[0] - x, OBJETS_EYE[1] - z)} seed={i}>
                <ProductDisplay product={p} scale={1.9} seed={i} />
              </Presenter>
            </group>
          </group>
        )
      })}
      {items.length > 0 && (
        <GalleryWall items={items} width={5.5} height={1.6} position={[9.84, 2.6, -36.4]} rotation-y={FACE_MINUS_X} />
      )}
      {/* vitrine de showroom : console garnie contre le mur, suspensions au-dessus des présentoirs */}
      <GiftConsole position={[9.42, 0, -36.3]} rotation-y={FACE_MINUS_X} />
      <Suspense fallback={null}>
        {[-34.1, -36.55, -38.55].map((z) => (
          <Pendant key={z} position={[6.05, 2.95, z]} />
        ))}
      </Suspense>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* 05 — Événementiel                                                   */
/* ------------------------------------------------------------------ */

/** Kakémono : affiche une réalisation de l'admin (cliquable) ou un visuel par défaut. */
function RollUp({ variant, item, ...props }: GroupProps & { variant: number; item?: WallItem }) {
  const lazy = useLazyTexture(item?.image ? thumb(item.image, 1000) : null)
  const map = useMemo(() => {
    if (!lazy) return rollupTexture(variant)
    // Recadrage « cover » au format du kakémono (0,85 × 2).
    const t = lazy.clone()
    const img = lazy.image as { width: number; height: number }
    const target = 0.85 / 2
    const ratio = img.width / img.height
    if (ratio > target) {
      t.repeat.set(target / ratio, 1)
      t.offset.set((1 - target / ratio) / 2, 0)
    } else {
      t.repeat.set(1, ratio / target)
      t.offset.set(0, (1 - ratio / target) / 2)
    }
    t.needsUpdate = true
    return t
  }, [lazy, variant])
  const body = (
    <group>
      <RoundedBox args={[0.88, 0.09, 0.22]} radius={0.02} position-y={0.045} material={M.aluminium} castShadow />
      <mesh position={[0, 1.1, -0.05]} material={M.steel}>
        <cylinderGeometry args={[0.008, 0.008, 2.1, 8]} />
      </mesh>
      <mesh position={[0, 1.1, 0.002]}>
        <planeGeometry args={[0.85, 2.0]} />
        <meshStandardMaterial map={map} roughness={0.75} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
  const onSelect = item?.onSelect ?? openCatalogue('evenementiel')
  return (
    <Interactive {...props} onSelect={onSelect} hoverScale={1.03}>
      {body}
    </Interactive>
  )
}

let sailGeometry: THREE.ShapeGeometry | null = null
function getSailGeometry() {
  if (sailGeometry) return sailGeometry
  const s = new THREE.Shape()
  s.moveTo(0, 0.3)
  s.quadraticCurveTo(0.78, 0.55, 0.7, 1.5)
  s.quadraticCurveTo(0.62, 2.45, 0, 2.7)
  s.lineTo(0, 0.3)
  const g = new THREE.ShapeGeometry(s, 24)
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 0.75, (pos.getY(i) - 0.3) / 2.4)
  sailGeometry = g
  return g
}

function BeachFlag({ variant, ...props }: GroupProps & { variant: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current && inRange(0.6, 0.8)) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.9 + variant) * 0.18
  })
  return (
    <group {...props}>
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} position-y={0.02} rotation-y={r} material={M.ink}>
          <boxGeometry args={[0.7, 0.04, 0.05]} />
        </mesh>
      ))}
      <group ref={ref}>
        <mesh position-y={1.4} material={M.steel}>
          <cylinderGeometry args={[0.012, 0.016, 2.8, 8]} />
        </mesh>
        <mesh geometry={getSailGeometry()} position={[0.015, 0, 0]}>
          <meshStandardMaterial map={flagTexture(variant)} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

function Photocall(props: GroupProps) {
  const w = 6
  const h = 2.8
  // fond choisi dans l'espace pro (mur de logos, visuel d'événement), recadré au format du photocall
  const url = useSite((s) => s.settings.display.photocall)
  const photo = useFittedTexture(url ? thumb(url, 2048) : null, 2048, 956, 'cover', '#ffffff')
  return (
    <group {...props}>
      <mesh position-y={0.1 + h / 2}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={photo ?? photocallTexture()} roughness={0.8} />
      </mesh>
      {[-w / 2 - 0.06, w / 2 + 0.06].map((x) => (
        <mesh key={x} position={[x, (h + 0.25) / 2, 0.05]} material={M.steel}>
          <cylinderGeometry args={[0.05, 0.05, h + 0.25, 12]} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.2, 0.05]} rotation-z={Math.PI / 2} material={M.steel}>
        <cylinderGeometry args={[0.05, 0.05, w + 0.24, 12]} />
      </mesh>
    </group>
  )
}

export function EvenementielStation() {
  const realisations = useSite((s) => s.realisations)
  const posters = usePosterItems('evenementiel')
  // kakémonos : réalisations de l'événementiel d'abord, puis les grandes affiches de l'espace pro
  const items = useMemo(() => [...realisationItems(realisationsOf(realisations, 'evenementiel')), ...posters], [realisations, posters])
  return (
    <group>
      <Photocall position={[-9.6, 0, -44]} rotation-y={FACE_PLUS_X} />
      <RollUp variant={0} item={items[0]} position={[-7.1, 0, -42.3]} rotation-y={FACE_PLUS_X + 0.35} />
      <RollUp variant={1} item={items[1]} position={[-7.3, 0, -44.0]} rotation-y={FACE_PLUS_X + 0.2} />
      <RollUp variant={2} item={items[2]} position={[-7.1, 0, -45.7]} rotation-y={FACE_PLUS_X + 0.05} />
      <BeachFlag variant={0} position={[-4.9, 0, -41.6]} rotation-y={FACE_PLUS_X + 0.5} />
      <BeachFlag variant={1} position={[-4.9, 0, -46.6]} rotation-y={FACE_PLUS_X + 0.2} />
      {/* comptoir d'accueil imprimé et banderole à œillets au-dessus du photocall */}
      <EventCounter position={[-5.6, 0, -44.1]} rotation-y={FACE_PLUS_X} />
      <mesh position={[-9.9, 4.3, -44]} rotation-y={FACE_PLUS_X}>
        <planeGeometry args={[6.4, 0.94]} />
        <meshStandardMaterial map={eventBannerTexture()} roughness={0.7} />
      </mesh>
      {[-42.5, -45.5].map((z) => (
        <group key={z} position={[-8.2, 0, z]} rotation-y={FACE_MINUS_X}>
          <mesh position-y={0.15} rotation-x={0.5} material={M.ink}>
            <cylinderGeometry args={[0.09, 0.07, 0.22, 16]} />
          </mesh>
          <mesh position={[0, 0.25, 0.056]} rotation-x={0.5 - Math.PI / 2} material={G.warm}>
            <circleGeometry args={[0.07, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
