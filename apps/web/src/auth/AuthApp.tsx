import { ADMIN_PASSWORD_MIN, safeNext, type AuthUser } from '@atelier/shared'
import { useEffect, useState, type ReactNode } from 'react'
import { telHref, whatsappLink } from '../config/brand'
import { api } from '../lib/api'
import { firstName, useAuth } from '../lib/auth'
import { loadSite, useSite } from '../lib/site'
import { Avatar } from '../ui/Avatar'
import { CheckIcon, Logo, PhoneIcon, WhatsAppIcon } from '../ui/primitives'
import { Alert, ForgotForm, GoogleButton, NewPasswordForm, RegisterForm, SignInForm, Spinner } from './forms'

type View = 'connexion' | 'inscription' | 'oubli' | 'reinitialiser'

const PATHS: Record<View, string> = {
  connexion: '/connexion',
  inscription: '/inscription',
  oubli: '/mot-de-passe-oublie',
  reinitialiser: '/reinitialiser',
}
const viewOf = (path: string): View => (Object.entries(PATHS).find(([, p]) => p === path)?.[0] as View | undefined) ?? 'connexion'

const COPY: Record<View, { kicker: string; title: string; text: string }> = {
  connexion: { kicker: 'Bon retour', title: 'Connexion', text: 'Retrouvez vos devis, vos commandes et vos fichiers.' },
  inscription: { kicker: 'Bienvenue', title: 'Créer un compte', text: 'Un compte gratuit pour suivre vos demandes de A à Z.' },
  oubli: { kicker: 'Accès au compte', title: 'Mot de passe oublié', text: 'Indiquez votre adresse : nous vous envoyons un lien sécurisé pour en choisir un nouveau.' },
  reinitialiser: { kicker: 'Sécurité', title: 'Nouveau mot de passe', text: 'Choisissez un mot de passe que vous n’utilisez nulle part ailleurs.' },
}

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'La connexion avec Google n’a pas abouti. Réessayez, ou utilisez votre adresse e-mail.',
  'google-annule': 'Connexion avec Google annulée.',
  'google-indisponible': 'La connexion avec Google n’est pas encore disponible : utilisez votre adresse e-mail.',
}

const params = new URLSearchParams(window.location.search)
const NEXT = params.get('next')
const destination = (user: AuthUser) => safeNext(NEXT, user.role === 'admin' ? '/admin' : '/compte')

/** Le jeton du lien est retiré de l'adresse (historique) mais gardé le temps de l'onglet. */
function readResetToken() {
  const fromUrl = params.get('token')
  try {
    if (fromUrl) sessionStorage.setItem('abt-reset', fromUrl)
    return fromUrl ?? sessionStorage.getItem('abt-reset') ?? ''
  } catch {
    return fromUrl ?? ''
  }
}

export default function AuthApp() {
  const [view, setView] = useState<View>(() => viewOf(window.location.pathname.replace(/\/+$/, '')))
  const [email, setEmail] = useState('')
  const user = useAuth((s) => s.user)
  const settings = useSite((s) => s.settings)
  const [error] = useState(() => GOOGLE_ERRORS[params.get('erreur') ?? ''] ?? null)

  useEffect(() => {
    document.body.style.background = '#f4f7fb'
    void loadSite()
    void useAuth.getState().load()
    const onPop = () => setView(viewOf(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    document.title = `${COPY[view].title} — ${settings.name}`
  }, [view, settings.name])

  const go = (next: View, withEmail?: string) => {
    if (withEmail !== undefined) setEmail(withEmail)
    const keep = NEXT ? `?next=${encodeURIComponent(NEXT)}` : ''
    history.pushState(null, '', PATHS[next] + keep)
    setView(next)
    window.scrollTo({ top: 0 })
  }
  const done = (u: AuthUser) => window.location.assign(destination(u))
  const copy = COPY[view]

  return (
    <div className="grid min-h-svh bg-[#f4f7fb] text-ink lg:grid-cols-[1.08fr_1fr]">
      <Showcase />
      <div className="flex min-h-svh flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <a href="/" className="lg:invisible" aria-label="Accueil">
            <Logo />
          </a>
          <a href="/" className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-ink/55 ring-1 ring-ink/10 transition hover:bg-white hover:text-ink">
            ← Retour au site
          </a>
        </header>
        <main className="grid flex-1 place-items-center py-10">
          <div className="w-full max-w-[420px]">
            {user === undefined ? (
              <div className="grid place-items-center py-24">
                <Spinner className="border-ink/20 border-t-accent" />
              </div>
            ) : user && view !== 'reinitialiser' ? (
              <AlreadySignedIn user={user} />
            ) : (
              <div key={view} className="auth-swap">
                <p className="kicker flex items-center gap-2 text-ink/45">
                  <span className="text-accent">●</span> {copy.kicker}
                </p>
                <h1 className="mt-3 font-display text-[clamp(2.2rem,4vw,2.9rem)] leading-[1.02]">{copy.title}</h1>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink/55">{copy.text}</p>
                <div className="mt-8">
                  {error && view === 'connexion' && (
                    <div className="mb-5">
                      <Alert tone="info">{error}</Alert>
                    </div>
                  )}
                  {view === 'connexion' && (
                    <>
                      <GoogleButton next={NEXT ? safeNext(NEXT, '') : ''} />
                      <SignInForm initialEmail={email} onDone={done} onForgot={(e) => go('oubli', e)} onRegister={() => go('inscription')} />
                    </>
                  )}
                  {view === 'inscription' && (
                    <>
                      <GoogleButton next={NEXT ? safeNext(NEXT, '') : ''} />
                      <RegisterForm onDone={done} onSignIn={(e) => go('connexion', e ?? email)} />
                    </>
                  )}
                  {view === 'oubli' && <ForgotForm initialEmail={email} onBack={() => go('connexion')} contact={<ContactLinks />} />}
                  {view === 'reinitialiser' && <ResetPassword onDone={done} onExpired={() => go('oubli')} />}
                </div>
              </div>
            )}
          </div>
        </main>
        <footer className="flex items-center justify-center gap-2 text-[12.5px] text-ink/40">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
          </svg>
          Connexion chiffrée · vos données ne sont jamais partagées
        </footer>
      </div>
    </div>
  )
}

/** Moitié gauche : la façade de l'atelier et ce que le compte apporte. */
function Showcase() {
  const name = useSite((s) => s.settings.name)
  return (
    <aside className="relative hidden overflow-hidden lg:block">
      <img src="/media/atelier-facade.webp" alt="" className="auth-kenburns absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-t from-[#0a1124] via-[#0a1124]/55 to-[#0a1124]/15" />
      <div className="absolute left-12 top-10">
        <a href="/" aria-label="Accueil">
          <Logo onDark />
        </a>
      </div>
      <div className="absolute inset-x-12 bottom-12 text-white">
        <p className="kicker flex items-center gap-2 text-white/70">
          <span className="colorbar inline-block h-2 w-8" /> Votre espace {name}
        </p>
        <p className="mt-4 font-display text-[clamp(2.4rem,3.6vw,3.6rem)] leading-[1.02]">
          Vos projets,
          <br />
          <em>au même endroit.</em>
        </p>
        <ul className="mt-7 grid max-w-md gap-3 text-[15px] text-white/80">
          {['Suivez vos devis, étape par étape', 'Retrouvez vos commandes et leur statut', 'Gardez vos fichiers et vos avis'].map((t, i) => (
            <li key={t} className="auth-rise flex items-center gap-3" style={{ animationDelay: `${300 + i * 120}ms` }}>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                <CheckIcon className="size-3.5" />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

function AlreadySignedIn({ user }: { user: AuthUser }) {
  return (
    <div className="auth-swap rounded-[24px] bg-white p-7 text-center shadow-[0_30px_80px_-40px_rgba(15,23,42,0.4)] ring-1 ring-ink/5">
      <Avatar user={user} className="mx-auto size-16 text-[22px]" />
      <h1 className="mt-5 font-display text-3xl">Bonjour {firstName(user)}</h1>
      <p className="mt-1.5 text-[14.5px] text-ink/55">Vous êtes connecté avec {user.email}.</p>
      <div className="mt-7 grid gap-2.5">
        <a href={destination(user)} className="btn h-12 justify-center rounded-xl bg-linear-to-r from-accent to-[#1d9bf0] text-white hover:brightness-110">
          Continuer
        </a>
        <button
          onClick={async () => {
            await useAuth.getState().logout()
          }}
          className="h-12 rounded-xl text-[14.5px] font-semibold text-ink/65 ring-1 ring-ink/12 hover:text-ink hover:ring-ink/25"
        >
          Utiliser un autre compte
        </button>
      </div>
    </div>
  )
}

function ResetPassword({ onDone, onExpired }: { onDone: (u: AuthUser) => void; onExpired: () => void }) {
  const [token] = useState(readResetToken)
  const [state, setState] = useState<{ valid: boolean; email?: string; admin?: boolean } | null>(null)
  useEffect(() => {
    if (params.get('token')) history.replaceState(null, '', PATHS.reinitialiser + (NEXT ? `?next=${encodeURIComponent(NEXT)}` : ''))
    if (!token) return setState({ valid: false })
    api.auth.checkReset(token).then(setState, () => setState({ valid: false }))
  }, [token])

  if (!state) return <Spinner className="border-ink/20 border-t-accent" />
  if (!state.valid) {
    return (
      <div className="space-y-5">
        <Alert>Ce lien n’est plus valable : il a déjà servi, ou il a expiré. Demandez-en un nouveau, il arrive en quelques secondes.</Alert>
        <button onClick={onExpired} className="btn h-12 w-full justify-center rounded-xl bg-ink text-white hover:bg-accent">
          Demander un nouveau lien
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-white px-4 py-3 text-[14px] text-ink/65 ring-1 ring-ink/8">
        Compte : <strong className="text-ink">{state.email}</strong>
      </p>
      <NewPasswordForm
        submitLabel="Enregistrer et me connecter"
        min={state.admin ? ADMIN_PASSWORD_MIN : undefined}
        onSubmit={async (next) => {
          const { user } = await api.auth.reset(token, next)
          try {
            sessionStorage.removeItem('abt-reset')
          } catch {
            /* rien */
          }
          useAuth.getState().setUser(user)
          onDone(user)
        }}
      />
    </div>
  )
}

/** Quand l'envoi d'e-mails n'est pas configuré : joindre l'atelier pour recevoir un lien. */
function ContactLinks() {
  const settings = useSite((s) => s.settings)
  const wa = whatsappLink(`Bonjour ${settings.name}, j'ai oublié le mot de passe de mon compte.`)
  const links: ReactNode[] = []
  if (wa)
    links.push(
      <a key="wa" href={wa} target="_blank" rel="noreferrer" className="btn h-11 justify-center rounded-xl bg-[#1faa59] text-[14px] text-white hover:bg-[#178a48]">
        <WhatsAppIcon className="size-4" /> WhatsApp
      </a>,
    )
  if (settings.phones[0])
    links.push(
      <a key="tel" href={telHref(settings.phones[0])} className="btn h-11 justify-center rounded-xl bg-white text-[14px] text-ink ring-1 ring-ink/12 hover:ring-ink/25">
        <PhoneIcon className="size-4" /> {settings.phones[0]}
      </a>,
    )
  return links.length ? <div className="grid gap-2 sm:grid-cols-2">{links}</div> : null
}
