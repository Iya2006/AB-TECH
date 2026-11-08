import { lazy, Suspense } from 'react'
import { useAuth } from '../lib/auth'

const AuthDialog = lazy(() => import('../auth/AuthDialog'))

/** Fenêtre de connexion du site, chargée seulement quand elle s'ouvre. */
export function AuthPrompt() {
  const prompt = useAuth((s) => s.prompt)
  if (!prompt) return null
  return (
    <Suspense fallback={null}>
      <AuthDialog reason={prompt.reason} />
    </Suspense>
  )
}
