// Télécharge les photos sources (Unsplash, licence libre) listées dans credits.json → orig/<id>.jpg
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'

const credits = JSON.parse(readFileSync('credits.json', 'utf8'))
mkdirSync('orig', { recursive: true })
for (const [id, { src }] of Object.entries(credits)) {
  const out = `orig/${id}.jpg`
  if (existsSync(out) && statSync(out).size > 20000) continue
  execFileSync('curl', ['-s', '-L', '-m', '60', '-o', out, `${src}?w=1600&q=90&fm=jpg`])
  console.log(id, statSync(out).size)
}
