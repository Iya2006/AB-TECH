import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import postgres from 'postgres'
import * as schema from './schema'

export function createDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: 10,
    // Bases « serverless » (Neon) : la base s'endort après quelques minutes d'inactivité et coupe les connexions.
    // On ferme nous-mêmes les connexions inutilisées avant, et on laisse le temps au réveil.
    idle_timeout: 120,
    connect_timeout: 30,
    // Adresse « pooler » (PgBouncer en mode transaction) : pas de requêtes préparées nommées.
    prepare: !/-pooler\./.test(databaseUrl),
  })
  const db = drizzle(sql, { schema })
  return { db, sql }
}

export type Db = ReturnType<typeof createDb>['db']

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') })
}
