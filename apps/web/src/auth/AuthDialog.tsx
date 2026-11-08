import { useEffect, useRef, useState } from 'react'
import { dismissSignIn, useAuth, type AuthReason } from '../lib/auth'
import { lockScroll } from '../lib/scroll'
import { CheckIcon, CloseIcon, Logo } from '../ui/primitives'
import { ForgotForm, GoogleButton, RegisterForm, SignInForm } from './forms'

const REASONS: Record<AuthReason, { title: string; text: string; keep: boolean }> = {
  devis: { title: 'Envoyez votre demande', text: 'Connectez-vous pour envoyer votre devis : vous suivrez sa progression dans votre espace, sans rien ressaisir.', keep: true },
  commande: { title: 'Validez votre commande', text: 'Connectez-vous pour valider votre commande et suivre sa préparation jusqu’à la livraison.', keep: true },
  avis: { title: 'Publiez votre avis', text: 'Un compte permet de publier un avis authentique et de suivre sa validation.', keep: true },
  compte: { title: 'Votre espace client', text: 'Suivez vos devis, vos commandes et vos fichiers au même endroit.', keep: false },
}

type View = 'connexion' | 'inscription' | 'oubli'
const TITLES: Record<View, string> = { connexion: 'Connexion', inscription: 'Créer un compte', oubli: 'Mot de passe oublié' }

/** Fenêtre de connexion par-dessus le site : la visite 3D, le panier et le formulaire restent en place. */
export default function AuthDialog({ reason }: { reason: AuthReason }) {
  const [view, setView] = useState<View>('connexion')
  const [email, setEmail] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const r = REASONS[reason]

  useEffect(() => {
    // une autre fenêtre (panier…) a peut-être déjà bloqué le défilement : on ne le débloque pas à sa place
    const wasLocked = document.documentElement.style.overflow === 'hidden'
    if (!wasLocked) lockScroll(true)
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      dismissSignIn()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (!wasLocked) lockScroll(false)
      previous?.focus?.()
    }
  }, [])

  const done = () => useAuth.setState({ prompt: null })
  // au retour de Google, la page reprend là où le visiteur en était
  const next = reason === 'compte' ? window.location.pathname : `/?reprendre=${reason}`
  const go = (v: View, withEmail?: string) => {
    if (withEmail !== undefined) setEmail(withEmail)
    setView(v)
  }

  return (
    <div className="overlay-enter fixed inset-0 z-[95] flex overflow-y-auto bg-ink/60 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={TITLES[view]} onMouseDown={(e) => e.target === e.currentTarget && dismissSignIn()} data-lenis-prevent>
      <div ref={panel} tabIndex={-1} className="panel-enter relative m-auto grid w-full max-w-[900px] overflow-hidden rounded-[28px] bg-paper text-ink shadow-2xl outline-none md:min-h-[600px] md:grid-cols-[0.92fr_1fr]">
        <button onClick={dismissSignIn} className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/90 shadow ring-1 ring-ink/10 transition hover:rotate-90 hover:bg-white" aria-label="Fermer">
          <CloseIcon className="size-5" />
        </button>

        {/* pourquoi on demande un compte */}
        <div className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-[radial-gradient(ellipse_at_20%_0%,#1c3f9e,#0a1124_70%)] p-9 text-white md:flex">
          <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/30 blur-3xl" />
          <Logo onDark />
          <div className="relative">
            <p className="kicker flex items-center gap-2 text-white/60">
              <span className="colorbar inline-block h-1.5 w-7" /> Espace client
            </p>
            <p className="mt-4 font-display text-[2.3rem] leading-[1.02]">{r.title}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">{r.text}</p>
            <ul className="mt-7 grid gap-2.5 text-[14px] text-white/80">
              {['Suivi de vos devis et commandes', 'Vos fichiers et vos avis conservés', 'Gratuit, sans engagement'].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <CheckIcon className="size-4 text-accent-2" /> {t}
                </li>
              ))}
            </ul>
          </div>
          {r.keep ? <p className="relative text-[12.5px] text-white/50">Votre saisie est conservée : vous reprenez exactement où vous en étiez.</p> : <span />}
        </div>

        <div className="p-6 pt-16 sm:p-9 sm:pt-14 md:pt-12">
          <div key={view} className="auth-swap">
            <p className="kicker text-accent md:hidden">{r.title}</p>
            <h2 className="mt-1 font-display text-[2.2rem] leading-[1.02]">{TITLES[view]}</h2>
            <p className="mb-7 mt-2 text-[14.5px] leading-relaxed text-ink/55 md:hidden">{r.text}</p>
            <div className="md:mt-7">
              {view === 'connexion' && (
                <>
                  <GoogleButton next={next} />
                  <SignInForm initialEmail={email} onDone={done} onForgot={(e) => go('oubli', e)} onRegister={() => go('inscription')} />
                </>
              )}
              {view === 'inscription' && (
                <>
                  <GoogleButton next={next} />
                  <RegisterForm onDone={done} onSignIn={(e) => go('connexion', e ?? email)} />
                </>
              )}
              {view === 'oubli' && <ForgotForm initialEmail={email} onBack={() => go('connexion')} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
