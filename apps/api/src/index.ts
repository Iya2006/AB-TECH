import { purgeExpired } from './accounts'
import { buildApp } from './app'
import { createDb, runMigrations } from './db/client'
import { seedAll } from './db/seed'
import { loadEnv } from './env'

const env = loadEnv()
const { db, sql } = createDb(env.DATABASE_URL)

await runMigrations(db)
await seedAll(db, { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })
await purgeExpired(db)

const app = await buildApp(env, db)
await app.listen({ host: env.HOST, port: env.PORT })

// ménage horaire : sessions expirées, liens de réinitialisation périmés
const purge = setInterval(() => purgeExpired(db).catch((err) => app.log.error({ err }, 'ménage des sessions')), 3_600_000)
purge.unref()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    clearInterval(purge)
    await app.close()
    await sql.end({ timeout: 5 })
    process.exit(0)
  })
}
