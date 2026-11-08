import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Le paquet partagé est en TypeScript source : on l'embarque dans le bundle.
  // nodemailer aussi (aucune dépendance) : le bundle fonctionne même dans une image construite avant son ajout.
  noExternal: ['@atelier/shared', 'nodemailer'],
  // nodemailer est en CommonJS : ses require() de modules Node ont besoin d'un `require` dans le bundle ESM.
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
})
