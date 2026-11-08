/**
 * Brouillons de formulaires gardés le temps d'un aller-retour vers Google (sessionStorage de l'onglet).
 * Lus une seule fois, puis effacés. Tout est protégé : sans stockage, on perd simplement le brouillon.
 */

const KEY = (name: string) => `abt-brouillon-${name}`

export function saveDraft(name: string, value: unknown) {
  try {
    sessionStorage.setItem(KEY(name), JSON.stringify(value))
  } catch {
    /* stockage plein ou bloqué */
  }
}

export function peekDraft<T>(name: string): T | null {
  try {
    const raw = sessionStorage.getItem(KEY(name))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function takeDraft<T>(name: string): T | null {
  try {
    const raw = sessionStorage.getItem(KEY(name))
    if (!raw) return null
    sessionStorage.removeItem(KEY(name))
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Fichier → texte (data URL), pour le garder dans un brouillon. Abandonné au-delà de `max` octets. */
export function blobToDataUrl(blob: Blob, max = 2_500_000): Promise<string | null> {
  if (blob.size > max) return Promise.resolve(null)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToFile(url: string, name: string): Promise<File | null> {
  try {
    const blob = await (await fetch(url)).blob()
    return new File([blob], name, { type: blob.type })
  } catch {
    return null
  }
}
