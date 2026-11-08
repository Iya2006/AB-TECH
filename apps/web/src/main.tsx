import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/inter-tight'
import '@fontsource-variable/jetbrains-mono'
// police « élégante » du Studio : son fichier n'est téléchargé que si le visiteur la choisit
import '@fontsource/instrument-serif/400.css'
import 'lenis/dist/lenis.css'
import './styles/index.css'

import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useApp } from './lib/store'

// Accès à l'état depuis la console en développement (diagnostic qualité 3D, etc.)
if (import.meta.env.DEV) Object.assign(window, { __app: useApp })

/* Une seule application, un seul domaine : chaque espace est chargé à la demande. */
const AdminApp = lazy(() => import('./admin/AdminApp'))
const AuthApp = lazy(() => import('./auth/AuthApp'))
const AccountApp = lazy(() => import('./account/AccountApp'))

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const AUTH_PAGES = ['/connexion', '/inscription', '/mot-de-passe-oublie', '/reinitialiser']

function Root() {
  if (path.startsWith('/admin')) return <AdminApp />
  if (AUTH_PAGES.includes(path)) return <AuthApp />
  if (path === '/compte' || path.startsWith('/compte/')) return <AccountApp />
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
)
