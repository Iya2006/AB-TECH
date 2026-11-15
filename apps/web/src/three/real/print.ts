import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { embroider, type PrintSpec } from '../../lib/mockup/engine'
import { drawPrint } from '../../lib/print'

/**
 * Le visuel du client (logo, texte) dessiné à plat dans une texture, aux proportions de la zone d'impression.
 * La texture ne change que si le visuel change : le déplacer ou l'agrandir sur le vêtement ne la touche pas.
 */

/** Marge transparente : le bord de la texture ne « bave » jamais sur le tissu. */
const MARGIN = 6

export function drawPrintCanvas(canvas: HTMLCanvasElement, spec: PrintSpec) {
  const ctx = canvas.getContext('2d', { willReadFrequently: spec.finish === 'broderie' })!
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  drawPrint(ctx, MARGIN, MARGIN, w - MARGIN * 2, h - MARGIN * 2, spec)
  if (spec.finish === 'broderie') {
    const img = ctx.getImageData(0, 0, w, h)
    embroider(img.data, w, h)
    ctx.putImageData(img, 0, 0)
  }
}

/** Texture du visuel, pour une zone de `cm` centimètres (largeur, hauteur). */
export function usePrintTexture(spec: PrintSpec | null, cm: [number, number], size = 1024) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    const landscape = cm[0] >= cm[1]
    canvas.width = landscape ? size : Math.round((size * cm[0]) / cm[1])
    canvas.height = landscape ? Math.round((size * cm[1]) / cm[0]) : size
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    // même convention que le dépliage du modèle : origine de l'image en haut à gauche
    texture.flipY = false
    texture.anisotropy = 8
    return { canvas, texture }
  }, [cm[0], cm[1], size])
  useEffect(() => () => texture.dispose(), [texture])

  // réglages lus un par un : un objet recréé à chaque rendu ne redessine rien
  const text = spec?.text
  const sub = spec?.sub
  const ink = spec?.ink
  const logo = spec?.logo
  const family = spec?.font?.family
  const weight = spec?.font?.weight
  const mark = spec?.mark
  const finish = spec?.finish
  useEffect(() => {
    if (!spec) return
    drawPrintCanvas(canvas, { text: text ?? '', sub, ink: ink ?? '#000', logo, font: family ? { family, weight: weight ?? 800 } : undefined, mark, finish })
    texture.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, texture, text, sub, ink, logo, family, weight, mark, finish, spec === null])
  return spec ? texture : null
}
