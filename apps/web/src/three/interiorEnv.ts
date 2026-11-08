import * as THREE from 'three'

/**
 * Environnement de reflets de l'atelier, calculé une seule fois (en arrière-plan, pendant qu'on regarde la façade) :
 * une pièce claire, les rangées de dalles lumineuses du plafond et la lumière du jour qui entre par la vitrine.
 * Au passage de la porte, on échange simplement de texture : aucun calcul à ce moment-là, donc aucune saccade.
 */
export function buildInteriorEnvironment(gl: THREE.WebGLRenderer) {
  const scene = new THREE.Scene()
  const sphere = new THREE.SphereGeometry(60, 32, 16)
  const plane = new THREE.PlaneGeometry(1, 1)
  const materials: THREE.Material[] = []
  const light = (color: string, intensity: number) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, toneMapped: false })
    materials.push(m)
    return m
  }
  const room = new THREE.MeshBasicMaterial({ color: '#b9c2cd', side: THREE.BackSide })
  materials.push(room)
  scene.add(new THREE.Mesh(sphere, room))

  const panel = light('#ffffff', 3.2)
  for (const z of [-12, -6, 0, 6, 12])
    for (const x of [-6.5, -2.2, 2.2, 6.5]) {
      const m = new THREE.Mesh(plane, panel)
      m.position.set(x, 5.5, z)
      m.rotation.x = Math.PI / 2
      m.scale.set(1.5, 0.55, 1)
      scene.add(m)
    }
  const add = (material: THREE.Material, position: [number, number, number], rotationY: number, scale: [number, number]) => {
    const m = new THREE.Mesh(plane, material)
    m.position.set(...position)
    m.rotation.y = rotationY
    m.scale.set(scale[0], scale[1], 1)
    scene.add(m)
  }
  add(light('#eaf3ff', 1.4), [0, 2.2, 22], Math.PI, [20, 4])
  add(light('#fff3e2', 0.5), [-14, 2.5, 0], Math.PI / 2, [40, 3])

  const pmrem = new THREE.PMREMGenerator(gl)
  // Taille par défaut (256), la même que celle des reflets de la rue (Three.js ne descend pas en dessous) :
  // les shaders des matériaux en dépendent, ils restent donc identiques au passage de la porte.
  const target = pmrem.fromScene(scene, 0.02, 0.1, 100)
  pmrem.dispose()
  sphere.dispose()
  plane.dispose()
  materials.forEach((m) => m.dispose())
  return target.texture
}
