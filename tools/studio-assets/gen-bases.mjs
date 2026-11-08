// out/bases.json → apps/web/src/lib/mockup/bases.ts
import { readFileSync, writeFileSync } from 'node:fs'

const bases = JSON.parse(readFileSync('out/bases.json', 'utf8'))
const r = (v) => Math.round(v * 1000) / 1000
const obj = (o) =>
  `{ ${Object.entries(o)
    .map(([k, v]) => `${k}: ${typeof v === 'number' ? r(v) : JSON.stringify(v)}`)
    .join(', ')} }`
let s = `// Photos réelles (Unsplash, licence libre) détourées et segmentées hors ligne : photo, masque du tissu,
// luminance de référence et zone d’impression. Régénéré par le script d’assets — ne pas modifier à la main.
import type { MockupBase } from './engine'

export const BASES = {
`
for (const [id, v] of Object.entries(bases)) {
  s += `  '${id}': { src: '${v.src}', mask: '${v.mask}', width: ${v.width}, height: ${v.height}, lref: ${v.lref}, print: ${obj(v.print)} },\n`
}
s += '} satisfies Record<string, MockupBase>\n'
writeFileSync(new URL('../../apps/web/src/lib/mockup/bases.ts', import.meta.url), s)
console.log('ok', Object.keys(bases).length)
