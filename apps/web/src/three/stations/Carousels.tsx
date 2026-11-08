import type { Product, StationSlug } from '@atelier/shared'
import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { formatPrice } from '../../config/brand'
import { useApp } from '../../lib/store'
import { M } from '../materials'
import { Hanger, type GroupProps } from '../models/products'
import { PhotoPlane, useProductPhoto, useStationActive } from '../PhotoProduct'

/**
 * Le catalogue qui défile dans l'atelier : un portant de vêtements et une rangée de casquettes.
 * Flèches, glisser ou clic sur un article : il vient au centre, face au visiteur.
 */

type Rail = 'textile' | 'caps'
interface RailState {
  index: Record<Rail, number>
  step: (rail: Rail, delta: number) => void
  go: (rail: Rail, index: number) => void
}
export const useRails = create<RailState>((set) => ({
  index: { textile: 0, caps: 0 },
  step: (rail, delta) => set((s) => ({ index: { ...s.index, [rail]: s.index[rail] + delta } })),
  go: (rail, index) => set((s) => ({ index: { ...s.index, [rail]: index } })),
}))

/** Position d'un article sur le carrousel (s = 0 : au centre). Au-delà de 5 articles, la liste boucle. */
function slot(i: number, offset: number, n: number) {
  if (n <= 5) return i - offset
  return ((((i - offset + n / 2) % n) + n) % n) - n / 2
}
const mod = (a: number, n: number) => ((a % n) + n) % n

/** Défilement amorti + glisser à la souris / au doigt. */
function useCarousel(rail: Rail, count: number, unit: number) {
  const target = useRails((s) => s.index[rail])
  const state = useRef({ offset: 0, velocity: 0, drag: 0, from: null as number | null })
  useFrame((_, dt) => {
    const st = state.current
    // moins de 6 articles : pas de boucle, on reste dans la liste
    const goal = count <= 5 ? Math.min(count - 1, Math.max(0, target)) : target
    const prev = st.offset
    st.offset = THREE.MathUtils.damp(st.offset, goal + st.drag, 5.5, dt)
    st.velocity = dt > 0 ? (st.offset - prev) / dt : 0
  })
  const bind = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      // position mesurée dans le repère du carrousel (il est tourné vers l'allée)
      state.current.from = e.eventObject.worldToLocal(e.point.clone()).x
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const st = state.current
      if (st.from === null) return
      st.drag = -(e.eventObject.worldToLocal(e.point.clone()).x - st.from) / unit
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      const st = state.current
      ;(e.target as Element).releasePointerCapture?.(e.pointerId)
      if (st.from === null) return
      st.from = null
      const moved = Math.round(st.drag)
      st.offset -= st.drag - moved // garde la position visuelle au lâcher
      st.drag = 0
      if (moved) useRails.getState().step(rail, moved)
    },
  }
  return { state, bind, target }
}

function ArrowButton({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir < 0 ? 'Article précédent' : 'Article suivant'}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-white/95 text-ink shadow-[0_10px_30px_-12px_rgba(15,23,42,0.5)] ring-1 ring-ink/10 transition hover:bg-ink hover:text-paper"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d={dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  )
}

/**
 * Commande du carrousel : flèches + fiche courte de l'article au centre (texte HTML : toujours net).
 * z-index 0 : les panneaux de texte du parcours restent au-dessus.
 */
function Controller({ rail, product, index, count, position }: { rail: Rail; product: Product; index: number; count: number; position: [number, number, number] }) {
  return (
    <Html position={position} center zIndexRange={[0, 0]}>
      <div className="tag-enter flex items-center gap-2">
        {count > 1 && <ArrowButton dir={-1} onClick={() => useRails.getState().step(rail, -1)} />}
        <button
          type="button"
          key={product.id}
          onClick={() => useApp.getState().open({ type: 'product', id: product.id })}
          className="flex w-[300px] items-center gap-3 rounded-2xl bg-[linear-gradient(160deg,#13203b,#0a1020_70%)] px-4 py-3 text-left shadow-[0_18px_40px_-18px_rgba(10,16,32,0.75)] ring-1 ring-white/10 transition hover:scale-[1.03]"
        >
          <span className="size-7 shrink-0 rounded-full ring-2 ring-white/25" style={{ background: product.color }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-white">{product.name}</span>
            <span className="flex items-center gap-2 whitespace-nowrap text-[12.5px]">
              <span className={`font-display ${product.price !== null ? 'text-[15px] text-white' : 'text-accent-2'}`}>{formatPrice(product.price)}</span>
              <span className="text-white/30">·</span>
              <span className="text-white/55">
                {index + 1} / {count}
              </span>
            </span>
          </span>
          <span className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-white">Voir</span>
        </button>
        {count > 1 && <ArrowButton dir={1} onClick={() => useRails.getState().step(rail, 1)} />}
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/* Portant de vêtements                                                */
/* ------------------------------------------------------------------ */

const RAIL_HALF = 2.15
const RAIL_Y = 1.95
const BEND = 0.16
const railX = (s: number) => {
  const a = Math.abs(s)
  return Math.sign(s) * (a <= 1 ? a * 0.8 : 0.8 + (a - 1) * 0.44)
}
const railZ = (x: number) => -BEND * x * x

/** Hauteur réelle d'une pièce suspendue (photo avec ou sans cintre). */
function garmentHeight(model: string, withHanger: boolean) {
  const h = model === 'sweat' ? 0.84 : model === 'pull' ? 0.66 : 0.74
  return withHanger ? h + 0.16 : h
}

function RailItem({ product, i, count, carousel }: { product: Product; i: number; count: number; carousel: ReturnType<typeof useCarousel> }) {
  const group = useRef<THREE.Group>(null)
  const swing = useRef<THREE.Group>(null)
  const photo = useProductPhoto(product)
  useFrame(({ clock }, dt) => {
    const g = group.current
    if (!g) return
    const { offset, velocity } = carousel.state.current
    const s = slot(i, offset, count)
    const a = Math.abs(s)
    const x = railX(s)
    g.position.set(x, RAIL_Y, railZ(x))
    // au centre : face au visiteur ; sur les côtés : de profil, comme sur un vrai portant
    g.rotation.y = -Math.sign(s) * Math.min(a, 1) * 1.15 + Math.atan(2 * BEND * x) * 0.6
    const fade = THREE.MathUtils.clamp((2.75 - a) / 0.4, 0, 1)
    g.scale.setScalar((1 - Math.min(a, 1) * 0.06) * fade)
    g.visible = fade > 0.01
    if (swing.current) {
      const t = clock.elapsedTime
      const push = THREE.MathUtils.clamp(-velocity * 0.09, -0.3, 0.3)
      swing.current.rotation.z = THREE.MathUtils.damp(swing.current.rotation.z, push + Math.sin(t * 1.1 + i) * 0.012, 4, dt)
      swing.current.rotation.x = Math.sin(t * 0.8 + i * 1.7) * 0.02
    }
  })
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    const s = slot(i, carousel.state.current.offset, count)
    if (Math.abs(s) < 0.5) useApp.getState().open({ type: 'product', id: product.id })
    else useRails.getState().step('textile', Math.round(s))
  }
  const withHanger = photo?.hanger ?? false
  return (
    <group ref={group}>
      <group ref={swing} onClick={click} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        {!withHanger && <Hanger position-y={-0.055} />}
        {photo && <PhotoPlane photo={photo} height={garmentHeight(product.model, withHanger)} anchor="top" position-y={withHanger ? 0.03 : -0.1} />}
      </group>
    </group>
  )
}

export function GarmentRail({ products, station, ...props }: GroupProps & { products: Product[]; station: StationSlug }) {
  const carousel = useCarousel('textile', products.length, 0.8)
  const active = useStationActive(station)
  const tube = useMemo(() => {
    const pts = Array.from({ length: 33 }, (_, k) => {
      const x = -RAIL_HALF - 0.15 + ((RAIL_HALF + 0.15) * 2 * k) / 32
      return new THREE.Vector3(x, RAIL_Y + 0.02, railZ(x))
    })
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.016, 12, false)
  }, [])
  const ends = [-RAIL_HALF - 0.15, RAIL_HALF + 0.15]
  const current = products.length ? mod(Math.round(carousel.target), products.length) : 0
  const centered = products[products.length <= 5 ? Math.min(products.length - 1, Math.max(0, carousel.target)) : current]
  return (
    <group {...props}>
      {/* le portant : barre chromée cintrée, montants et pieds */}
      <mesh geometry={tube} material={M.chrome} />
      {ends.map((x) => (
        <group key={x} position={[x, 0, railZ(x)]}>
          <mesh position-y={(RAIL_Y + 0.02) / 2} material={M.chrome}>
            <cylinderGeometry args={[0.018, 0.018, RAIL_Y + 0.02, 12]} />
          </mesh>
          <mesh position-y={0.02} rotation-y={Math.atan(2 * BEND * x)} material={M.darkSteel}>
            <boxGeometry args={[0.06, 0.04, 0.62]} />
          </mesh>
        </group>
      ))}
      {/* zone de glisser invisible devant les vêtements */}
      <mesh position={[0, RAIL_Y - 0.5, 0.25]} {...carousel.bind}>
        <planeGeometry args={[RAIL_HALF * 2.2, 1.3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {products.map((p, i) => (
        <RailItem key={p.id} product={p} i={i} count={products.length} carousel={carousel} />
      ))}
      {active && centered && <Controller rail="textile" product={centered} index={products.indexOf(centered)} count={products.length} position={[0, RAIL_Y + 0.32, 0.05]} />}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Casquettes                                                          */
/* ------------------------------------------------------------------ */

const CAP_STEP = 0.46

function CapItem({ product, i, count, carousel }: { product: Product; i: number; count: number; carousel: ReturnType<typeof useCarousel> }) {
  const group = useRef<THREE.Group>(null)
  const photo = useProductPhoto(product)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const s = slot(i, carousel.state.current.offset, count)
    const a = Math.abs(s)
    const center = 1 - Math.min(a, 1)
    const fade = THREE.MathUtils.clamp((2.6 - a) / 0.4, 0, 1)
    g.position.set(s * CAP_STEP, center * 0.05 + Math.sin(clock.elapsedTime * 1.4 + i) * 0.008 * center, -Math.min(a, 2) * 0.08)
    g.scale.setScalar((0.82 + center * 0.4) * fade)
    g.visible = fade > 0.01
  })
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    const s = slot(i, carousel.state.current.offset, count)
    if (Math.abs(s) < 0.5) useApp.getState().open({ type: 'product', id: product.id })
    else useRails.getState().step('caps', Math.round(s))
  }
  return (
    <group ref={group} onClick={click} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      {/* présentoir */}
      <mesh position-y={0.005} material={M.ink}>
        <cylinderGeometry args={[0.07, 0.075, 0.01, 32]} />
      </mesh>
      <mesh position-y={0.08} material={M.chrome}>
        <cylinderGeometry args={[0.008, 0.008, 0.16, 8]} />
      </mesh>
      {photo && <PhotoPlane photo={photo} height={0.2} anchor="bottom" position-y={0.12} />}
    </group>
  )
}

export function CapCarousel({ products, station, ...props }: GroupProps & { products: Product[]; station: StationSlug }) {
  const carousel = useCarousel('caps', products.length, CAP_STEP)
  const active = useStationActive(station)
  const current = products.length ? mod(Math.round(carousel.target), products.length) : 0
  const centered = products[products.length <= 5 ? Math.min(products.length - 1, Math.max(0, carousel.target)) : current]
  return (
    <group {...props}>
      <mesh position={[0, 0.25, 0.1]} {...carousel.bind}>
        <planeGeometry args={[CAP_STEP * 5, 0.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {products.map((p, i) => (
        <CapItem key={p.id} product={p} i={i} count={products.length} carousel={carousel} />
      ))}
      {active && centered && <Controller rail="caps" product={centered} index={products.indexOf(centered)} count={products.length} position={[0, -0.12, 0.35]} />}
    </group>
  )
}
