// Télécharge des modèles Poly Haven (licence CC0 : usage commercial libre, sans attribution obligatoire)
// en glTF 1k, dans src/ph/models/<id>/ (originaux), avant passage dans optimize.mjs.
// Usage : node tools/optimize-3d/fetch.mjs CashRegister_01 bar_chair_round_01 …
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ids = process.argv.slice(2)
const UA = { 'User-Agent': 'AB-TECH-site/1.0 (preparation hors ligne des ressources 3D)' }

async function get(url, as = 'json') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120000) })
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer())
    } catch (err) {
      if (attempt === 3) throw err
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
}

for (const id of ids) {
  const dir = path.join(here, 'src/ph/models', id)
  if (fs.existsSync(path.join(dir, `${id}.gltf`))) {
    console.log(`${id} : déjà là`)
    continue
  }
  const files = await get(`https://api.polyhaven.com/files/${id}`)
  const gltf = files.gltf?.['1k']?.gltf
  if (!gltf) {
    console.log(`${id} : pas de glTF 1k`)
    continue
  }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${id}.gltf`), await get(gltf.url, 'buffer'))
  let bytes = 0
  for (const [rel, info] of Object.entries(gltf.include ?? {})) {
    const dest = path.join(dir, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const buf = await get(info.url, 'buffer')
    bytes += buf.length
    fs.writeFileSync(dest, buf)
  }
  console.log(`${id} : ${Object.keys(gltf.include ?? {}).length + 1} fichiers, ${(bytes / 1024 / 1024).toFixed(1)} Mo`)
}
