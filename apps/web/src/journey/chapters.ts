/**
 * Le parcours dans l'atelier : trajectoire de la caméra et chapitres affichés.
 * `t` / `range` sont exprimés en progression de scroll (0 = la rue, 1 = vue aérienne).
 */

export type Vec3 = [number, number, number]

export interface CameraKey {
  t: number
  pos: Vec3
  look: Vec3
}

export const CAMERA_KEYS: CameraKey[] = [
  // La rue, face à l'atelier : on voit le bâtiment entier (toit compris), puis on s'approche
  { t: 0.0, pos: [0, 4.4, 21], look: [0, 3.7, 0] },
  { t: 0.05, pos: [0, 2.3, 11], look: [0, 2.6, 0] },
  // Les portes s'ouvrent, on entre
  { t: 0.11, pos: [0, 1.75, 2.6], look: [0, 1.75, -3] },
  { t: 0.15, pos: [0, 1.8, -3.2], look: [0, 1.9, -14] },
  { t: 0.2, pos: [0, 1.85, -4.2], look: [0, 2.0, -16] },
  // 01 Création
  { t: 0.24, pos: [-0.6, 1.9, -5.4], look: [-6.6, 1.75, -9.8] },
  { t: 0.3, pos: [-1.0, 1.8, -6.2], look: [-6.9, 1.7, -9.8] },
  // 02 Impression
  { t: 0.35, pos: [0.9, 1.9, -12.6], look: [6.6, 1.8, -18.0] },
  { t: 0.41, pos: [1.3, 1.8, -13.6], look: [6.9, 1.75, -18.3] },
  // 03 Textile : face au portant (le panneau de texte est à droite)
  { t: 0.46, pos: [-1.4, 1.75, -23.5], look: [-5.0, 1.5, -25.9] },
  { t: 0.52, pos: [-2.15, 1.62, -23.8], look: [-4.9, 1.42, -25.98] },
  // 04 Objets
  { t: 0.57, pos: [2.2, 1.65, -32.0], look: [6.2, 1.05, -36.3] },
  { t: 0.63, pos: [2.5, 1.55, -32.7], look: [6.3, 1.0, -36.5] },
  // 05 Événementiel
  { t: 0.68, pos: [1.2, 1.8, -39.6], look: [-6.8, 1.6, -44.2] },
  { t: 0.735, pos: [0.9, 1.75, -40.4], look: [-7.0, 1.55, -44.3] },
  // Passage vers l'Espace Tech
  { t: 0.775, pos: [0, 1.75, -46.5], look: [0, 1.9, -56] },
  // 06 Informatique
  { t: 0.81, pos: [-0.6, 1.7, -51.6], look: [-6.6, 1.0, -56.1] },
  { t: 0.85, pos: [-0.9, 1.65, -52.3], look: [-6.7, 1.0, -56.2] },
  // 07 Sécurité
  { t: 0.885, pos: [-1.0, 1.85, -57.4], look: [7.4, 2.0, -65.0] },
  { t: 0.925, pos: [-0.7, 1.85, -58.1], look: [7.6, 1.95, -65.3] },
  // Vue d'ensemble
  { t: 1.0, pos: [15, 17, -10], look: [0, 0, -38] },
]

export type ChapterKind = 'hero' | 'welcome' | 'station' | 'final'

export interface Chapter {
  id: string
  kind: ChapterKind
  range: [number, number]
  theme: 'light' | 'dark'
  /** Côté où s'affiche le panneau (à l'opposé du poste regardé). */
  side: 'left' | 'right' | 'center'
  nav: string
  number?: string
  kicker?: string
  title: [string, string]
  body?: string
  tags?: string[]
  /** Prestation pré-sélectionnée dans le devis. */
  service?: string
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'facade',
    kind: 'hero',
    range: [0, 0.058],
    theme: 'dark',
    side: 'left',
    nav: 'L’atelier',
    title: ['L’atelier où votre', 'marque prend forme.'],
    body: 'Impression, branding, personnalisation — et solutions informatiques & sécurité. Poussez la porte.',
  },
  {
    id: 'bienvenue',
    kind: 'welcome',
    range: [0.148, 0.215],
    theme: 'light',
    side: 'center',
    nav: 'Bienvenue',
    title: ['dans notre', 'atelier.'],
    body: 'Chaque poste est un savoir-faire. Suivez le guide.',
  },
  {
    id: 'creation',
    kind: 'station',
    range: [0.235, 0.31],
    theme: 'light',
    side: 'right',
    nav: 'Création',
    number: '01',
    kicker: 'Studio création',
    title: ['Création graphique', '& logos.'],
    body: "Tout commence par une idée. Nous dessinons votre logo et l'identité visuelle de votre marque, prête à être imprimée partout.",
    tags: ['Conception de logo', 'Identité visuelle', 'Charte graphique'],
    service: 'creation-graphique',
  },
  {
    id: 'impression',
    kind: 'station',
    range: [0.345, 0.42],
    theme: 'light',
    side: 'left',
    nav: 'Impression',
    number: '02',
    kicker: 'Atelier impression',
    title: ['L’impression,', 'à la couleur près.'],
    body: 'Affiches publicitaires, flyers, cartes de visite, supports professionnels et tirages photo : des couleurs fidèles, du petit tirage à la grande série.',
    tags: ['Affiches', 'Flyers', 'Cartes de visite', 'Supports pro', 'Photos'],
    service: 'affiches-flyers',
  },
  {
    id: 'textile',
    kind: 'station',
    range: [0.455, 0.53],
    theme: 'light',
    side: 'right',
    nav: 'Textile',
    number: '03',
    kicker: 'Personnalisation textile',
    title: ['T-shirts, polos', '& casquettes.'],
    body: 'Habillez vos équipes, vos clients et vos événements à vos couleurs, à l’unité comme en série.',
    tags: ['T-shirts', 'Polos', 'Casquettes', 'Tenues d’équipe'],
    service: 'textile',
  },
  {
    id: 'objets',
    kind: 'station',
    range: [0.565, 0.64],
    theme: 'light',
    side: 'left',
    nav: 'Objets',
    number: '04',
    kicker: 'Objets & cadeaux',
    title: ['Sacs, mugs', '& cadeaux à votre image.'],
    body: 'Tote bags, accessoires, mugs, gourdes, coffrets : des objets du quotidien qui font voyager votre marque.',
    tags: ['Sacs & accessoires', 'Mugs', 'Gourdes', 'Cadeaux d’entreprise'],
    service: 'objets-cadeaux',
  },
  {
    id: 'evenementiel',
    kind: 'station',
    range: [0.675, 0.745],
    theme: 'light',
    side: 'right',
    nav: 'Événementiel',
    number: '05',
    kicker: 'Supports événementiels',
    title: ['Vos événements,', 'en grand.'],
    body: 'Kakémonos, photocalls, banderoles et drapeaux : tout pour être vu, du salon professionnel à la soirée de lancement.',
    tags: ['Kakémonos', 'Photocalls', 'Banderoles', 'Drapeaux'],
    service: 'evenementiel',
  },
  {
    id: 'informatique',
    kind: 'station',
    range: [0.805, 0.86],
    theme: 'light',
    side: 'right',
    nav: 'Informatique',
    number: '06',
    kicker: 'Espace Tech',
    title: ['Ordinateurs', '& accessoires.'],
    body: 'Vente d’équipement informatique et électronique : ordinateurs portables et fixes, périphériques, accessoires.',
    tags: ['Ordinateurs', 'Accessoires', 'Électronique'],
    service: 'informatique',
  },
  {
    id: 'securite',
    kind: 'station',
    range: [0.88, 0.94],
    theme: 'light',
    side: 'left',
    nav: 'Sécurité',
    number: '07',
    kicker: 'Espace Tech',
    title: ['Surveiller, contrôler,', 'protéger.'],
    body: 'Installation de vidéosurveillance, contrôle d’accès et portiques, détection de fumée et extinction automatique, câblage informatique et téléphonie IP.',
    tags: ['Vidéosurveillance', 'Contrôle d’accès', 'Détection de fumée', 'Extinction auto.', 'Câblage', 'Téléphonie IP'],
    service: 'videosurveillance',
  },
  {
    id: 'final',
    kind: 'final',
    range: [0.968, 1.0001],
    theme: 'dark',
    side: 'center',
    nav: 'Votre projet',
    title: ['Un seul atelier.', 'Toutes vos idées.'],
  },
]

/** Position de scroll où « s'arrêter » pour lire un chapitre. */
export const chapterAnchor = (c: Chapter) =>
  c.kind === 'hero' ? 0 : c.kind === 'final' ? 1 : (c.range[0] + c.range[1]) / 2

export function chapterAt(progress: number) {
  return CHAPTERS.findIndex((c) => progress >= c.range[0] && progress < c.range[1])
}

/** Dernier chapitre atteint (pour l'indicateur de navigation, même entre deux postes). */
export function lastChapterAt(progress: number) {
  let idx = 0
  CHAPTERS.forEach((c, i) => {
    if (progress >= c.range[0] - 0.03) idx = i
  })
  return idx
}

/** Ambiance lumineuse de la scène selon la progression. */
export function themeAt(progress: number): 'night' | 'atelier' | 'tech' | 'overview' {
  if (progress < 0.115) return 'night'
  if (progress < 0.765) return 'atelier'
  if (progress < 0.95) return 'tech'
  return 'overview'
}
