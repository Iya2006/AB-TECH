import type { AuthUser } from '@atelier/shared'
import { create } from 'zustand'
import { api } from './api'

/** Pourquoi la connexion est demandée (texte de la fenêtre, et ce qui reprend au retour de Google). */
export type AuthReason = 'devis' | 'commande' | 'avis' | 'compte'

interface AuthState {
  /** undefined : session pas encore vérifiée. */
  user: AuthUser | null | undefined
  providers: { google: boolean; mail: boolean }
  /** Fenêtre de connexion ouverte par-dessus le site. */
  prompt: { reason: AuthReason } | null
  load: () => Promise<AuthUser | null>
  setUser: (user: AuthUser | null) => void
  logout: () => Promise<void>
}

/** Action en attente d'une connexion (envoi du devis, de la commande, de l'avis). */
let waiting: ((user: AuthUser | null) => void) | null = null
let loading: Promise<AuthUser | null> | null = null

export const useAuth = create<AuthState>((set) => ({
  user: undefined,
  providers: { google: false, mail: false },
  prompt: null,
  load: () =>
    (loading ??= api.auth
      .session()
      .then((s) => {
        set({ user: s.user, providers: s.providers })
        return s.user
      })
      .catch(() => {
        set({ user: null })
        return null
      })
      .finally(() => {
        loading = null
      })),
  setUser: (user) => {
    set({ user })
    if (user && waiting) {
      const resume = waiting
      waiting = null
      set({ prompt: null })
      resume(user)
    }
  },
  logout: async () => {
    await api.auth.logout().catch(() => {})
    set({ user: null })
  },
}))

/**
 * Exige un compte avant d'enregistrer des données : renvoie le compte connecté,
 * sinon ouvre la fenêtre de connexion et attend. null si le visiteur la ferme.
 */
export async function ensureUser(reason: AuthReason): Promise<AuthUser | null> {
  const s = useAuth.getState()
  const user = s.user === undefined ? await s.load() : s.user
  if (user) return user
  return new Promise((resolve) => {
    waiting?.(null)
    waiting = resolve
    useAuth.setState({ prompt: { reason } })
  })
}

export function openSignIn(reason: AuthReason = 'compte') {
  useAuth.setState({ prompt: { reason } })
}

export function dismissSignIn() {
  useAuth.setState({ prompt: null })
  const resume = waiting
  waiting = null
  resume?.(null)
}

/* ------------------------------------------------------------------ */
/* Départ vers Google : la page est quittée, on garde les brouillons   */
/* ------------------------------------------------------------------ */

const savers = new Set<() => Promise<void> | void>()

/** Les formulaires s'inscrivent ici pour mettre leur saisie de côté avant le départ vers Google. */
export function onBeforeGoogle(save: () => Promise<void> | void) {
  savers.add(save)
  return () => {
    savers.delete(save)
  }
}

export async function continueWithGoogle(next: string) {
  await Promise.all([...savers].map((save) => Promise.resolve(save()).catch(() => {})))
  window.location.href = api.auth.googleUrl(next)
}

/** Paramètre de retour (?reprendre=devis…) : lu une fois au chargement, puis retiré de l'adresse. */
export function takeResume(): AuthReason | null {
  const url = new URL(window.location.href)
  const v = url.searchParams.get('reprendre')
  if (!v) return null
  url.searchParams.delete('reprendre')
  history.replaceState(history.state, '', url.pathname + url.search + url.hash)
  return v === 'devis' || v === 'commande' || v === 'avis' ? v : null
}

export const firstName = (user: Pick<AuthUser, 'name' | 'email'>) => (user.name.trim().split(/\s+/)[0] || user.email.split('@')[0]) ?? ''
