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

/**
 * Attend que la base réponde (jusqu'à 5 minutes) : au premier déploiement, la base peut être encore en création ;
 * une base « serverless » peut aussi mettre quelques secondes à se réveiller.
 */
export async function waitForDatabase(sql: ReturnType<typeof createDb>['sql'], maxMs = 5 * 60_000) {
  const start = Date.now()
  for (let attempt = 1; ; attempt++) {
    try {
      await sql`select 1`
      if (attempt > 1) console.log('Base de données joignable.')
      return
    } catch (err) {
      if (Date.now() - start > maxMs) throw err
      console.warn(`Base de données pas encore joignable (essai ${attempt}) : nouvel essai dans 5 s…`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') })
}
