// Allège les modèles 3D sortis de Blender et les range dans le site.
//   tools/models-3d/out/<nom>.glb  →  apps/web/public/assets/models3d/<nom>.glb  (+ <nom>-ao.webp)
// Usage : node tools/models-3d/pack.mjs [noms…]
//
// Sommets soudés, attributs quantifiés et compression meshopt (décodeur déjà embarqué par le site : three-stdlib).
// Les matières de Blender ne servent pas (le site applique les siennes) : seuls leurs noms sont gardés.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(here, 'out')
const OUT = path.resolve(here, '../../apps/web/public/assets/models3d')
fs.mkdirSync(OUT, { recursive: true })

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(SRC).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4))
for (const name of names) {
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
    reorder({ encoder: MeshoptEncoder }),
    quantize({ pattern: /^(POSITION|NORMAL)$/, quantizePosition: 14, quantizeNormal: 10 }),
  )
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  const dest = path.join(OUT, `${name}.glb`)
  await io.write(dest, doc)
  let tris = 0
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) tris += (prim.getIndices()?.getCount() ?? 0) / 3
  const before = fs.statSync(path.join(SRC, `${name}.glb`)).size
  const after = fs.statSync(dest).size
  console.log(`${name} : ${Math.round(tris)} triangles, ${(before / 1024).toFixed(0)} Ko → ${(after / 1024).toFixed(0)} Ko`)
  for (const extra of [`${name}-ao.webp`]) {
    const file = path.join(SRC, extra)
    if (fs.existsSync(file)) fs.copyFileSync(file, path.join(OUT, extra))
  }
}
