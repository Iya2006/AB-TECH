// Allège les modèles 3D sortis de Blender et les range dans le site.
//   tools/models-3d/out/<nom>.glb  →  apps/web/public/assets/models3d/<nom>.glb  (+ <nom>-ao.webp)
//                                     et <nom>-lod.glb : version allégée pour la visite de l'atelier
//                                     (le produit y fait 200 px à l'écran, et il y en a des dizaines)
// Usage : node tools/models-3d/pack.mjs [noms…]
//
// Sommets soudés, attributs quantifiés et compression meshopt (décodeur déjà embarqué par le site : three-stdlib).
// Les matières de Blender ne servent pas (le site applique les siennes) : seuls leurs noms sont gardés.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { dedup, prune, quantize, reorder, simplify, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(here, 'out')
const OUT = path.resolve(here, '../../apps/web/public/assets/models3d')
fs.mkdirSync(OUT, { recursive: true })

await MeshoptEncoder.ready
await MeshoptSimplifier.ready

/** Part des triangles gardée dans la version allégée (0.25 par défaut). */
const LOD = { mug: 0.4, gourde: 0.4, tote: 0.5, casquette: 0.2, snapback: 0.2, trucker: 0.2 }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(SRC).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4))
async function pack(name, lod) {
  const doc = await io.read(path.join(SRC, `${name}.glb`))
  const root = doc.getRoot()
  // matières : nom seul (tissu, cote…), aucune texture embarquée
  for (const material of root.listMaterials()) {
    material.setBaseColorTexture(null).setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null)
    for (const ext of material.listExtensions()) ext.dispose()
  }
  // (les matières ne sont pas fusionnées : leur nom distingue le tissu du bord-côte)
  // Positions et normales quantifiées ; les UV restent tels quels : le site y place l'impression au millimètre,
  // sans avoir à relire une transformation de texture.
  await doc.transform(
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
    // (les UV sont gardés même sans texture dans le fichier : le site applique les siennes)
    prune({ keepAttributes: true }),
    weld(),
    ...(lod ? [simplify({ simplifier: MeshoptSimplifier, ratio: LOD[name] ?? 0.25, error: 0.004 })] : []),
    reorder({ encoder: MeshoptEncoder }),
    quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 }),
  )
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  const dest = path.join(OUT, `${name}${lod ? '-lod' : ''}.glb`)
  await io.write(dest, doc)
  let tris = 0
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) tris += (prim.getIndices()?.getCount() ?? 0) / 3
  return { tris: Math.round(tris), size: fs.statSync(dest).size }
}

for (const name of names) {
  const full = await pack(name, false)
  const light = await pack(name, true)
  const before = fs.statSync(path.join(SRC, `${name}.glb`)).size
  const ko = (n) => `${(n / 1024).toFixed(0)} Ko`
  console.log(`${name} : ${full.tris} triangles, ${ko(before)} → ${ko(full.size)} ; visite : ${light.tris} triangles, ${ko(light.size)}`)
  const ao = path.join(SRC, `${name}-ao.webp`)
  if (fs.existsSync(ao)) fs.copyFileSync(ao, path.join(OUT, `${name}-ao.webp`))
}
