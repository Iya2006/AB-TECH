/**
 * Copie le site local (Docker, http://localhost:8080) vers l'hébergement en ligne :
 *   1. la base Postgres → la base en ligne (Neon), sauf les sessions et liens de réinitialisation ;
 *   2. les photos envoyées depuis l'administration (volume « uploads ») → Cloudinary, et leurs adresses mises à jour ;
 *   3. vérification : mêmes nombres de lignes, plus aucune adresse /uploads/ locale.
 *
 * Réglages lus dans .env.cloud (à la racine, jamais envoyé sur GitHub) :
 *   CLOUD_DATABASE_URL=postgresql://…   (chaîne de connexion Neon)
 *   CLOUDINARY_URL=cloudinary://…        (tableau de bord Cloudinary)
 *
 * Usage : pnpm cloud:copy            (la base en ligne doit être vide)
 *         pnpm cloud:copy --reset    (vide d'abord la base en ligne : tout son contenu est effacé)
 * Les mots de passe des adresses de connexion ne sont jamais affichés.
 */
import { v2 as cloudinary } from 'cloudinary'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import postgres from 'postgres'

const TARGET = process.env.CLOUD_DATABASE_URL
const DB_CONTAINER = process.env.SOURCE_DB_CONTAINER ?? 'mvp-site-dynamique-db-1'
const API_CONTAINER = process.env.SOURCE_API_CONTAINER ?? 'mvp-site-dynamique-api-1'
const reset = process.argv.includes('--reset')

if (!TARGET || !process.env.CLOUDINARY_URL) {
  console.error('Renseignez CLOUD_DATABASE_URL et CLOUDINARY_URL dans le fichier .env.cloud (à la racine du projet).')
  process.exit(1)
}

const host = new URL(TARGET).host
const target = postgres(TARGET, { max: 1, connect_timeout: 30, prepare: !/-pooler\./.test(TARGET), onnotice: () => {} })

/** Tables et colonnes qui peuvent contenir des adresses de photos envoyées. */
const COLUMNS: Array<[table: string, column: string, json: boolean]> = [
  ['products', 'images', true],
  ['products', 'print_image', false],
  ['realisations', 'images', true],
  ['settings', 'value', true],
  ['quote_requests', 'logo_url', false],
  ['quote_requests', 'mockup_url', false],
  ['users', 'avatar_url', false],
]
const TABLES = ['users', 'services', 'stations', 'settings', 'products', 'realisations', 'reviews', 'quote_requests', 'orders']
const UPLOAD = /\/uploads\/(logo|mockup|media|avatar)\/[0-9a-f-]{36}\.(png|jpg|webp)/g

/** Commande SQL lancée dans le conteneur de la base locale. */
function local(query: string) {
  return execFileSync('docker', ['exec', DB_CONTAINER, 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$0"', query], { encoding: 'utf8' }).trim()
}

async function main() {
  console.log(`Base en ligne : ${host}`)

  // 0. Cloudinary répond avec ces accès (vérifié avant de toucher à la moindre base)
  cloudinary.config({ secure: true })
  try {
    await cloudinary.api.ping()
  } catch (err) {
    const why = (err as { error?: { message?: string }; message?: string }).error?.message ?? (err as Error).message
    console.error(`Cloudinary refuse ces accès (${why}). Vérifiez CLOUDINARY_URL dans .env.cloud (tableau de bord Cloudinary → API Keys).`)
    process.exit(1)
  }

  // La base en ligne doit être vide (sinon, --reset la vide d'abord)
  const [{ n }] = await target<[{ n: number }]>`select count(*)::int as n from information_schema.tables where table_schema in ('public', 'drizzle')`
  if (n > 0) {
    if (!reset) {
      console.error(`La base en ligne contient déjà ${n} table(s). Relancez avec --reset pour la vider (son contenu actuel sera effacé).`)
      process.exit(1)
    }
    console.log(`Vidage de la base en ligne (${n} tables)…`)
    await target.unsafe('drop schema if exists drizzle cascade; drop schema public cascade; create schema public;')
  }

  // 1. Base : pg_dump local → psql en ligne (sans les sessions ni les liens de réinitialisation)
  console.log('1/3 Copie de la base…')
  const dump = spawnSync(
    'docker',
    [
      'exec',
      '-e',
      `TARGET=${TARGET}`,
      DB_CONTAINER,
      'sh',
      '-c',
      'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exclude-table-data=sessions --exclude-table-data=password_resets | psql "$TARGET" -q',
    ],
    { encoding: 'utf8' },
  )
  const errors = (dump.stderr ?? '').split('\n').filter((l) => /ERROR|FATAL/.test(l) && !/transaction_timeout/.test(l))
  if (dump.status !== 0 || errors.length) {
    console.error('La copie de la base a rencontré des erreurs :\n' + errors.slice(0, 10).join('\n'))
    process.exit(1)
  }

  // 2. Photos : celles référencées dans la base → Cloudinary, puis remplacement des adresses
  console.log('2/3 Envoi des photos sur Cloudinary…')
  const refs = new Set<string>()
  for (const [table, column] of COLUMNS) {
    const rows = await target.unsafe<Array<{ v: string }>>(`select ${column}::text as v from ${table} where ${column}::text like '%/uploads/%'`)
    for (const { v } of rows) for (const m of v.matchAll(UPLOAD)) refs.add(m[0])
  }
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'abt-photos-'))
  try {
    if (refs.size) execFileSync('docker', ['cp', `${API_CONTAINER}:/repo/apps/api/uploads/.`, tmp])
    let moved = 0
    for (const url of refs) {
      const [, , kind, name] = url.split('/')
      const file = path.join(tmp, kind!, name!)
      if (!existsSync(file)) {
        console.warn(`   introuvable sur le serveur local : ${url}`)
        continue
      }
      // même dossier que les envois faits depuis le site (src/storage.ts)
      const res = await cloudinary.uploader.upload(file, { folder: `atelier/devis/${kind}`, resource_type: 'image' })
      for (const [table, column, json] of COLUMNS) {
        await target.unsafe(`update ${table} set ${column} = replace(${column}::text, $1, $2)${json ? '::jsonb' : ''} where strpos(${column}::text, $1) > 0`, [url, res.secure_url])
      }
      moved++
      console.log(`   ✓ ${kind}/${name}`)
    }
    console.log(`   ${moved} photo(s) sur Cloudinary.`)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  // 3. Vérification
  console.log('3/3 Vérification…')
  let ok = true
  for (const table of TABLES) {
    const source = Number(local(`select count(*) from ${table}`))
    const [{ c }] = await target.unsafe<[{ c: number }]>(`select count(*)::int as c from ${table}`)
    const same = source === c
    ok &&= same
    console.log(`   ${same ? '✓' : '✗'} ${table} : ${c}${same ? '' : ` (local : ${source})`}`)
  }
  let left = 0
  for (const [table, column] of COLUMNS) {
    const [{ c }] = await target.unsafe<[{ c: number }]>(`select count(*)::int as c from ${table} where ${column}::text like '%/uploads/%'`)
    left += c
  }
  console.log(`   ${left ? '✗' : '✓'} adresses de photos locales restantes : ${left}`)
  if (!ok || left) process.exitCode = 1
  else console.log('\nCopie terminée : le site en ligne démarrera avec ce contenu.')
}

try {
  await main()
} finally {
  await target.end({ timeout: 5 })
}
