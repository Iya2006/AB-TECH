// Photos réelles (Unsplash, licence libre) détourées et segmentées hors ligne : photo, masque du tissu,
// luminance de référence et zone d’impression. Régénéré par le script d’assets — ne pas modifier à la main.
import type { MockupBase } from './engine'

export const BASES = {
  'homme-tshirt': { src: '/media/studio/homme-tshirt.jpg', mask: '/media/studio/homme-tshirt-mask.png', width: 1000, height: 1250, lref: 0.902, print: { x: 0.385, y: 0.38, w: 0.26, h: 0.23 } },
  'femme-tshirt': { src: '/media/studio/femme-tshirt.jpg', mask: '/media/studio/femme-tshirt-mask.png', width: 1000, height: 1250, lref: 0.879, print: { x: 0.36, y: 0.41, w: 0.27, h: 0.24 } },
  'homme-polo': { src: '/media/studio/homme-polo.jpg', mask: '/media/studio/homme-polo-mask.png', width: 1000, height: 1250, lref: 0.977, print: { x: 0.56, y: 0.44, w: 0.15, h: 0.12 } },
  'femme-polo': { src: '/media/studio/femme-polo.jpg', mask: '/media/studio/femme-polo-mask.png', width: 1000, height: 1250, lref: 0.909, print: { x: 0.55, y: 0.47, w: 0.16, h: 0.12 } },
  'homme-sweat': { src: '/media/studio/homme-sweat.jpg', mask: '/media/studio/homme-sweat-mask.png', width: 1000, height: 1250, lref: 0.849, print: { x: 0.37, y: 0.47, w: 0.27, h: 0.2 } },
  'femme-sweat': { src: '/media/studio/femme-sweat.jpg', mask: '/media/studio/femme-sweat-mask.png', width: 1000, height: 1250, lref: 0.93, print: { x: 0.36, y: 0.4, w: 0.28, h: 0.21 } },
  'homme-casquette': { src: '/media/studio/homme-casquette.jpg', mask: '/media/studio/homme-casquette-mask.png', width: 1000, height: 1250, lref: 0.813, print: { x: 0.41, y: 0.125, w: 0.16, h: 0.1 } },
  'femme-casquette': { src: '/media/studio/femme-casquette.jpg', mask: '/media/studio/femme-casquette-mask.png', width: 1000, height: 1250, lref: 0.953, print: { x: 0.44, y: 0.1, w: 0.18, h: 0.08, rotate: 0.1 } },
  'p-tshirt': { src: '/media/catalogue/tshirt.webp', mask: '/media/catalogue/tshirt-mask.png', width: 836, height: 1019, lref: 0.969, print: { x: 0.352, y: 0.352, w: 0.29, h: 0.25 } },
  'p-polo': { src: '/media/catalogue/polo.webp', mask: '/media/catalogue/polo-mask.png', width: 894, height: 1025, lref: 0.945, print: { x: 0.56, y: 0.27, w: 0.17, h: 0.13 } },
  'p-sweat': { src: '/media/catalogue/sweat.webp', mask: '/media/catalogue/sweat-mask.png', width: 610, height: 955, lref: 0.947, print: { x: 0.317, y: 0.22, w: 0.454, h: 0.305 } },
  'p-pull': { src: '/media/catalogue/pull.webp', mask: '/media/catalogue/pull-mask.png', width: 1100, height: 988, lref: 0.939, print: { x: 0.249, y: 0.22, w: 0.433, h: 0.506 } },
  'p-casquette': { src: '/media/catalogue/casquette.webp', mask: '/media/catalogue/casquette-mask.png', width: 808, height: 536, lref: 0.756, print: { x: 0.2, y: 0.13, w: 0.27, h: 0.28, rotate: -0.18 } },
  'p-trucker': { src: '/media/catalogue/trucker.webp', mask: '/media/catalogue/trucker-mask.png', width: 1100, height: 936, lref: 0.933, print: { x: 0.349, y: 0.166, w: 0.301, h: 0.334 } },
  'p-snapback': { src: '/media/catalogue/snapback.webp', mask: '/media/catalogue/snapback-mask.png', width: 975, height: 659, lref: 0.973, print: { x: 0.35, y: 0.173, w: 0.301, h: 0.327 } },
  'p-tote': { src: '/media/catalogue/tote.webp', mask: '/media/catalogue/tote-mask.png', width: 662, height: 957, lref: 0.747, print: { x: 0.275, y: 0.218, w: 0.452, h: 0.329 } },
  'p-mug': { src: '/media/catalogue/mug.webp', mask: '/media/catalogue/mug-mask.png', width: 770, height: 772, lref: 0.895, print: { x: 0.33, y: 0.22, w: 0.64, h: 0.5, curve: 1 } },
  'p-gourde': { src: '/media/catalogue/gourde.webp', mask: '/media/catalogue/gourde-mask.png', width: 245, height: 728, lref: 0.842, print: { x: 0.094, y: 0.42, w: 0.816, h: 0.3, curve: 1 } },
} satisfies Record<string, MockupBase>
