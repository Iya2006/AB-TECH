import {
  DEFAULT_SETTINGS,
  DEFAULT_STATIONS,
  SERVICES,
  type ProductInput,
  type RealisationInput,
} from '@atelier/shared'
import { count, eq, inArray, sql } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'
import { hashPassword, verifyPassword } from '../auth'
import { createDb, type Db } from './client'
import { products, realisations, services, sessions, settings, stations, users } from './schema'
import { slugify } from './slug'

/** Catalogue des prestations : toujours aligné sur le code (upsert). */
export async function seedServices(db: Db) {
  await db
    .insert(services)
    .values(SERVICES.map(({ slug, domain, title, summary, highlights, sortOrder }) => ({ slug, domain, title, summary, highlights, sortOrder })))
    .onConflictDoUpdate({
      target: services.slug,
      set: {
        domain: sql`excluded.domain`,
        title: sql`excluded.title`,
        summary: sql`excluded.summary`,
        highlights: sql`excluded.highlights`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: sql`now()`,
      },
    })
}

/** Contenus modifiables : insérés une seule fois, jamais écrasés ensuite. */
async function seedContent(db: Db) {
  await db.insert(settings).values({ key: 'site', value: DEFAULT_SETTINGS }).onConflictDoNothing()
  await db
    .insert(stations)
    .values(DEFAULT_STATIONS.map(({ slug, kicker, title, body, tags, service }) => ({ slug, kicker, title, body, tags, service })))
    .onConflictDoNothing()
}

/**
 * Administrateur initial, créé une seule fois à la mise en production à partir de ADMIN_EMAIL / ADMIN_PASSWORD.
 * - Son mot de passe est temporaire : changement obligatoire à la première connexion.
 * - S'il existe déjà un administrateur, rien n'est créé ni réinitialisé.
 * - Tant qu'un administrateur garde le mot de passe du fichier .env, il est de nouveau obligé de le changer :
 *   ce mot de passe, connu de la personne qui a installé le site, n'ouvre jamais durablement l'administration.
 */
async function seedAdmin(db: Db, email: string | undefined, password: string | undefined) {
  const admins = await db.select().from(users).where(eq(users.role, 'admin'))
  if (admins.length) {
    if (!password) return
    for (const a of admins) {
      if (!a.mustChangePassword && a.passwordHash && (await verifyPassword(password, a.passwordHash))) {
        await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, a.id))
        console.log(`Administrateur ${a.email} : mot de passe initial encore utilisé, changement demandé à la prochaine connexion.`)
      }
    }
    return
  }
  if (!email || !password) {
    console.warn('Aucun administrateur : définissez ADMIN_EMAIL et ADMIN_PASSWORD pour créer le compte initial.')
    return
  }
  const lower = email.toLowerCase()
  const values = { role: 'admin' as const, passwordHash: await hashPassword(password), mustChangePassword: true, emailVerified: true, updatedAt: new Date() }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, lower))
  if (existing) {
    await db.update(users).set(values).where(eq(users.id, existing.id))
    await db.delete(sessions).where(eq(sessions.userId, existing.id))
  } else {
    await db.insert(users).values({ email: lower, name: 'Administrateur', ...values })
  }
  console.log(`Administrateur initial créé : ${lower} (mot de passe temporaire, à changer à la première connexion).`)
}

const P = (p: Partial<ProductInput> & Pick<ProductInput, 'name' | 'station' | 'category' | 'model'>): ProductInput => ({
  brand: '',
  price: null,
  description: '',
  specs: [],
  images: [],
  stock: 'en_stock',
  featured: false,
  active: true,
  sortOrder: 0,
  color: '#f4f1ea',
  printImage: '',
  ...p,
})

const img = (file: string) => [`/media/catalogue/${file}.webp`]
const textile = (name: string, category: string, model: ProductInput['model'], color: string, file: string, extra: Partial<ProductInput> = {}) =>
  P({ name, station: 'textile', category, model, color, images: img(file), stock: 'sur_commande', ...extra })
const objet = (name: string, category: string, model: ProductInput['model'], color: string, file: string, extra: Partial<ProductInput> = {}) =>
  P({ name, station: 'objets', category, model, color, images: img(file), stock: 'sur_commande', ...extra })

/**
 * Exemples génériques pour la démo (sans marque ni prix), avec de vraies photos de produits :
 * à remplacer depuis l'espace pro par les articles et photos de l'atelier.
 */
const DEMO_PRODUCTS: ProductInput[] = [
  P({ name: 'Ordinateur portable 13"', station: 'informatique', category: 'Ordinateurs', model: 'portable', color: '#c9ccd1', images: img('portable'), featured: true, description: 'Léger et autonome, pour travailler partout.', specs: [['Écran', '13 pouces'], ['Stockage', 'SSD']] }),
  P({ name: 'Écran incurvé 34"', station: 'informatique', category: 'Écrans', model: 'ecran', color: '#1b1b1f', images: img('ecran'), description: 'Grand écran incurvé pour le bureau, le montage et le jeu.' }),
  P({ name: 'Unité centrale', station: 'informatique', category: 'Ordinateurs', model: 'tour', color: '#1b1b1f', images: img('tour'), description: 'Poste fixe fiable pour l’entreprise.' }),
  P({ name: 'Clavier & souris sans fil', station: 'informatique', category: 'Accessoires', model: 'clavier', color: '#1b1b1f', images: img('clavier'), description: 'Ensemble sans fil silencieux.' }),
  P({ name: 'Casque audio sans fil', station: 'informatique', category: 'Audio', model: 'boite', color: '#1b1b1f', images: img('casque'), description: 'Casque à réduction de bruit, pour le bureau et les appels.' }),
  P({ name: 'Routeur Wi-Fi double bande', station: 'informatique', category: 'Réseau', model: 'routeur', color: '#f2f2f2', description: 'Couverture Wi-Fi stable pour la maison et le bureau.' }),
  P({ name: 'Disque SSD 512 Go', station: 'informatique', category: 'Stockage', model: 'boite', color: '#1d4ed8', description: 'Redonnez de la vitesse à votre ordinateur.' }),
  P({ name: 'Onduleur 1000 VA', station: 'informatique', category: 'Énergie', model: 'boite', color: '#2b2d31', description: 'Protège vos équipements des coupures de courant.' }),
  P({ name: 'Caméra IP dôme motorisée', station: 'securite', category: 'Vidéosurveillance', model: 'camera-dome', color: '#f4f4f4', images: img('camera-dome'), featured: true, description: 'Caméra dôme orientable pour couvrir de grands espaces, vision de nuit.' }),
  P({ name: 'Caméra bullet extérieure', station: 'securite', category: 'Vidéosurveillance', model: 'camera-bullet', color: '#f4f4f4', images: img('camera-bullet'), description: 'Caméra étanche pour l’extérieur.' }),
  P({ name: 'Caméra Wi-Fi intérieure', station: 'securite', category: 'Vidéosurveillance', model: 'camera-dome', color: '#f4f4f4', images: img('camera-wifi'), description: 'Caméra connectée pour la maison et les petits commerces, consultable sur smartphone.' }),
  P({ name: 'Extincteur 6 kg', station: 'securite', category: 'Incendie', model: 'extincteur', color: '#c81e1e', images: img('extincteur'), description: 'Extincteur à poudre polyvalent.' }),
  textile('T-shirt coton blanc', 'T-shirts', 'tshirt', '#f5f3ee', 'tshirt', { featured: true, description: 'T-shirt 100 % coton, imprimé ou brodé à votre image.' }),
  textile('T-shirt coton noir', 'T-shirts', 'tshirt', '#17171a', 'tshirt-noir'),
  textile('T-shirt bleu roi', 'T-shirts', 'tshirt', '#2563eb', 'tshirt-bleu'),
  textile('Sweat à capuche blanc', 'Sweats', 'sweat', '#f5f3ee', 'sweat', { featured: true, description: 'Sweat molletonné à capuche, poche kangourou.' }),
  textile('T-shirt sable', 'T-shirts', 'tshirt', '#d9c9a8', 'tshirt-sable'),
  textile('Polo piqué bleu marine', 'Polos', 'polo', '#1f2a44', 'polo-marine', { description: 'Polo piqué, logo brodé côté cœur.' }),
  textile('Sweat à capuche noir', 'Sweats', 'sweat', '#1b1b1f', 'sweat-noir'),
  textile('Pull col rond écru', 'Pulls', 'pull', '#f5f3ee', 'pull', { description: 'Pull molletonné col rond, coupe ample.' }),
  textile('T-shirt rouge', 'T-shirts', 'tshirt', '#b3262e', 'tshirt-rouge'),
  textile('Polo piqué blanc', 'Polos', 'polo', '#f5f3ee', 'polo'),
  textile('Sweat à capuche gris chiné', 'Sweats', 'sweat', '#9aa0a8', 'sweat-gris'),
  textile('Pull col rond vert forêt', 'Pulls', 'pull', '#2f5d50', 'pull-vert'),
  textile('Polo noir', 'Polos', 'polo', '#17171a', 'polo-noir'),
  textile('Pull col rond bleu marine', 'Pulls', 'pull', '#1f2a44', 'pull-marine'),
  textile('Casquette brodée noire', 'Casquettes', 'casquette', '#17171a', 'casquette-noir', { featured: true, description: 'Casquette 6 panneaux, visière courbée, logo brodé.' }),
  textile('Casquette classique blanche', 'Casquettes', 'casquette', '#f2efe8', 'casquette-blanc'),
  textile('Casquette visière plate', 'Casquettes', 'snapback', '#f5f3ee', 'snapback', { description: 'Snapback visière plate, fermeture réglable.' }),
  textile('Casquette trucker filet', 'Casquettes', 'trucker', '#f5f3ee', 'trucker', { description: 'Trucker : face avant en mousse, arrière en filet respirant.' }),
  textile('Casquette bleu marine', 'Casquettes', 'casquette', '#1f2a44', 'casquette-marine'),
  textile('Casquette visière plate noire', 'Casquettes', 'snapback', '#17171a', 'snapback-noir'),
  textile('Casquette jaune soleil', 'Casquettes', 'casquette', '#e9b22a', 'casquette'),
  textile('Casquette trucker bleu marine', 'Casquettes', 'trucker', '#1f2a44', 'trucker-marine'),
  objet('Mug céramique personnalisé', 'Mugs', 'mug', '#f7f5f0', 'mug', { featured: true }),
  objet('Tote bag coton naturel', 'Sacs', 'tote', '#ece3cf', 'tote'),
  objet('Gourde aluminium gravée', 'Gourdes', 'gourde', '#e8eaed', 'gourde'),
  objet('Coffret cadeau entreprise', 'Coffrets', 'coffret', '#c9a97c', 'coffret'),
  objet('Mug noir personnalisé', 'Mugs', 'mug', '#17171a', 'mug-noir'),
  objet('Tote bag noir', 'Sacs', 'tote', '#17171a', 'tote-noir'),
  objet('Gourde isotherme bleu marine', 'Gourdes', 'gourde', '#1d2b3a', 'gourde-marine'),
].map((p, i) => ({ ...p, sortOrder: i }))

/** Produits de démo des versions précédentes (sans photo) : remplacés s'ils n'ont pas été modifiés. */
const DEMO_VERSION = 3
const OLD_DEMO_NAMES = new Set([
  'Ordinateur portable 15,6"', 'Ordinateur portable 14" fin', 'Écran 24" Full HD', 'Unité centrale bureautique', 'Clavier & souris sans fil',
  'Routeur Wi-Fi double bande', 'Disque SSD 512 Go', 'Onduleur 1000 VA', 'Caméra IP dôme', 'Caméra bullet extérieure', 'Extincteur 6 kg',
  'T-shirt coton personnalisé', 'T-shirt noir personnalisé', 'T-shirt couleur personnalisé', 'Polo brodé', 'T-shirt sable personnalisé',
  'Casquette brodée noire', 'Casquette claire', 'Casquette bleu nuit', 'Mug céramique personnalisé', 'Tote bag coton imprimé',
  'Gourde isotherme gravée', 'Coffret cadeau entreprise', 'Mug noir personnalisé',
])

const DEMO_REALISATIONS: RealisationInput[] = [
  { station: 'impression', title: 'Tirage photo d’art', description: 'Restauration et tirage d’un portrait ancien, prêt à encadrer.', images: ['/media/portrait-vintage.jpg'], featured: true, published: true, sortOrder: 0 },
  { station: 'securite', title: 'Système de vidéosurveillance', description: 'Caméras dôme et bullet avec consultation sur ordinateur, tablette et smartphone.', images: ['/media/videosurveillance.jpg'], featured: true, published: true, sortOrder: 0 },
  { station: 'securite', title: 'Détection de fumée', description: 'Détecteurs de fumée pour sécuriser bureaux, commerces et logements.', images: ['/media/detecteur-fumee.jpg'], featured: false, published: true, sortOrder: 1 },
]

async function seedDemo(db: Db) {
  const [marker] = await db.select().from(settings).where(eq(settings.key, 'demo'))
  const version = (marker?.value as { version?: number } | undefined)?.version ?? 0
  const [p] = await db.select({ n: count() }).from(products)
  if ((p?.n ?? 0) === 0) {
    await db.insert(products).values(DEMO_PRODUCTS.map((x) => ({ ...x, slug: slugify(x.name) })))
  } else if (version < DEMO_VERSION) {
    // Mise à niveau : les anciens exemples restés intacts (sans photo ni prix) laissent place aux nouveaux.
    const rows = await db.select({ id: products.id, name: products.name, images: products.images, price: products.price }).from(products)
    const stale = rows.filter((r) => OLD_DEMO_NAMES.has(r.name) && r.images.length === 0 && r.price === null)
    if (stale.length) await db.delete(products).where(inArray(products.id, stale.map((r) => r.id)))
    const kept = new Set(rows.filter((r) => !stale.includes(r)).map((r) => r.name))
    const fresh = DEMO_PRODUCTS.filter((x) => !kept.has(x.name))
    if (fresh.length) await db.insert(products).values(fresh.map((x) => ({ ...x, slug: slugify(x.name) })))
    console.log(`Produits de démo mis à jour : ${stale.length} remplacés, ${fresh.length} ajoutés.`)
  }
  if (version < DEMO_VERSION) {
    // marqueur de version des exemples (la colonne est typée pour les paramètres du site)
    const value = sql`${JSON.stringify({ version: DEMO_VERSION })}::jsonb`
    await db.insert(settings).values({ key: 'demo', value }).onConflictDoUpdate({ target: settings.key, set: { value } })
  }
  const [r] = await db.select({ n: count() }).from(realisations)
  if ((r?.n ?? 0) === 0) await db.insert(realisations).values(DEMO_REALISATIONS)
}

export async function seedAll(db: Db, admin: { email?: string; password?: string }) {
  await seedServices(db)
  await seedContent(db)
  await seedAdmin(db, admin.email, admin.password)
  await seedDemo(db)
}

// Lancé seul (`pnpm db:seed`) ; jamais quand ce fichier est embarqué dans le bundle de l'API.
if (/seed\.ts$/.test(process.argv[1] ?? '') && import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL est requis')
  const { db, sql: client } = createDb(url)
  await seedAll(db, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
  console.log('Données de base synchronisées.')
  await client.end()
}
