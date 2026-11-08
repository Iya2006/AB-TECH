import {
  DEFAULT_SETTINGS,
  DEFAULT_STATIONS,
  type Product,
  type Realisation,
  type SectionId,
  type SiteData,
  type StationSlug,
} from '@atelier/shared'
import { create } from 'zustand'
import { applySettings } from '../config/brand'
import { api } from './api'

/** Contenu du site public, chargé depuis l'API (avec des valeurs de secours si elle ne répond pas). */
export const useSite = create<SiteData & { loaded: boolean }>(() => ({
  settings: DEFAULT_SETTINGS,
  stations: DEFAULT_STATIONS,
  realisations: [],
  products: [],
  loaded: false,
}))

export async function loadSite() {
  try {
    const data = await api.site()
    applySettings(data.settings)
    useSite.setState({ ...data, loaded: true })
  } catch {
    useSite.setState({ loaded: true })
  }
}

export const stationOf = (slug: StationSlug) =>
  useSite.getState().stations.find((s) => s.slug === slug) ?? DEFAULT_STATIONS.find((s) => s.slug === slug)!

export const realisationsOf = (list: Realisation[], station: StationSlug) => list.filter((r) => r.station === station)

/** Textes d'une section de la page (réglés dans l'espace pro, valeurs par défaut sinon). */
export const useSection = (id: SectionId) => useSite((s) => s.settings.sections?.[id] ?? DEFAULT_SETTINGS.sections[id])
export const productsOf = (list: Product[], station: StationSlug) => list.filter((p) => p.station === station)
