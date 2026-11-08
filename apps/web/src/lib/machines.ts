import type { StationSlug } from '@atelier/shared'

/**
 * Les équipements de l'atelier 3D, présentés au clic. Textes volontairement concrets et sans caractéristiques
 * inventées (pas de marque, de vitesse ni de format chiffré) : ce que la machine fabrique pour le client.
 */
export type MachineId = 'grand-format' | 'decoupe' | 'copieur' | 'massicot' | 'presse-chaud' | 'carrousel' | 'poste-creation' | 'baie-reseau' | 'videosurveillance'

export interface Machine {
  name: string
  kicker: string
  station: StationSlug
  /** Prestation pré-sélectionnée dans le devis. */
  service: string
  text: string
  /** Ce qu'on fabrique avec, pour le client. */
  makes: string[]
  /** Couleurs de l'illustration de la fiche. */
  from: string
  to: string
}

export const MACHINES: Record<MachineId, Machine> = {
  'poste-creation': {
    name: 'Poste de création graphique',
    kicker: 'Studio création',
    station: 'creation',
    service: 'creation-graphique',
    text: 'Votre logo et votre identité visuelle naissent ici : recherches, déclinaisons, puis fichiers prêts pour l’impression, le textile et le web.',
    makes: ['Logos', 'Chartes graphiques', 'Maquettes de flyers et d’affiches', 'Fichiers prêts à imprimer'],
    from: '#1d3b8f',
    to: '#22b8f0',
  },
  'grand-format': {
    name: 'Imprimante grand format',
    kicker: 'Atelier impression',
    station: 'impression',
    service: 'affiches-flyers',
    text: 'Elle imprime au rouleau, en couleurs fidèles : vos affiches, bâches et visuels d’événement sortent prêts à poser.',
    makes: ['Affiches', 'Bâches', 'Kakémonos et roll-up', 'Adhésifs et vitrophanie'],
    from: '#0e7490',
    to: '#22d3ee',
  },
  decoupe: {
    name: 'Plotter de découpe',
    kicker: 'Atelier impression',
    station: 'impression',
    service: 'affiches-flyers',
    text: 'Une lame suit le tracé de votre logo dans l’adhésif ou le flex : lettrages de vitrine, véhicules, et marquage textile.',
    makes: ['Lettrage adhésif', 'Vitrophanie', 'Flex pour textile', 'Autocollants découpés'],
    from: '#7c3aed',
    to: '#e5007d',
  },
  copieur: {
    name: 'Presse numérique',
    kicker: 'Atelier impression',
    station: 'impression',
    service: 'cartes-de-visite',
    text: 'Pour les tirages courts et moyens : cartes de visite, flyers et documents, imprimés rapidement avec un rendu net.',
    makes: ['Cartes de visite', 'Flyers', 'Brochures', 'Documents professionnels'],
    from: '#1e293b',
    to: '#2563eb',
  },
  massicot: {
    name: 'Massicot',
    kicker: 'Finitions',
    station: 'impression',
    service: 'affiches-flyers',
    text: 'La coupe au millimètre qui fait la différence : vos cartes et flyers sont rectifiés pour un résultat propre et régulier.',
    makes: ['Coupe des cartes de visite', 'Mise au format des flyers', 'Finitions'],
    from: '#991b1b',
    to: '#f97316',
  },
  'presse-chaud': {
    name: 'Presse à chaud',
    kicker: 'Personnalisation textile',
    station: 'textile',
    service: 'textile',
    text: 'Chaleur et pression fixent votre marquage sur le tissu : idéal pour les petites séries, les noms et les numéros.',
    makes: ['T-shirts et polos', 'Flocage de noms et numéros', 'Tenues d’équipe'],
    from: '#9a3412',
    to: '#fbbf24',
  },
  carrousel: {
    name: 'Carrousel de sérigraphie',
    kicker: 'Personnalisation textile',
    station: 'textile',
    service: 'textile',
    text: 'Une couleur par écran, posées tour à tour : la sérigraphie donne des aplats francs et résistants, parfaite pour les séries.',
    makes: ['Séries de T-shirts', 'Tenues d’événement', 'Textiles promotionnels'],
    from: '#0f172a',
    to: '#e5007d',
  },
  'baie-reseau': {
    name: 'Baie réseau',
    kicker: 'Informatique',
    station: 'informatique',
    service: 'reseau-telephonie',
    text: 'Le cœur du réseau d’une entreprise : câblage, commutateurs et téléphonie IP, installés et mis en service.',
    makes: ['Câblage réseau', 'Wi-Fi professionnel', 'Téléphonie IP'],
    from: '#0f172a',
    to: '#0ea5e9',
  },
  videosurveillance: {
    name: 'Système de vidéosurveillance',
    kicker: 'Sécurité',
    station: 'securite',
    service: 'videosurveillance',
    text: 'Caméras, enregistreur et écran de contrôle : nous étudions vos lieux, installons et paramétrons tout.',
    makes: ['Caméras intérieures et extérieures', 'Enregistrement et consultation à distance', 'Maintenance'],
    from: '#111827',
    to: '#dc2626',
  },
}
