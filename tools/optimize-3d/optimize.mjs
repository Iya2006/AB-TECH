// Allège les ressources 3D Poly Haven du site (modèles, éclairages HDRI), hors ligne.
//   src/ph  (originaux, intacts)  →  apps/web/public/assets/ph  (versions servies)
// Usage : node tools/optimize-3d/optimize.mjs   puis   python tools/optimize-3d/textures.py
//
// - Modèles : triangles simplifiés (meshoptimizer, coutures UV et normales préservées), sommets inutiles retirés.
//   Le format reste du glTF standard : aucun décodeur à ajouter côté site.
// - HDRI : 1024 × 512 → 512 × 256. Ils ne servent qu'à l'éclairage et aux reflets (le ciel visible est dessiné à part).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const SRC = path.join(here, 'src/ph')
const OUT = path.join(root, 'apps/web/public/assets/ph')

const store = path.join(root, 'node_modules/.pnpm')
const pkg = (name) => {
  const dir = fs.readdirSync(store).find((d) => d.startsWith(`${name}@`))
  if (!dir) throw new Error(`${name} introuvable dans node_modules/.pnpm`)
  return path.join(store, dir, 'node_modules', name)
}
const { MeshoptSimplifier } = await import(pathToFileURL(path.join(pkg('meshoptimizer'), 'index.js')).href)
const THREE = await import(pathToFileURL(path.join(pkg('three'), 'build/three.module.js')).href)
const { HDRLoader } = await import(pathToFileURL(path.join(pkg('three'), 'examples/jsm/loaders/HDRLoader.js')).href)
await MeshoptSimplifier.ready

/** Part des triangles conservée (le simplificateur s'arrête avant si l'erreur dépasse ERROR). */
const MODELS = {
  potted_plant_02: 0.14,
  street_lamp_01: 0.22,
  desk_lamp_arm_01: 0.25,
  classic_laptop: 0.5,
  security_camera_01: 0.4,
  security_camera_02: 0.4,
  korean_fire_extinguisher_01: 0.5,
  steel_frame_shelves_02: 1,
  // showroom (v6) : accueil, mobilier, éclairage, extérieur
  CashRegister_01: 0.6,
  bar_chair_round_01: 0.35,
  sofa_03: 0.7,
  modern_coffee_table_01: 0.8,
  modern_arm_chair_01: 0.5,
  hanging_industrial_lamp: 0.4,
  planter_box_01: 0.4,
  modular_street_seating: 0.18,
  exterior_aircon_unit: 0.35,
  utility_box_01: 0.8,
  metal_trash_can: 0.35,
  potted_plant_04: 0.5,
  stationery_supplies: 0.6,
  wall_clock: 0.6,
  steel_frame_shelves_03: 0.7,
  cardboard_box_01: 0.15,
  drawer_cabinet: 0.2,
  standing_picture_frame_01: 1,
}
/** Erreur géométrique tolérée, relative à la taille de l'objet (1 % : invisible à la distance de la visite). */
const ERROR = 0.01
/**
 * Feuillage (des centaines de petites feuilles), formes rondes très denses (tabouret) ou objets vus de loin
 * (banc de la rue) : une erreur un peu plus grande reste invisible.
 */
const ERROR_FOR = { potted_plant_02: 0.025, bar_chair_round_01: 0.03, modular_street_seating: 0.02 }
/** Maillage en pièces soudées par les coutures UV (tabouret) : on autorise la simplification à les franchir. */
const FLAGS_FOR = { bar_chair_round_01: ['Permissive'] }

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
const ARRAYS = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }

function readAccessor(gltf, bin, index) {
  const acc = gltf.accessors[index]
  const view = gltf.bufferViews[acc.bufferView]
  const Arr = ARRAYS[acc.componentType]
  const n = COMPONENTS[acc.type]
  const size = Arr.BYTES_PER_ELEMENT
  const stride = view.byteStride ?? n * size
  const out = new Arr(acc.count * n)
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const get = { 5121: 'getUint8', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[acc.componentType]
  for (let i = 0; i < acc.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = dv[get](base + i * stride + c * size, true)
  return out
}

function optimizeModel(name, ratio) {
  const dir = path.join(SRC, 'models', name)
  const gltf = JSON.parse(fs.readFileSync(path.join(dir, `${name}.gltf`), 'utf8'))
  const bin = fs.readFileSync(path.join(dir, gltf.buffers[0].uri))
  if (gltf.images?.some((im) => im.bufferView !== undefined)) throw new Error(`${name} : images intégrées non gérées`)

  const chunks = []
  let offset = 0
  const bufferViews = []
  const accessors = []
  const push = (typed, target) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength)
    const pad = (4 - (offset % 4)) % 4
    if (pad) (chunks.push(new Uint8Array(pad)), (offset += pad))
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target })
    chunks.push(bytes)
    offset += bytes.byteLength
    return bufferViews.length - 1
  }
  const addAccessor = (typed, type, componentType, target, extra = {}) =>
    accessors.push({ bufferView: push(typed, target), componentType, count: typed.length / COMPONENTS[type], type, ...extra }) - 1

  let before = 0
  let after = 0
  for (const mesh of gltf.meshes) {
    for (const prim of mesh.primitives) {
      const dropped = Object.keys(prim.attributes).filter((a) => !['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(a))
      if (dropped.length) console.warn(`  ${name} : attributs ignorés ${dropped.join(', ')}`)
      const pos = readAccessor(gltf, bin, prim.attributes.POSITION)
      const nor = prim.attributes.NORMAL !== undefined ? readAccessor(gltf, bin, prim.attributes.NORMAL) : null
      const uv = prim.attributes.TEXCOORD_0 !== undefined ? readAccessor(gltf, bin, prim.attributes.TEXCOORD_0) : null
      let idx = Uint32Array.from(readAccessor(gltf, bin, prim.indices))
      const count = pos.length / 3
      before += idx.length / 3

      if (ratio < 1) {
        // attributs pris en compte : normales (arêtes vives) et UV (coutures de texture)
        const attrs = new Float32Array(count * 5)
        for (let i = 0; i < count; i++) {
          if (nor) attrs.set(nor.subarray(i * 3, i * 3 + 3), i * 5)
          if (uv) attrs.set(uv.subarray(i * 2, i * 2 + 2), i * 5 + 3)
        }
        const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3)
        ;[idx] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, attrs, 5, [0.4, 0.4, 0.4, 0.8, 0.8], null, target, ERROR_FOR[name] ?? ERROR, FLAGS_FOR[name])
      }
      after += idx.length / 3

      // sommets réellement utilisés, renumérotés dans l'ordre d'accès
      const [remap, unique] = MeshoptSimplifier.compactMesh(idx)
      const pick = (src, n) => {
        if (!src) return null
        const out = new Float32Array(unique * n)
        for (let i = 0; i < count; i++) if (remap[i] !== 0xffffffff) out.set(src.subarray(i * n, i * n + n), remap[i] * n)
        return out
      }
      const p = pick(pos, 3)
      const min = [Infinity, Infinity, Infinity]
      const max = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < unique; i++)
        for (let c = 0; c < 3; c++) {
          min[c] = Math.min(min[c], p[i * 3 + c])
          max[c] = Math.max(max[c], p[i * 3 + c])
        }
      const attributes = { POSITION: addAccessor(p, 'VEC3', 5126, 34962, { min, max }) }
      const n = pick(nor, 3)
      if (n) attributes.NORMAL = addAccessor(n, 'VEC3', 5126, 34962)
      const t = pick(uv, 2)
      if (t) attributes.TEXCOORD_0 = addAccessor(t, 'VEC2', 5126, 34962)
      const small = unique < 65536
      prim.indices = addAccessor(small ? Uint16Array.from(idx) : idx, 'SCALAR', small ? 5123 : 5125, 34963)
      prim.attributes = attributes
    }
  }

  // seul le premier jeu de coordonnées UV est gardé : les textures qui visaient le second s'y rattachent
  for (const mat of gltf.materials ?? []) {
    const infos = [mat.normalTexture, mat.occlusionTexture, mat.emissiveTexture, mat.pbrMetallicRoughness?.baseColorTexture, mat.pbrMetallicRoughness?.metallicRoughnessTexture]
    for (const info of infos) if (info?.texCoord) delete info.texCoord
  }
  gltf.bufferViews = bufferViews
  gltf.accessors = accessors
  gltf.buffers = [{ uri: gltf.buffers[0].uri, byteLength: offset }]

  const outDir = path.join(OUT, 'models', name)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, gltf.buffers[0].uri), Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))))
  fs.writeFileSync(path.join(outDir, `${name}.gltf`), JSON.stringify(gltf))
  fs.cpSync(path.join(dir, 'textures'), path.join(outDir, 'textures'), { recursive: true })
  const kb = (f) => Math.round(fs.statSync(f).size / 1024)
  console.log(
    `${name.padEnd(28)} ${String(Math.round(before)).padStart(6)} → ${String(Math.round(after)).padStart(6)} triangles   ` +
      `${kb(path.join(dir, gltf.buffers[0].uri))} → ${kb(path.join(outDir, gltf.buffers[0].uri))} Ko`,
  )
}

/** Encodage RGBE (Radiance) avec compression RLE par canal, lisible par HDRLoader. */
function encodeHdr(width, height, rgba) {
  const parts = [Buffer.from(`#?RADIANCE\n# AB-TECH : version allégée\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`, 'ascii')]
  const line = new Uint8Array(width * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
      const v = Math.max(r, g, b)
      if (v < 1e-32) {
        line[x] = line[width + x] = line[2 * width + x] = line[3 * width + x] = 0
        continue
      }
      const e = Math.floor(Math.log2(v)) + 1
      const f = 256 / 2 ** e
      line[x] = Math.min(255, Math.floor(r * f))
      line[width + x] = Math.min(255, Math.floor(g * f))
      line[2 * width + x] = Math.min(255, Math.floor(b * f))
      line[3 * width + x] = e + 128
    }
    const out = [2, 2, width >> 8, width & 255]
    for (let c = 0; c < 4; c++) {
      const ch = line.subarray(c * width, (c + 1) * width)
      let i = 0
      while (i < width) {
        let run = 1
        while (i + run < width && run < 127 && ch[i + run] === ch[i]) run++
        if (run >= 3) {
          out.push(128 + run, ch[i])
          i += run
          continue
        }
        let lit = 0
        while (i + lit < width && lit < 128) {
          if (i + lit + 2 < width && ch[i + lit] === ch[i + lit + 1] && ch[i + lit] === ch[i + lit + 2]) break
          lit++
        }
        out.push(lit, ...ch.subarray(i, i + lit))
        i += lit
      }
    }
    parts.push(Buffer.from(out))
  }
  return Buffer.concat(parts)
}

function optimizeHdr(file, factor = 2) {
  const src = fs.readFileSync(path.join(SRC, 'hdri', file))
  const loader = new HDRLoader().setDataType(THREE.FloatType)
  const { width, height, data } = loader.parse(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength))
  const w = width / factor
  const h = height / factor
  const out = new Float32Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let s = 0
        for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) s += data[((y * factor + dy) * width + x * factor + dx) * 4 + c]
        out[(y * w + x) * 4 + c] = s / (factor * factor)
      }
  const dest = path.join(OUT, 'hdri', file)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, encodeHdr(w, h, out))
  console.log(`${file.padEnd(28)} ${width}×${height} → ${w}×${h}   ${Math.round(src.length / 1024)} → ${Math.round(fs.statSync(dest).size / 1024)} Ko`)
}

for (const [name, ratio] of Object.entries(MODELS)) optimizeModel(name, ratio)
for (const file of fs.readdirSync(path.join(SRC, 'hdri'))) optimizeHdr(file)
fs.copyFileSync(path.join(SRC, 'manifest.json'), path.join(OUT, 'manifest.json'))
