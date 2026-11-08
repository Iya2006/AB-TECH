import { useThree } from '@react-three/fiber'
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { precompile, texturesOf } from './precompile'
import { uploadSoon } from './textureQueue'

/**
 * Préparer un objet avant de le montrer. Le premier dessin d'une matière neuve compile ses shaders sur-le-champ :
 * l'écran se fige (jusqu'à plusieurs centaines de millisecondes par matière sur une carte graphique intégrée).
 * Ici, l'objet reste caché le temps que la carte graphique compile en tâche de fond, puis que ses textures
 * montent, une par image ; il apparaît ensuite, prêt.
 *
 * Un objet monté en même temps que son groupe parent est préparé avec lui (une seule compilation) ;
 * seul ce qui arrive après (modèle 3D ou photo encore en téléchargement) se prépare de son côté.
 */

interface Scope {
  /** Hors de la scène de la visite (aperçus produit…) : rien à préparer, on montre tout de suite. */
  enabled: boolean
  /** La scène est dessinée dans une image intermédiaire (post-traitement) : variante de shaders correspondante. */
  offscreen: boolean
  /** Le groupe a déjà lancé sa préparation : ce qui arrive maintenant n'en fait pas partie. */
  started: boolean
}

const WarmContext = createContext<Scope>({ enabled: false, offscreen: false, started: true })

export function WarmRoot({ offscreen, children }: { offscreen: boolean; children: ReactNode }) {
  const scope = useMemo<Scope>(() => ({ enabled: true, offscreen, started: true }), [offscreen])
  return <WarmContext.Provider value={scope}>{children}</WarmContext.Provider>
}

/** Attend que les reflets de la scène soient en place : les shaders en dépendent. */
function whenEnvironment(scene: THREE.Scene) {
  return new Promise<void>((resolve) => {
    const check = () => (scene.environment ? resolve() : requestAnimationFrame(check))
    check()
  })
}

/** `onCompile` : appelé dès la compilation lancée (la part bloquante est faite, le reste suit en tâche de fond). */
export function useWarm(ref: RefObject<THREE.Object3D | null>, onWarm?: () => void, onCompile?: () => void) {
  const parent = useContext(WarmContext)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const [warm, setWarm] = useState(() => !parent.enabled || !parent.started)
  const scope = useMemo<Scope>(() => ({ enabled: parent.enabled, offscreen: parent.offscreen, started: false }), [parent])
  const callback = useRef(onWarm)
  callback.current = onWarm

  useLayoutEffect(() => {
    scope.started = true
    const group = ref.current
    if (warm || !group) {
      callback.current?.()
      return
    }
    let off = false
    whenEnvironment(scene)
      .then(() => {
        if (off) return
        const compiling = precompile(gl, group, camera, scene, parent.offscreen)
        onCompile?.()
        return compiling
      })
      .catch(() => undefined)
      .then(() => (off ? undefined : uploadSoon(texturesOf(group))))
      .then(() => {
        if (off) return
        setWarm(true)
        callback.current?.()
      })
    return () => {
      off = true
    }
    // préparation unique, au montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { warm, scope, Provider: WarmContext.Provider }
}

/** Groupe invisible tant qu'il n'est pas prêt (voir useWarm). */
export function Warm({ children, onWarm }: { children: ReactNode; onWarm?: () => void }) {
  const ref = useRef<THREE.Group>(null)
  const { warm, scope, Provider } = useWarm(ref, onWarm)
  return (
    <Provider value={scope}>
      <group ref={ref} visible={warm}>
        {children}
      </group>
    </Provider>
  )
}
