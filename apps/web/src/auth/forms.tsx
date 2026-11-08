import { PASSWORD_MIN, type AuthUser } from '@atelier/shared'
import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import { continueWithGoogle, useAuth } from '../lib/auth'
import { ArrowRight, CheckIcon } from '../ui/primitives'

export const authInput =
  'mt-1.5 h-12 w-full rounded-xl bg-[#f4f7fb] px-3.5 text-[15.5px] text-ink ring-1 ring-ink/10 outline-none transition placeholder:text-ink/35 focus:bg-white focus:ring-2 focus:ring-accent aria-[invalid=true]:ring-rose-400'

const errorOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez.')
const fieldErrors = (err: unknown): Record<string, string> =>
  err instanceof ApiError && err.issues ? Object.fromEntries(Object.entries(err.issues).map(([k, v]) => [k, v?.[0] ?? ''])) : {}

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

export function GoogleIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  )
}

/** « Continuer avec Google » : affiché seulement si la connexion Google est configurée sur le serveur. */
export function GoogleButton({ next }: { next: string }) {
  const google = useAuth((s) => s.providers.google)
  const [busy, setBusy] = useState(false)
  if (!google) return null
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void continueWithGoogle(next)
        }}
        className="group flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-semibold text-ink ring-1 ring-ink/15 transition hover:ring-ink/30 hover:shadow-[0_8px_24px_-14px_rgba(10,16,32,0.5)] active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? <Spinner className="border-ink/30 border-t-ink" /> : <GoogleIcon />}
        Continuer avec Google
      </button>
      <div className="my-6 flex items-center gap-4 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink/35" role="separator">
        <span className="h-px flex-1 bg-ink/10" /> ou <span className="h-px flex-1 bg-ink/10" />
      </div>
    </>
  )
}

export function Spinner({ className = 'border-white/40 border-t-white' }: { className?: string }) {
  return <span className={`size-4 animate-spin rounded-full border-2 ${className}`} aria-hidden />
}

function Label({ htmlFor, children, aside }: { htmlFor: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink/70">
        {children}
      </label>
      {aside}
    </div>
  )
}

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null
  return (
    <p id={id} className="mt-1.5 text-[13px] text-rose-600">
      {children}
    </p>
  )
}

export function TextField({
  label,
  error,
  aside,
  ...input
}: { label: string; error?: string; aside?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id} aside={aside}>
        {label}
      </Label>
      <input id={id} className={authInput} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} {...input} />
      <FieldError id={`${id}-e`}>{error}</FieldError>
    </div>
  )
}

/** Note de 0 à 4 (longueur, majuscules, chiffres, symboles). */
export function passwordScore(pw: string) {
  if (pw.length < PASSWORD_MIN) return 0
  let s = 1
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(4, s)
}
const STRENGTH = ['Trop court', 'Faible', 'Correct', 'Solide', 'Excellent']
const STRENGTH_COLOR = ['bg-ink/15', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']

export function PasswordField({
  label = 'Mot de passe',
  value,
  onChange,
  error,
  meter = false,
  autoComplete = 'current-password',
  aside,
  min = PASSWORD_MIN,
  autoFocus,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  error?: string
  meter?: boolean
  autoComplete?: string
  aside?: ReactNode
  min?: number
  autoFocus?: boolean
}) {
  const id = useId()
  const [show, setShow] = useState(false)
  const score = value.length < min ? 0 : passwordScore(value)
  return (
    <div>
      <Label htmlFor={id} aside={aside}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={`${authInput} pr-24`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-e` : meter ? `${id}-m` : undefined}
          autoFocus={autoFocus}
          maxLength={200}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 mt-[3px] -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-ink/55 hover:bg-ink/5 hover:text-ink"
          aria-pressed={show}
        >
          {show ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {meter && (
        <div id={`${id}-m`} className="mt-2 flex items-center gap-3" aria-live="polite">
          <div className="grid flex-1 grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1.5 rounded-full transition-colors duration-300 ${score >= i ? STRENGTH_COLOR[score] : 'bg-ink/10'}`} />
            ))}
          </div>
          <span className="w-20 text-right text-[12px] font-semibold text-ink/50">{value ? (value.length < min ? `${min} car. min.` : STRENGTH[score]) : `${min} car. min.`}</span>
        </div>
      )}
      <FieldError id={`${id}-e`}>{error}</FieldError>
    </div>
  )
}

export function SubmitButton({ busy, children, disabled }: { busy: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      disabled={busy || disabled}
      className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-linear-to-r from-accent to-[#1d9bf0] text-[15px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(37,99,235,0.9)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-55"
    >
      {busy ? <Spinner /> : children}
      {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
    </button>
  )
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'ok'; children: ReactNode }) {
  const cls = { error: 'bg-rose-50 text-rose-700 ring-rose-200', info: 'bg-accent-soft text-ink ring-accent/20', ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }[tone]
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`auth-swap flex gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] leading-snug ring-1 ${cls}`}>
      {tone === 'ok' && <CheckIcon className="mt-px size-4 shrink-0" />}
      <span>{children}</span>
    </p>
  )
}

const linkCls = 'font-semibold text-accent underline-offset-4 hover:underline'

/* ------------------------------------------------------------------ */
/* Formulaires                                                         */
/* ------------------------------------------------------------------ */

export function SignInForm({ onDone, onForgot, onRegister, initialEmail = '' }: { onDone: (u: AuthUser) => void; onForgot: (email: string) => void; onRegister: () => void; initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { user } = await api.auth.login(email.trim(), password)
      useAuth.getState().setUser(user)
      onDone(user)
    } catch (err) {
      setError(errorOf(err))
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!initialEmail} required />
      <PasswordField
        value={password}
        onChange={setPassword}
        autoFocus={!!initialEmail}
        aside={
          <button type="button" onClick={() => onForgot(email)} className="text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
            Mot de passe oublié ?
          </button>
        }
      />
      {error && <Alert>{error}</Alert>}
      <div className="pt-2">
        <SubmitButton busy={busy} disabled={!email || !password}>
          Se connecter
        </SubmitButton>
      </div>
      <p className="pt-2 text-center text-[14px] text-ink/60">
        Vous n’avez pas encore de compte ?{' '}
        <button type="button" onClick={onRegister} className={linkCls}>
          Créer un compte
        </button>
      </p>
    </form>
  )
}

export function RegisterForm({ onDone, onSignIn }: { onDone: (u: AuthUser) => void; onSignIn: (email?: string) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', website: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { user } = await api.auth.register({ ...form, email: form.email.trim() })
      useAuth.getState().setUser(user)
      onDone(user)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors(fields)
      if (!Object.values(fields).some(Boolean)) setError(errorOf(err))
      setBusy(false)
    }
  }
  const exists = errors.email?.includes('existe déjà')
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Nom complet" autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} error={errors.name} autoFocus maxLength={80} />
      <TextField label="Adresse e-mail" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => set('email')(e.target.value)} error={exists ? undefined : errors.email} />
      {exists && (
        <Alert tone="info">
          Un compte existe déjà avec cette adresse.{' '}
          <button type="button" onClick={() => onSignIn(form.email)} className={linkCls}>
            Se connecter
          </button>
        </Alert>
      )}
      <PasswordField value={form.password} onChange={set('password')} error={errors.password} meter autoComplete="new-password" />
      {/* champ piège anti-robots */}
      <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website')(e.target.value)} className="absolute -left-[9999px] size-px opacity-0" aria-hidden />
      {error && <Alert>{error}</Alert>}
      <div className="pt-2">
        <SubmitButton busy={busy} disabled={!form.name || !form.email || form.password.length < PASSWORD_MIN}>
          Créer mon compte
        </SubmitButton>
      </div>
      <p className="text-center text-[12.5px] leading-relaxed text-ink/45">Vos informations servent uniquement à traiter vos devis, commandes et avis.</p>
      <p className="text-center text-[14px] text-ink/60">
        Déjà un compte ?{' '}
        <button type="button" onClick={() => onSignIn()} className={linkCls}>
          Se connecter
        </button>
      </p>
    </form>
  )
}

export function ForgotForm({ onBack, initialEmail = '', contact }: { onBack: () => void; initialEmail?: string; contact?: ReactNode }) {
  const mail = useAuth((s) => s.providers.mail)
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.auth.forgot(email.trim())
      setSent(true)
    } catch (err) {
      setError(errorOf(err))
    } finally {
      setBusy(false)
    }
  }
  if (sent) {
    return (
      <div className="space-y-5">
        {mail ? (
          <Alert tone="ok">
            Si un compte existe pour <strong>{email.trim()}</strong>, un e-mail vient de partir avec un lien pour choisir un nouveau mot de passe. Il est valable une heure.
          </Alert>
        ) : (
          <Alert tone="info">L’envoi d’e-mails n’est pas encore activé sur le site. Contactez-nous : nous vous transmettons un lien sécurisé pour choisir un nouveau mot de passe.</Alert>
        )}
        {!mail && contact}
        <p className="text-[13px] leading-relaxed text-ink/50">Pensez à regarder dans les courriers indésirables. Votre mot de passe actuel n’est jamais envoyé : vous en choisissez un nouveau.</p>
        <button type="button" onClick={onBack} className="h-12 w-full rounded-xl text-[15px] font-semibold text-ink ring-1 ring-ink/15 hover:ring-ink/30">
          Retour à la connexion
        </button>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Adresse e-mail du compte" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      {error && <Alert>{error}</Alert>}
      <div className="pt-2">
        <SubmitButton busy={busy} disabled={!email}>
          Recevoir un lien
        </SubmitButton>
      </div>
      <p className="text-center text-[14px] text-ink/60">
        <button type="button" onClick={onBack} className={linkCls}>
          ← Retour à la connexion
        </button>
      </p>
    </form>
  )
}

/** Nouveau mot de passe (lien de réinitialisation, ou premier changement obligatoire). */
export function NewPasswordForm({
  submitLabel,
  min = PASSWORD_MIN,
  needCurrent = false,
  onSubmit,
}: {
  submitLabel: string
  min?: number
  needCurrent?: boolean
  onSubmit: (next: string, current?: string) => Promise<void>
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mismatch = confirm.length > 0 && confirm !== next
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return setErrors({ confirm: 'Les deux mots de passe ne correspondent pas' })
    setBusy(true)
    setError(null)
    setErrors({})
    try {
      await onSubmit(next, needCurrent ? current : undefined)
    } catch (err) {
      const fields = fieldErrors(err)
      setErrors({ current: fields.current ?? '', next: fields.next ?? fields.password ?? '' })
      if (!fields.current && !fields.next && !fields.password) setError(errorOf(err))
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {needCurrent && <PasswordField label="Mot de passe actuel" value={current} onChange={setCurrent} error={errors.current} autoFocus />}
      <PasswordField label="Nouveau mot de passe" value={next} onChange={setNext} error={errors.next} meter min={min} autoComplete="new-password" autoFocus={!needCurrent} />
      <PasswordField label="Confirmez le mot de passe" value={confirm} onChange={setConfirm} error={errors.confirm || (mismatch ? 'Les deux mots de passe ne correspondent pas' : undefined)} min={min} autoComplete="new-password" />
      {error && <Alert>{error}</Alert>}
      <div className="pt-2">
        <SubmitButton busy={busy} disabled={next.length < min || next !== confirm || (needCurrent && !current)}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  )
}
