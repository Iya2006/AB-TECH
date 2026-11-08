/**
 * Catalogue des prestations du client.
 * Source unique : l'API l'insère en base (seed) et le site s'en sert en secours
 * si l'API ne répond pas.
 */

export type ServiceDomain = 'print' | 'tech'

export interface Service {
  slug: string
  domain: ServiceDomain
  title: string
  summary: string
  highlights: string[]
  sortOrder: number
}

export const SERVICES: Service[] = [
  {
    slug: 'creation-graphique',
    domain: 'print',
    title: 'Création graphique & logos',
    summary:
      "Nous dessinons l'identité de votre marque : logo, couleurs, typographies et déclinaisons prêtes à imprimer.",
    highlights: ['Conception de logo', 'Charte graphique', 'Déclinaisons print & digital'],
    sortOrder: 1,
  },
  {
    slug: 'affiches-flyers',
    domain: 'print',
    title: 'Affiches & flyers',
    summary:
      'Affiches publicitaires et flyers imprimés avec des couleurs fidèles, du petit tirage à la grande série.',
    highlights: ['Affiches publicitaires', 'Flyers & dépliants', 'Tous formats'],
    sortOrder: 2,
  },
  {
    slug: 'cartes-de-visite',
    domain: 'print',
    title: 'Cartes de visite & supports pro',
    summary:
      'Cartes de visite, en-têtes, chemises et documents professionnels qui renforcent votre crédibilité.',
    highlights: ['Cartes de visite', 'Papeterie d’entreprise', 'Supports professionnels'],
    sortOrder: 3,
  },
  {
    slug: 'impression-photo',
    domain: 'print',
    title: 'Impression de photos',
    summary: 'Vos souvenirs et vos visuels tirés avec soin, prêts à encadrer ou à offrir.',
    highlights: ['Tirages photo', 'Portraits', 'Grands formats'],
    sortOrder: 4,
  },
  {
    slug: 'textile',
    domain: 'print',
    title: 'T-shirts & polos personnalisés',
    summary:
      'Vos T-shirts et polos à vos couleurs, pour vos équipes, vos événements ou votre boutique.',
    highlights: ['T-shirts', 'Polos', 'Tenues d’équipe'],
    sortOrder: 5,
  },
  {
    slug: 'casquettes',
    domain: 'print',
    title: 'Casquettes personnalisées',
    summary: 'Des casquettes marquées à votre image, pour vos équipes comme pour vos clients.',
    highlights: ['Casquettes', 'Marquage logo', 'Séries événementielles'],
    sortOrder: 6,
  },
  {
    slug: 'sacs-accessoires',
    domain: 'print',
    title: 'Sacs & accessoires',
    summary: 'Tote bags, sacs et accessoires imprimés qui font voyager votre marque.',
    highlights: ['Tote bags', 'Sacs', 'Accessoires'],
    sortOrder: 7,
  },
  {
    slug: 'objets-cadeaux',
    domain: 'print',
    title: 'Objets & cadeaux personnalisés',
    summary: 'Mugs, gourdes, coffrets : des cadeaux d’entreprise qui marquent les esprits.',
    highlights: ['Mugs', 'Gourdes', 'Coffrets cadeaux'],
    sortOrder: 8,
  },
  {
    slug: 'evenementiel',
    domain: 'print',
    title: 'Supports pour événements',
    summary:
      'Kakémonos, banderoles, photocalls et drapeaux pour donner de l’impact à vos événements.',
    highlights: ['Kakémonos & roll-ups', 'Photocalls', 'Banderoles & drapeaux'],
    sortOrder: 9,
  },
  {
    slug: 'informatique',
    domain: 'tech',
    title: 'Ordinateurs & accessoires',
    summary:
      'Vente d’équipement informatique et électronique : ordinateurs, périphériques et accessoires.',
    highlights: ['Ordinateurs portables & fixes', 'Accessoires', 'Équipement électronique'],
    sortOrder: 10,
  },
  {
    slug: 'videosurveillance',
    domain: 'tech',
    title: 'Vidéosurveillance',
    summary:
      'Installation de caméras et d’enregistreurs, avec consultation à distance sur ordinateur et smartphone.',
    highlights: ['Caméras dôme & bullet', 'Enregistreurs', 'Vision à distance'],
    sortOrder: 11,
  },
  {
    slug: 'controle-acces',
    domain: 'tech',
    title: 'Contrôle d’accès & portiques',
    summary: 'Lecteurs de badges, claviers à code et portiques pour maîtriser qui entre et quand.',
    highlights: ['Badges & codes', 'Portiques', 'Gestion des accès'],
    sortOrder: 12,
  },
  {
    slug: 'securite-incendie',
    domain: 'tech',
    title: 'Détection de fumée & extinction automatique',
    summary: 'Détecteurs de fumée et systèmes d’extinction automatique pour protéger vos locaux.',
    highlights: ['Détection de fumée', 'Extinction automatique', 'Mise en service'],
    sortOrder: 13,
  },
  {
    slug: 'reseau-telephonie',
    domain: 'tech',
    title: 'Câblage informatique & téléphonie IP',
    summary: 'Câblage réseau, baies de brassage et téléphonie sur IP pour des bureaux connectés.',
    highlights: ['Câblage réseau', 'Baies de brassage', 'Téléphonie sur IP'],
    sortOrder: 14,
  },
]

export const SERVICE_SLUGS = SERVICES.map((s) => s.slug) as [string, ...string[]]
