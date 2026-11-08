import { createDb, runMigrations } from './client'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL est requis')

const { db, sql } = createDb(url)
await runMigrations(db)
console.log('Migrations appliquées.')
await sql.end()
