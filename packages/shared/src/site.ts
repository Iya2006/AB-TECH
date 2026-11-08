import { z } from 'zod'
import { SERVICE_SLUGS } from './catalog'

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide')

/** Image hébergée chez nous (/uploads, /media) ou en HTTPS (Cloudinary…). */
export const imageUrl = z
  .string()
  .trim()
  .max(600)
  .refine((v) => /^(https:\/\/|\/uploads\/|\/media\/)/.test(v), 'Adresse d’image invalide')

const honeypot = z.string().max(0).optional()

/* ------------------------------------------------------------------ */
/* Paramètres du site (modifiables dans l'espace pro)                 */
/* ------------------------------------------------------------------ */

/** En-tête d'une section de la page (sur-titre, titre en deux lignes, texte). */
const sectionTextSchema = z.object({
  kicker: z.string().trim().max(40),
  title: z.tuple([z.string().trim().max(50), z.string().trim().max(50)]),
  text: z.string().trim().max(320),
})
export type SectionText = z.infer<typeof sectionTextSchema>
export const SECTION_IDS = ['portant', 'boutique', 'studio', 'avis', 'methode', 'prestations', 'devis', 'contact'] as const
export type SectionId = (typeof SECTION_IDS)[number]

/** Fiche d'un équipement de l'atelier (présentée au clic) : remplace le texte par défaut. */
const machineTextSchema = z.object({
  name: z.string().trim().max(60),
  text: z.string().trim().max(300),
  makes: z.array(z.string().trim().max(60)).max(6),
})
export type MachineText = z.infer<typeof machineTextSchema>

export const siteSettingsSchema = z.object({
  name: z.string().trim().min(2).max(40),
  /** Le nom en deux parties : la seconde passe en italique. */
  nameParts: z.tuple([z.string().max(30), z.string().max(30)]),
  tagline: z.string().trim().max(80),
  heroTitle: z.tuple([z.string().max(60), z.string().max(60)]),
  heroText: z.string().trim().max(240),
  phones: z.array(z.string().trim().max(25)).max(4),
  /** Indicatif sans « + » (ex. 237) — requis pour les liens WhatsApp. */
  whatsappCountryCode: z.string().regex(/^\d{0,4}$/, 'Chiffres uniquement'),
  email: z.union([z.literal(''), z.email()]),
  address: z.string().trim().max(160),
  hours: z.string().trim().max(80),
  /** Libellé de la devise affichée (ex. FCFA, GNF). Vide : « Prix sur demande ». */
  currency: z.string().trim().max(10),
  socials: z.object({
    facebook: z.string().trim().max(200),
    instagram: z.string().trim().max(200),
    tiktok: z.string().trim().max(200),
  }),
  /** Logo de l'entreprise (barre du site, pied de page, écran de chargement). Vide : symbole + nom. */
  logo: z.union([z.literal(''), imageUrl]),
  /** Message d'accueil affiché en entrant dans l'atelier. */
  welcome: z.object({
    title: z.tuple([z.string().trim().max(40), z.string().trim().max(40)]),
    text: z.string().trim().max(260),
  }),
  /** Textes des sections de la page (portant, boutique, studio…). */
  sections: z.object({
    portant: sectionTextSchema,
    boutique: sectionTextSchema,
    studio: sectionTextSchema,
    avis: sectionTextSchema,
    methode: sectionTextSchema,
    prestations: sectionTextSchema,
    devis: sectionTextSchema,
    contact: sectionTextSchema,
  }),
  /** Fiches des machines modifiées dans l'espace pro (les autres gardent leur texte par défaut). */
  machines: z.record(z.string().trim().max(30), machineTextSchema),
  /** Ce que montre l'atelier 3D, choisi dans l'espace pro. Vide : les visuels générés aux couleurs de la marque. */
  display: z.object({
    /** Photo (ou visuel) de l'enseigne réelle, posée sur le bandeau de la façade. */
    sign: z.union([z.literal(''), imageUrl]),
    /** Images de l'écran de la vitrine (promotions, flyers…) : elles défilent. */
    screen: z.array(imageUrl).max(8),
    /** Grandes affiches de l'atelier : mur de l'impression et kakémonos de l'événementiel. */
    posters: z.array(imageUrl).max(12),
    /** Fond du photocall (événementiel). */
    photocall: z.union([z.literal(''), imageUrl]),
  }),
})
export type SiteSettings = z.infer<typeof siteSettingsSchema>

export const DEFAULT_SETTINGS: SiteSettings = {
  name: 'AB-TECH',
  nameParts: ['AB-', 'TECH'],
  tagline: 'Impression · Branding · Tech',
  heroTitle: ['L’atelier où votre', 'marque prend forme.'],
  heroText: 'Impression, branding, personnalisation — et solutions informatiques & sécurité. Poussez la porte.',
  phones: ['620 28 46 87', '613 07 10 07'],
  whatsappCountryCode: '',
  email: 'abinfotech95@gmail.com',
  address: '',
  hours: '',
  currency: '',
  socials: { facebook: '', instagram: '', tiktok: '' },
  logo: '',
  welcome: {
    title: ['Bienvenue', 'dans notre atelier.'],
    text: 'Impression, branding, personnalisation textile et solutions informatiques : sept postes de travail, une seule équipe pour donner forme à votre marque.',
  },
  sections: {
    portant: {
      kicker: 'Le portant',
      title: ['Faites défiler', 'le portant.'],
      text: 'Survolez une pièce pour la tourner vers vous, faites glisser le portant, cliquez pour la décrocher et la voir en grand. Chaque pièce se personnalise à votre logo.',
    },
    boutique: { kicker: 'La boutique', title: ['Choisissez,', 'on s’occupe du reste.'], text: '' },
    studio: {
      kicker: 'Studio — essai en direct',
      title: ['Essayez votre marque', 'en direct.'],
      text: 'De vrais vêtements, portés par de vraies personnes. Importez votre logo, écrivez votre texte, placez-le où vous voulez : le marquage suit les plis du tissu. Joignez la maquette à votre devis, nous préparons le bon à tirer.',
    },
    avis: { kicker: 'Avis clients', title: ['Ils nous ont', 'fait confiance.'], text: '' },
    methode: {
      kicker: 'Notre méthode',
      title: ['De l’idée à l’objet,', 'sans détour.'],
      text: 'Quatre étapes, un seul interlocuteur : du premier message à la remise de votre commande.',
    },
    prestations: {
      kicker: '',
      title: ['Tout ce que nous', 'faisons pour vous.'],
      text: 'Un interlocuteur unique pour votre image de marque et pour l’équipement de vos locaux.',
    },
    devis: {
      kicker: 'Devis gratuit',
      title: ['Parlons de', 'votre projet.'],
      text: 'Décrivez votre besoin en quelques lignes. Nous revenons vers vous avec une proposition claire.',
    },
    contact: { kicker: 'Contact', title: ['Une idée, un projet ?', 'Appelez-nous.'], text: '' },
  },
  machines: {},
  display: { sign: '', screen: [], posters: [], photocall: '' },
}

/* ------------------------------------------------------------------ */
/* Postes de l'atelier                                                 */
/* ------------------------------------------------------------------ */

export const STATION_SLUGS = [
  'creation',
  'impression',
  'textile',
  'objets',
  'evenementiel',
  'informatique',
  'securite',
] as const
export type StationSlug = (typeof STATION_SLUGS)[number]

export const stationContentSchema = z.object({
  kicker: z.string().trim().max(40),
  title: z.tuple([z.string().trim().min(1).max(40), z.string().trim().max(40)]),
  body: z.string().trim().max(400),
  tags: z.array(z.string().trim().min(1).max(30)).max(8),
  service: z.enum(SERVICE_SLUGS),
})
export type StationContent = z.infer<typeof stationContentSchema> & { slug: StationSlug }

export const DEFAULT_STATIONS: StationContent[] = [
  {
    slug: 'creation',
    kicker: 'Studio création',
    title: ['Création graphique', '& logos.'],
    body: "Tout commence par une idée. Nous dessinons votre logo et l'identité visuelle de votre marque, prête à être imprimée partout.",
    tags: ['Conception de logo', 'Identité visuelle', 'Charte graphique'],
    service: 'creation-graphique',
  },
  {
    slug: 'impression',
    kicker: 'Atelier impression',
    title: ['L’impression,', 'à la couleur près.'],
    body: 'Affiches publicitaires, flyers, cartes de visite, supports professionnels et tirages photo : des couleurs fidèles, du petit tirage à la grande série.',
    tags: ['Affiches', 'Flyers', 'Cartes de visite', 'Supports pro', 'Photos'],
    service: 'affiches-flyers',
  },
  {
    slug: 'textile',
    kicker: 'Personnalisation textile',
    title: ['T-shirts, polos', '& casquettes.'],
    body: 'Habillez vos équipes, vos clients et vos événements à vos couleurs, à l’unité comme en série.',
    tags: ['T-shirts', 'Polos', 'Casquettes', 'Tenues d’équipe'],
    service: 'textile',
  },
  {
    slug: 'objets',
    kicker: 'Objets & cadeaux',
    title: ['Sacs, mugs', '& cadeaux à votre image.'],
    body: 'Tote bags, accessoires, mugs, gourdes, coffrets : des objets du quotidien qui font voyager votre marque.',
    tags: ['Sacs & accessoires', 'Mugs', 'Gourdes', 'Cadeaux d’entreprise'],
    service: 'objets-cadeaux',
  },
  {
    slug: 'evenementiel',
    kicker: 'Supports événementiels',
    title: ['Vos événements,', 'en grand.'],
    body: 'Kakémonos, photocalls, banderoles et drapeaux : tout pour être vu, du salon professionnel à la soirée de lancement.',
    tags: ['Kakémonos', 'Photocalls', 'Banderoles', 'Drapeaux'],
    service: 'evenementiel',
  },
  {
    slug: 'informatique',
    kicker: 'Boutique tech',
    title: ['Ordinateurs', '& accessoires.'],
    body: 'Ordinateurs portables et fixes, écrans, périphériques et accessoires : choisissez, ajoutez au panier, nous vous rappelons.',
    tags: ['Ordinateurs', 'Accessoires', 'Réseau', 'Électronique'],
    service: 'informatique',
  },
  {
    slug: 'securite',
    kicker: 'Sécurité',
    title: ['Surveiller, contrôler,', 'protéger.'],
    body: 'Installation de vidéosurveillance, contrôle d’accès et portiques, détection de fumée et extinction automatique, câblage informatique et téléphonie IP.',
    tags: ['Vidéosurveillance', 'Contrôle d’accès', 'Détection de fumée', 'Extinction auto.', 'Câblage', 'Téléphonie IP'],
    service: 'videosurveillance',
  },
]

/* ------------------------------------------------------------------ */
/* Réalisations (cadres au mur, catalogue)                            */
/* ------------------------------------------------------------------ */

export const realisationInputSchema = z.object({
  station: z.enum(STATION_SLUGS),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000),
  images: z.array(imageUrl).min(1, 'Ajoutez au moins une image').max(20),
  featured: z.boolean(),
  published: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
})
export type RealisationInput = z.infer<typeof realisationInputSchema>
export interface Realisation extends RealisationInput {
  id: string
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Produits (boutique, textile, objets…)                              */
/* ------------------------------------------------------------------ */

/** Forme utilisée pour présenter le produit dans l'atelier (photo réelle par défaut, ou modèle 3D). */
export const PRODUCT_MODELS = [
  'aucun',
  'tshirt',
  'polo',
  'sweat',
  'pull',
  'casquette',
  'snapback',
  'trucker',
  'mug',
  'tote',
  'gourde',
  'portable',
  'ecran',
  'tour',
  'clavier',
  'routeur',
  'camera-dome',
  'camera-bullet',
  'extincteur',
  'coffret',
  'boite',
] as const
export type ProductModel = (typeof PRODUCT_MODELS)[number]

export const STOCK_STATUSES = ['en_stock', 'sur_commande', 'rupture'] as const
export type StockStatus = (typeof STOCK_STATUSES)[number]

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  station: z.enum(STATION_SLUGS),
  category: z.string().trim().min(1).max(40),
  brand: z.string().trim().max(40),
  /** Prix en unités entières de la devise ; null = sur demande. */
  price: z.number().int().min(0).max(1_000_000_000).nullable(),
  description: z.string().trim().max(2000),
  specs: z.array(z.tuple([z.string().trim().min(1).max(40), z.string().trim().min(1).max(120)])).max(20),
  images: z.array(imageUrl).max(12),
  stock: z.enum(STOCK_STATUSES),
  featured: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  model: z.enum(PRODUCT_MODELS),
  color: hexColor,
  /** Visuel imprimé sur le modèle 3D (T-shirt, mug…), facultatif. */
  printImage: z.union([z.literal(''), imageUrl]),
})
export type ProductInput = z.infer<typeof productInputSchema>
export interface Product extends ProductInput {
  id: string
  slug: string
  rating: { average: number; count: number }
}

/* ------------------------------------------------------------------ */
/* Avis                                                                */
/* ------------------------------------------------------------------ */

export const REVIEW_STATUSES = ['en_attente', 'publie', 'masque'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const reviewInputSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(60),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5, 'Quelques mots de plus ?').max(1000),
  productId: z.uuid().optional(),
  website: honeypot,
})
export type ReviewInput = z.input<typeof reviewInputSchema>
export interface Review {
  id: string
  name: string
  rating: number
  comment: string
  productId: string | null
  status: ReviewStatus
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

export const ORDER_STATUSES = ['nouvelle', 'confirmee', 'livree', 'annulee'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const orderInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Indiquez votre nom').max(120),
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
  address: z.string().trim().max(240).optional(),
  message: z.string().trim().max(1000).optional(),
  items: z
    .array(z.object({ productId: z.uuid(), qty: z.number().int().min(1).max(999) }))
    .min(1, 'Votre panier est vide')
    .max(50),
  website: honeypot,
})
export type OrderInput = z.input<typeof orderInputSchema>
export interface OrderItem {
  productId: string
  name: string
  price: number | null
  qty: number
}
export interface Order {
  id: string
  status: OrderStatus
  fullName: string
  phone: string
  email: string | null
  address: string | null
  message: string | null
  items: OrderItem[]
  total: number | null
  createdAt: string
}

/* ------------------------------------------------------------------ */
/* Administration (connexion et comptes : voir auth.ts)                */
/* ------------------------------------------------------------------ */

/** Tout ce dont le site public a besoin, en un seul appel. */
export interface SiteData {
  settings: SiteSettings
  stations: StationContent[]
  realisations: Realisation[]
  products: Product[]
}

export interface AdminStats {
  quotes: { total: number; nouveau: number }
  orders: { total: number; nouvelle: number }
  reviews: { total: number; enAttente: number; moyenne: number }
  products: { total: number; actifs: number }
  realisations: number
  /** Comptes clients : total, et créés ces 30 derniers jours. */
  clients: { total: number; nouveaux: number }
  /** Activité des 14 derniers jours (date ISO → nombre). */
  activity: Array<{ date: string; quotes: number; orders: number }>
}
