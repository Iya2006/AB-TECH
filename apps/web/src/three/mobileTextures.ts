import * as THREE from 'three'
import { useApp } from '../lib/store'

/**
 * Appareils modestes (qualité « low » : téléphones, tablettes, petites machines) : textures allégées.
 * Sur iPhone, Safari ferme l'onglet (« A problem repeatedly occurred ») dès que la page dépasse sa mémoire,
 * et les textures pleine taille de la visite pesaient près de 500 Mo une fois décodées.
 * - images des modèles et des sols : versions réduites de public/assets/ph-m (tools/optimize-3d/mobile.py) ;
 * - textures dessinées (enseignes, murs, panneaux) : demi-résolution (voir canvasTexture) ;
 * - au-delà, rien ne part sur la carte graphique à plus de 1 024 px (filet de sécurité, voir JourneyScene).
 */
export const LIGHT_TEXTURES = useApp.getState().quality === 'low'

/** Échelle des textures dessinées dans un canvas. */
export const CANVAS_SCALE = LIGHT_TEXTURES ? 0.5 : 1

if (LIGHT_TEXTURES) {
  // tous les chargeurs de three.js (modèles glTF, textures des sols et murs) passent par ce gestionnaire
  THREE.DefaultLoadingManager.setURLModifier((url) => url.replace(/\/assets\/ph\/((?:models|tex)\/[^?#]+\.jpg)$/, '/assets/ph-m/$1'))
}
