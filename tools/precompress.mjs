// Précompresse le site construit (Brotli + gzip) : le serveur envoie ces fichiers tels quels, sans calcul à chaque visite.
// Usage : node tools/precompress.mjs apps/web/dist
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const root = path.resolve(process.argv[2] ?? 'apps/web/dist')
// Les images (webp, jpg, png) et les polices woff2 sont déjà compressées : on ne les touche pas.
const TEXT = /\.(js|mjs|css|html|svg|json|txt|xml|webmanifest)$/i
const BINARY = /\.(glb|gltf|bin|hdr|wasm|ktx2|ttf|otf)$/i

let files = 0
let before = 0
let after = 0

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name)
    if (statSync(file).isDirectory()) walk(file)
    else if ((TEXT.test(name) || BINARY.test(name)) && statSync(file).size >= 1024) compress(file, TEXT.test(name))
  }
}

function compress(file, text) {
  const buf = readFileSync(file)
  const br = brotliCompressSync(buf, {
    params: { [constants.BROTLI_PARAM_QUALITY]: text ? 11 : 9, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length },
  })
  // inutile si le gain est faible : le navigateur recevra le fichier d'origine
  if (br.length < buf.length * 0.95) writeFileSync(`${file}.br`, br)
  const gz = gzipSync(buf, { level: 9 })
  if (gz.length < buf.length * 0.95) writeFileSync(`${file}.gz`, gz)
  files++
  before += buf.length
  after += Math.min(buf.length, br.length)
}

walk(root)
const mb = (n) => (n / 1024 / 1024).toFixed(1)
console.log(`Précompression : ${files} fichiers, ${mb(before)} Mo → ${mb(after)} Mo en Brotli`)
