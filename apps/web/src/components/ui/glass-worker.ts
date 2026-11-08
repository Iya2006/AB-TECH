/*
 * Le verre de l'écran de chargement, dessiné hors du fil principal (OffscreenCanvas) : pendant que la page
 * prépare la visite 3D (textures, géométries, compilation), son animation continue d'avancer sans à-coup.
 */
import { runEngine, type Engine, type EngineLive } from './glass-engine'

type Size = { cw: number; ch: number; dpr: number }

export type ToWorker =
  | { type: 'init'; canvas: OffscreenCanvas; live: EngineLive; size: Size; reduceMotion: boolean }
  | { type: 'live'; live: EngineLive }
  | { type: 'size'; size: Size }
  | { type: 'visible'; visible: boolean }
  | { type: 'logo'; image: ImageBitmap; sdf: Float32Array }
  | { type: 'replay' }
  | { type: 'dispose' }

export type FromWorker = 'start' | 'cue' | 'end' | 'fail'

const scope = self as unknown as {
  postMessage(message: FromWorker): void
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null
  close(): void
}

let engine: Engine | null = null
let live: EngineLive | null = null
let size: Size = { cw: 1, ch: 1, dpr: 1 }
let visible = false

scope.onmessage = ({ data: m }) => {
  switch (m.type) {
    case 'init': {
      live = m.live
      size = m.size
      const canvas = m.canvas
      engine = runEngine(canvas, {
        live: () => live!,
        size: () => size,
        reduceMotion: m.reduceMotion,
        onStart: () => scope.postMessage('start'),
        onCue: () => scope.postMessage('cue'),
        onEnd: () => scope.postMessage('end'),
        onFail: () => scope.postMessage('fail'),
      })
      if (!engine) {
        scope.postMessage('fail')
        return
      }
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        engine?.contextLost()
      })
      canvas.addEventListener('webglcontextrestored', () => engine?.contextRestored())
      engine.setVisible(visible)
      return
    }
    case 'live':
      live = m.live
      engine?.invalidate()
      return
    case 'size':
      size = m.size
      engine?.invalidate()
      return
    case 'visible':
      visible = m.visible
      engine?.setVisible(visible)
      return
    case 'logo':
      engine?.setLogo({ image: m.image, sdf: m.sdf, premultiplied: true })
      return
    case 'replay':
      engine?.replay()
      return
    case 'dispose':
      engine?.dispose()
      engine = null
      scope.close()
  }
}
