import type { Customization, OrderItem, SiteSettings } from '@atelier/shared'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

export const serviceDomain = pgEnum('service_domain', ['print', 'tech'])
export const quoteStatus = pgEnum('quote_status', ['nouveau', 'en_cours', 'traite'])
export const orderStatus = pgEnum('order_status', ['nouvelle', 'confirmee', 'livree', 'annulee'])
export const reviewStatus = pgEnum('review_status', ['en_attente', 'publie', 'masque'])
export const stockStatus = pgEnum('stock_status', ['en_stock', 'sur_commande', 'rupture'])
export const userRole = pgEnum('user_role', ['client', 'admin'])

/* ------------------------------------------------------------------ */
/* Comptes : un seul système pour les clients et l'administrateur      */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Toujours en minuscules. */
    email: text('email').notNull().unique(),
    /** Vrai si la propriété de l'adresse est prouvée (Google, ou lien reçu par e-mail). */
    emailVerified: boolean('email_verified').notNull().default(false),
    name: text('name').notNull().default(''),
    phone: text('phone').notNull().default(''),
    avatarUrl: text('avatar_url').notNull().default(''),
    role: userRole('role').notNull().default('client'),
    /** Absent pour un compte créé avec Google uniquement. */
    passwordHash: text('password_hash'),
    googleId: text('google_id').unique(),
    /** Mot de passe initial fourni à la livraison : à remplacer à la première connexion. */
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('users_role_idx').on(t.role)],
)

/** Sessions côté serveur : le cookie porte un jeton aléatoire, la base n'en garde que l'empreinte. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/** Liens de réinitialisation : empreinte du jeton, valables 30 minutes, à usage unique. */
export const passwordResets = pgTable(
  'password_resets',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('password_resets_user_idx').on(t.userId)],
)

const owner = () => uuid('user_id').references(() => users.id, { onDelete: 'set null' })

export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  domain: serviceDomain('domain').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  highlights: jsonb('highlights').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: updatedAt(),
})

export const quoteRequests = pgTable(
  'quote_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: owner(),
    status: quoteStatus('status').notNull().default('nouveau'),
    fullName: text('full_name').notNull(),
    company: text('company'),
    phone: text('phone').notNull(),
    email: text('email'),
    service: text('service')
      .notNull()
      .references(() => services.slug),
    quantity: integer('quantity'),
    message: text('message').notNull(),
    customization: jsonb('customization').$type<Customization>(),
    mockupUrl: text('mockup_url'),
    logoUrl: text('logo_url'),
    createdAt: createdAt(),
  },
  (t) => [index('quote_requests_created_at_idx').on(t.createdAt), index('quote_requests_user_idx').on(t.userId)],
)

/** Paramètres clé → valeur (une seule clé « site » pour l'instant). */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<SiteSettings>().notNull(),
  updatedAt: updatedAt(),
})

export const stations = pgTable('stations', {
  slug: text('slug').primaryKey(),
  kicker: text('kicker').notNull(),
  title: jsonb('title').$type<[string, string]>().notNull(),
  body: text('body').notNull(),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  service: text('service').notNull(),
  updatedAt: updatedAt(),
})

export const realisations = pgTable(
  'realisations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    station: text('station')
      .notNull()
      .references(() => stations.slug),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    images: jsonb('images').$type<string[]>().notNull().default([]),
    featured: boolean('featured').notNull().default(false),
    published: boolean('published').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('realisations_station_idx').on(t.station)],
)

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    station: text('station')
      .notNull()
      .references(() => stations.slug),
    category: text('category').notNull(),
    brand: text('brand').notNull().default(''),
    price: integer('price'),
    description: text('description').notNull().default(''),
    specs: jsonb('specs').$type<Array<[string, string]>>().notNull().default([]),
    images: jsonb('images').$type<string[]>().notNull().default([]),
    stock: stockStatus('stock').notNull().default('en_stock'),
    featured: boolean('featured').notNull().default(false),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    model: text('model').notNull().default('boite'),
    color: text('color').notNull().default('#f4f1ea'),
    printImage: text('print_image').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('products_station_idx').on(t.station)],
)

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    userId: owner(),
    name: text('name').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    status: reviewStatus('status').notNull().default('en_attente'),
    createdAt: createdAt(),
  },
  (t) => [index('reviews_product_idx').on(t.productId), index('reviews_user_idx').on(t.userId)],
)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: owner(),
    status: orderStatus('status').notNull().default('nouvelle'),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    address: text('address'),
    message: text('message'),
    items: jsonb('items').$type<OrderItem[]>().notNull(),
    total: integer('total'),
    createdAt: createdAt(),
  },
  (t) => [index('orders_created_at_idx').on(t.createdAt), index('orders_user_idx').on(t.userId)],
)
