/**
 * Travaux lourds étalés : une tâche à la fois, quand le navigateur a du temps libre entre deux images.
 * Le défilement, les animations et la 3D passent toujours en premier ; au pire, une tâche attend 1,5 s.
 */
type Job = () => void

const queue: Job[] = []
let scheduled = false

function later(cb: () => void) {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: 1500 })
  else window.setTimeout(cb, 32)
}

function pump() {
  if (scheduled || !queue.length) return
  scheduled = true
  later(() => {
    scheduled = false
    queue.shift()?.()
    pump()
  })
}

/** Exécute `job` au prochain moment de calme (après les tâches déjà en attente). */
export function whenIdle<T>(job: () => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      try {
        Promise.resolve(job()).then(resolve, reject)
      } catch (err) {
        reject(err)
      }
    })
    pump()
  })
}
