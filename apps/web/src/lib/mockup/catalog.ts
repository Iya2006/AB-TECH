import type { ProductModel } from '@atelier/shared'
import { BASES } from './bases'
import type { MockupBase } from './engine'

/**
 * Vrais produits photographiés pour chaque forme : photo détourée (portant, étagère, Studio)
 * et, pour le textile, la même pièce portée par un homme et par une femme.
 */
export type PhotoModel = 'tshirt' | 'polo' | 'sweat' | 'pull' | 'casquette' | 'snapback' | 'trucker' | 'tote' | 'mug' | 'gourde'

export interface PhotoEntry {
  produit: MockupBase
  homme?: MockupBase
  femme?: MockupBase
  /** Couleur réelle de la pièce photographiée : choisie, on affiche la photo telle quelle. */
  natural: string
}

const WHITE = '#f5f3ee'

export const PHOTO: Record<PhotoModel, PhotoEntry> = {
  tshirt: { produit: BASES['p-tshirt'], homme: BASES['homme-tshirt'], femme: BASES['femme-tshirt'], natural: WHITE },
  polo: { produit: BASES['p-polo'], homme: BASES['homme-polo'], femme: BASES['femme-polo'], natural: WHITE },
  sweat: { produit: BASES['p-sweat'], homme: BASES['homme-sweat'], femme: BASES['femme-sweat'], natural: WHITE },
  pull: { produit: BASES['p-pull'], natural: WHITE },
  casquette: { produit: BASES['p-casquette'], homme: BASES['homme-casquette'], femme: BASES['femme-casquette'], natural: '#e9b22a' },
  snapback: { produit: BASES['p-snapback'], natural: WHITE },
  trucker: { produit: BASES['p-trucker'], natural: WHITE },
  tote: { produit: BASES['p-tote'], natural: '#ece3cf' },
  mug: { produit: BASES['p-mug'], natural: '#f7f5f0' },
  gourde: { produit: BASES['p-gourde'], natural: '#e8eaed' },
}

export const isPhotoModel = (m: ProductModel): m is PhotoModel => m in PHOTO
export const HANGING_MODELS: ProductModel[] = ['tshirt', 'polo', 'sweat', 'pull']
export const CAP_MODELS: ProductModel[] = ['casquette', 'snapback', 'trucker']

/** null = garder la couleur de la photo (évite de « repeindre » un blanc par un autre blanc). */
export function tint(entry: PhotoEntry, base: MockupBase, color: string) {
  const natural = base === entry.produit ? entry.natural : WHITE
  return color.toLowerCase() === natural ? null : color
}

/** Fond studio des maquettes (identique au fond des photos de personnes). */
export const STUDIO_BG = '#e6ecf3'
