import { z } from 'zod'
import { SERVICE_SLUGS } from './catalog'

export const PRODUCT_KINDS = ['tshirt', 'polo', 'sweat', 'casquette', 'mug', 'tote', 'carte'] as const
export type ProductKind = (typeof PRODUCT_KINDS)[number]

export const WEARERS = ['homme', 'femme', 'seul'] as const
export type Wearer = (typeof WEARERS)[number]

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide')
const short = (max: number) => z.string().trim().max(max)

export const customizationSchema = z.object({
  product: z.enum(PRODUCT_KINDS),
  text: short(40),
  baseColor: hexColor,
  inkColor: hexColor,
  /** Modèle choisi : type de casquette, ou référence du style de carte (ex. « CV-03 · Moderne »). */
  style: short(60).optional(),
  wearer: z.enum(WEARERS).optional(),
  /** Coordonnées imprimées sur la carte de visite. */
  card: z
    .object({ name: short(60), title: short(60), phone: short(40), email: short(80) })
    .optional(),
  /** Deuxième ligne de texte (slogan, site web…). */
  sub: short(60).optional(),
  /** Police choisie pour le texte. */
  font: short(40).optional(),
  /** Emplacement du marquage (ex. « Cœur », « Grand format », « Personnalisé · 62 % »). */
  placement: short(60).optional(),
  /** Technique souhaitée (sérigraphie, broderie…). */
  technique: short(40).optional(),
  /** Quantités demandées, par taille (« M » : 12) ou au total (« Total » : 250). */
  quantities: z.record(z.string().trim().max(12), z.number().int().min(0).max(100000)).optional(),
})
export type Customization = z.infer<typeof customizationSchema>

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined))

/** Seules les URLs renvoyées par notre propre endpoint d'upload sont acceptées côté API. */
const uploadedUrl = z.string().trim().max(500).optional()

export const quoteRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Indiquez votre nom').max(120),
  company: optionalText(120),
  phone: z
    .string()
    .trim()
    .min(8, 'Numéro trop court')
    .max(25)
    .regex(/^[+0-9 ().-]+$/, 'Numéro invalide'),
  email: z
    .union([z.literal(''), z.email('E-mail invalide').max(160)])
    .optional()
    .transform((v) => (v ? v : undefined)),
  service: z.enum(SERVICE_SLUGS, { message: 'Choisissez une prestation' }),
  quantity: z.coerce.number().int().min(1).max(100000).optional(),
  message: z.string().trim().min(10, 'Décrivez votre besoin en quelques mots').max(2000),
  customization: customizationSchema.optional(),
  mockupUrl: uploadedUrl,
  logoUrl: uploadedUrl,
  /** Champ piège anti-spam : doit rester vide. */
  website: z.string().max(0).optional(),
})

export type QuoteRequestInput = z.input<typeof quoteRequestSchema>
export type QuoteRequest = z.output<typeof quoteRequestSchema>

export const QUOTE_STATUSES = ['nouveau', 'en_cours', 'traite'] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

export interface QuoteRecord extends Omit<QuoteRequest, 'website'> {
  id: string
  status: QuoteStatus
  createdAt: string
}
