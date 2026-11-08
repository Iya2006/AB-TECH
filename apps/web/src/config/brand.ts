import { DEFAULT_SETTINGS, type SiteSettings } from '@atelier/shared'

/**
 * Identité et coordonnées du client.
 * Valeurs par défaut ci-dessous, remplacées au chargement par les paramètres
 * modifiés dans l'espace pro (/admin → Paramètres). Les textures 3D (enseigne,
 * produits, cartes…) sont dessinées à partir de cet objet.
 */
export const BRAND: SiteSettings = structuredClone(DEFAULT_SETTINGS)

export function applySettings(settings: SiteSettings) {
  Object.assign(BRAND, structuredClone(settings))
}

const digits = (phone: string) => phone.replace(/\D/g, '')

export function telHref(phone: string) {
  const cc = BRAND.whatsappCountryCode
  return `tel:${cc ? `+${cc}` : ''}${digits(phone)}`
}

/** Lien WhatsApp vers le premier numéro, ou null si l'indicatif pays n'est pas renseigné. */
export function whatsappLink(message: string): string | null {
  const cc = BRAND.whatsappCountryCode
  const phone = BRAND.phones[0]
  if (!cc || !phone) return null
  return `https://wa.me/${cc}${digits(phone)}?text=${encodeURIComponent(message)}`
}

/** Prix formaté, ou « Prix sur demande ». */
export function formatPrice(value: number | null) {
  if (value === null || !BRAND.currency) return 'Prix sur demande'
  return `${new Intl.NumberFormat('fr-FR').format(value)} ${BRAND.currency}`
}
