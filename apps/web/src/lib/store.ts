import type { Customization } from '@atelier/shared'
import { create } from 'zustand'
import { detectQuality, type Quality } from './device'
import type { MachineId } from './machines'

export interface QuotePrefill {
  service?: string
  customization?: Customization
  /** Aperçu 3D capturé dans le Studio, joint à la demande. */
  mockup?: Blob
  mockupPreview?: string
  /** Logo importé dans le Studio. */
  logo?: File
}

export type Mood = 'day' | 'night'

/** Jour de 6h30 à 18h30, heure du visiteur. */
export function moodFromClock(date = new Date()): Mood {
  const h = date.getHours() + date.getMinutes() / 60
  return h >= 6.5 && h < 18.5 ? 'day' : 'night'
}

/** Forçage pour comparer ou capturer : ?mood=day | night (ou jour | nuit). */
function moodFromUrl(): Mood | null {
  const v = new URLSearchParams(window.location.search).get('mood')
  return v === 'day' || v === 'jour' ? 'day' : v === 'night' || v === 'nuit' ? 'night' : null
}
const forcedMood = moodFromUrl()

export type Overlay =
  | { type: 'realisation'; id: string; index?: number }
  | { type: 'product'; id: string }
  | { type: 'catalogue'; tab?: 'realisations' | 'produits'; station?: string }
  | { type: 'cart'; step?: 'checkout' }
  | { type: 'machine'; id: MachineId }
  | null

interface AppState {
  /** Le préchargement est terminé et la façade est visible. */
  ready: boolean
  quality: Quality
  /** Index du chapitre affiché dans le parcours (-1 : hors parcours). */
  chapter: number
  prefill: QuotePrefill | null
  mood: Mood
  /** Vrai tant que le visiteur n'a pas choisi lui-même jour ou nuit. */
  moodAuto: boolean
  overlay: Overlay
  setReady: (ready: boolean) => void
  setQuality: (quality: Quality) => void
  setChapter: (chapter: number) => void
  setPrefill: (prefill: QuotePrefill | null) => void
  toggleMood: () => void
  open: (overlay: Overlay) => void
  close: () => void
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  quality: detectQuality(),
  chapter: 0,
  prefill: null,
  mood: forcedMood ?? moodFromClock(),
  moodAuto: !forcedMood,
  overlay: null,
  setReady: (ready) => set({ ready }),
  setQuality: (quality) => set({ quality }),
  setChapter: (chapter) => {
    if (get().chapter !== chapter) set({ chapter })
  },
  setPrefill: (prefill) => {
    const previous = get().prefill?.mockupPreview
    if (previous && previous !== prefill?.mockupPreview) URL.revokeObjectURL(previous)
    set({ prefill })
  },
  toggleMood: () => set((s) => ({ mood: s.mood === 'day' ? 'night' : 'day', moodAuto: false })),
  open: (overlay) => set({ overlay }),
  close: () => set({ overlay: null }),
}))

// Le site suit l'heure : bascule automatique jour/nuit (sauf choix manuel du visiteur).
setInterval(() => {
  const { moodAuto, mood } = useApp.getState()
  const next = moodFromClock()
  if (moodAuto && next !== mood) useApp.setState({ mood: next })
}, 60_000)
