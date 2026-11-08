import { SERVICES, type AccountActivity, type AuthUser, type Order, type OrderStatus, type QuoteRecord, type QuoteStatus, type ReviewStatus } from '@atelier/shared'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, authInput, NewPasswordForm, Spinner, TextField } from '../auth/forms'
import { formatPrice } from '../config/brand'
import { api, ApiError } from '../lib/api'
import { firstName, useAuth } from '../lib/auth'
import { loadSite, useSite } from '../lib/site'
import { Avatar } from '../ui/Avatar'
import { thumbUrl } from '../ui/img'
import { ArrowRight, CheckIcon, Logo, UploadIcon } from '../ui/primitives'
import { Stars } from '../ui/shop'

type Tab = 'profil' | 'devis' | 'commandes' | 'fichiers' | 'avis' | 'securite'

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'profil', label: 'Mon profil', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0' },
  { id: 'devis', label: 'Mes devis', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
  { id: 'commandes', label: 'Mes commandes', icon: 'M5 8h14l-1.2 12H6.2L5 8Zm4 0V6a3 3 0 0 1 6 0v2' },
  { id: 'fichiers', label: 'Mes fichiers', icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5' },
  { id: 'avis', label: 'Mes avis', icon: 'M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.8L12 3Z' },
  { id: 'securite', label: 'Sécurité', icon: 'M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z' },
]
const readTab = (): Tab => {
  const h = window.location.hash.replace(/^#\/?/, '') as Tab
  return TABS.some((t) => t.id === h) ? h : 'profil'
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const ref = (id: string) => id.slice(0, 8).toUpperCase()
const serviceTitle = (slug: string) => SERVICES.find((s) => s.slug === slug)?.title ?? slug

function Icon({ d, className = 'size-5' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

/** Espace client : profil, historique (devis, commandes, fichiers, avis) et sécurité du compte. */
export default function AccountApp() {
  const user = useAuth((s) => s.user)
  const name = useSite((s) => s.settings.name)
  const [tab, setTab] = useState<Tab>(readTab)
  const [activity, setActivity] = useState<AccountActivity | null>(null)

  useEffect(() => {
    document.body.style.background = '#f4f7fb'
    void loadSite()
    void useAuth.getState().load()
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    document.title = `Mon compte — ${name}`
  }, [name])
  useEffect(() => {
    if (user === null) window.location.replace(`/connexion?next=${encodeURIComponent('/compte' + window.location.hash)}`)
    if (user) api.account.activity().then(setActivity, () => setActivity({ quotes: [], orders: [], reviews: [] }))
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user)
    return (
      <div className="grid min-h-svh place-items-center bg-[#f4f7fb]">
        <Spinner className="border-ink/15 border-t-accent" />
      </div>
    )

  const go = (t: Tab) => {
    history.replaceState(null, '', `#${t}`)
    setTab(t)
  }
  const files = activity ? filesOf(activity.quotes) : []
  const count: Partial<Record<Tab, number>> = activity
    ? { devis: activity.quotes.length, commandes: activity.orders.length, fichiers: files.length, avis: activity.reviews.length }
    : {}

  return (
    <div className="min-h-svh bg-[radial-gradient(ellipse_80%_40%_at_70%_0%,#e6efff,#f4f7fb_60%)] pb-20 text-ink">
      <header className="sticky top-0 z-40 px-3 pt-3 md:px-5">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 rounded-2xl bg-[linear-gradient(180deg,#121b36,#0a1124)] pl-5 pr-2 text-white shadow-[0_18px_50px_-24px_rgba(5,10,24,0.9)] ring-1 ring-white/[0.09]">
          <a href="/" aria-label="Accueil">
            <Logo onDark />
          </a>
          <span className="ml-1 hidden rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-white/75 sm:inline">Mon compte</span>
          <div className="ml-auto flex items-center gap-1.5">
            {user.role === 'admin' && (
              <a href="/admin" className="hidden h-10 items-center rounded-xl bg-linear-to-r from-accent to-[#1d9bf0] px-4 text-[13.5px] font-semibold sm:inline-flex">
                Administration
              </a>
            )}
            <a href="/" className="flex h-10 items-center rounded-xl px-3.5 text-[13.5px] font-semibold text-white/75 hover:bg-white/10 hover:text-white">
              Retour au site
            </a>
            <Avatar user={user} className="size-9 text-[14px] ring-2 ring-white/20" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 md:px-6">
        {/* en-tête : le client et son activité */}
        <section className="admin-enter flex flex-wrap items-end justify-between gap-6 pb-8 pt-10 md:pt-14">
          <div className="flex items-center gap-5">
            <Avatar user={user} className="size-16 text-[24px] ring-4 ring-white md:size-20" />
            <div>
              <p className="kicker flex items-center gap-2 text-ink/45">
                <span className="text-accent">●</span> {user.role === 'admin' ? 'Administrateur' : 'Espace client'}
              </p>
              <h1 className="mt-2 font-display text-[clamp(2.1rem,4vw,3.2rem)] leading-[1.02]">Bonjour {firstName(user)}</h1>
              <p className="mt-1 text-[14px] text-ink/50">Membre depuis le {fmtDate(user.createdAt)}</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-3 gap-3 sm:w-auto">
            {(['devis', 'commandes', 'avis'] as const).map((t) => (
              <button key={t} onClick={() => go(t)} className="rounded-2xl bg-white px-5 py-3.5 text-left shadow-[0_18px_40px_-34px_rgba(10,16,32,0.6)] ring-1 ring-ink/[0.06] transition hover:-translate-y-0.5 hover:ring-accent/30">
                <span className="block font-display text-3xl leading-none">{count[t] ?? '–'}</span>
                <span className="mt-1.5 block text-[12.5px] font-semibold text-ink/50">{TABS.find((x) => x.id === t)!.label.replace('Mes ', '')}</span>
              </button>
            ))}
          </div>
        </section>

        {user.mustChangePassword && (
          <div className="mb-6">
            <Alert tone="info">
              Votre mot de passe est encore celui fourni à la livraison.{' '}
              <button onClick={() => go('securite')} className="font-semibold text-accent underline-offset-4 hover:underline">
                Choisissez le vôtre
              </button>
              .
            </Alert>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0" aria-label="Mon compte">
            {TABS.map((t) => {
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => go(t.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[14px] font-semibold transition ${on ? 'bg-ink text-white shadow-[0_12px_30px_-16px_rgba(10,16,32,0.8)]' : 'text-ink/60 hover:bg-white hover:text-ink'}`}
                >
                  <Icon d={t.icon} className="size-[18px]" />
                  <span className="flex-1 whitespace-nowrap">{t.label}</span>
                  {!!count[t.id] && <span className={`min-w-6 rounded-full px-1.5 text-center font-mono text-[11px] ${on ? 'bg-white/20' : 'bg-ink/[0.07]'}`}>{count[t.id]}</span>}
                </button>
              )
            })}
            <button
              onClick={async () => {
                await useAuth.getState().logout()
                window.location.assign('/')
              }}
              className="flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[14px] font-semibold text-rose-600 transition hover:bg-rose-50 lg:mt-4"
            >
              <Icon d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" className="size-[18px]" /> Déconnexion
            </button>
          </nav>

          <div key={tab} className="admin-page min-w-0">
            {tab === 'profil' && <Profile user={user} />}
            {tab === 'devis' && <Quotes list={activity?.quotes} />}
            {tab === 'commandes' && <Orders list={activity?.orders} />}
            {tab === 'fichiers' && <Files list={activity ? files : undefined} />}
            {tab === 'avis' && <Reviews list={activity?.reviews} />}
            {tab === 'securite' && <Security user={user} />}
          </div>
        </div>
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

function Panel({ title, text, children, action }: { title: string; text?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white p-5 shadow-[0_24px_60px_-42px_rgba(10,16,32,0.45)] ring-1 ring-ink/[0.06] md:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl leading-tight md:text-[1.75rem]">{title}</h2>
          {text && <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-ink/55">{text}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Loading() {
  return (
    <div className="grid place-items-center rounded-[24px] bg-white p-16 ring-1 ring-ink/[0.06]">
      <Spinner className="border-ink/15 border-t-accent" />
    </div>
  )
}

function EmptyState({ icon, title, text, cta, href }: { icon: string; title: string; text: string; cta: string; href: string }) {
  return (
    <div className="grid place-items-center rounded-[24px] border border-dashed border-ink/15 bg-white/60 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon d={icon} className="size-6" />
      </span>
      <h2 className="mt-5 font-display text-2xl">{title}</h2>
      <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink/55">{text}</p>
      <a href={href} className="btn btn-ink mt-6 h-11">
        {cta} <ArrowRight className="size-4" />
      </a>
    </div>
  )
}

const TONES = {
  accent: 'bg-accent-soft text-accent ring-accent/20',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  ok: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  neutral: 'bg-ink/[0.05] text-ink/60 ring-ink/10',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
} as const
function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`kicker inline-flex items-center rounded-full px-2.5 py-1 !text-[10.5px] ring-1 ${TONES[tone]}`}>{children}</span>
}

/** Suivi en étapes (reçue → en cours → terminée). */
function Steps({ steps, current, cancelled }: { steps: string[]; current: number; cancelled?: boolean }) {
  return (
    <ol className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const done = !cancelled && i <= current
        return (
          <li key={s}>
            <span className={`block h-1.5 rounded-full transition-colors duration-700 ${done ? 'bg-linear-to-r from-accent to-accent-2' : 'bg-ink/[0.08]'}`} />
            <span className={`mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold ${done ? 'text-ink' : 'text-ink/40'}`}>
              {done && i < current && <CheckIcon className="size-3.5 text-accent" />}
              {s}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

function Profile({ user }: { user: AuthUser }) {
  const [form, setForm] = useState({ name: user.name, phone: user.phone })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const dirty = form.name !== user.name || form.phone !== user.phone

  const save = async () => {
    setSaving(true)
    setError(null)
    setErrors({})
    try {
      useAuth.getState().setUser(await api.account.saveProfile({ ...form, avatarUrl: user.avatarUrl }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      if (err instanceof ApiError && err.issues) setErrors(Object.fromEntries(Object.entries(err.issues).map(([k, v]) => [k, v?.[0] ?? ''])))
      else setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError('Formats acceptés : PNG, JPG, WEBP.')
    setPhotoBusy(true)
    setError(null)
    try {
      useAuth.getState().setUser(await api.account.uploadAvatar(file))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible.')
    } finally {
      setPhotoBusy(false)
    }
  }
  const removePhoto = async () => {
    try {
      useAuth.getState().setUser(await api.account.saveProfile({ ...form, avatarUrl: '' }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    }
  }

  return (
    <Panel title="Mon profil" text="Ces informations pré-remplissent vos devis et vos commandes. Vous pouvez toujours les modifier au moment de l’envoi.">
      <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-[#f4f7fb] p-4 ring-1 ring-ink/[0.05]">
        <button type="button" onClick={() => input.current?.click()} className="group relative rounded-full" aria-label="Changer la photo de profil">
          <Avatar user={user} className="size-20 text-[28px]" />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/55 text-white opacity-0 transition group-hover:opacity-100">
            {photoBusy ? <Spinner /> : <UploadIcon className="size-5" />}
          </span>
        </button>
        <div className="text-[14px]">
          <p className="font-semibold">Photo de profil</p>
          <p className="mt-0.5 text-ink/50">PNG, JPG ou WEBP · 5 Mo maximum</p>
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => input.current?.click()} className="font-semibold text-accent underline-offset-4 hover:underline">
              {user.avatarUrl ? 'Changer' : 'Ajouter une photo'}
            </button>
            {user.avatarUrl && (
              <button type="button" onClick={removePhoto} className="font-semibold text-ink/50 underline-offset-4 hover:text-rose-600 hover:underline">
                Retirer
              </button>
            )}
          </div>
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <TextField label="Nom complet" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} autoComplete="name" maxLength={80} />
        <TextField label="Téléphone / WhatsApp" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} error={errors.phone} autoComplete="tel" placeholder="ex. 07 00 00 00 00" />
        <div className="sm:col-span-2">
          <p className="text-[13px] font-semibold text-ink/70">Adresse e-mail</p>
          <div className={`${authInput} flex items-center justify-between gap-3 !bg-ink/[0.03] text-ink/60`}>
            <span className="truncate">{user.email}</span>
            {user.google && <Badge tone="neutral">Google</Badge>}
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink/45">Elle sert à vous connecter et à recevoir vos liens de sécurité.</p>
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-6 flex items-center gap-4">
        <button onClick={save} disabled={!dirty || saving} className="btn btn-ink h-11 disabled:opacity-35">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && (
          <span className="auth-swap flex items-center gap-1.5 text-[14px] font-semibold text-emerald-700">
            <CheckIcon className="size-4" /> Profil mis à jour
          </span>
        )}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Devis                                                               */
/* ------------------------------------------------------------------ */

const QUOTE: Record<QuoteStatus, { label: string; tone: keyof typeof TONES; step: number }> = {
  nouveau: { label: 'Reçue', tone: 'accent', step: 0 },
  en_cours: { label: 'En cours', tone: 'warn', step: 1 },
  traite: { label: 'Traitée', tone: 'ok', step: 2 },
}

function Quotes({ list }: { list?: QuoteRecord[] }) {
  if (!list) return <Loading />
  if (!list.length)
    return <EmptyState icon={TABS[1]!.icon} title="Aucun devis pour l’instant" text="Décrivez votre projet : nous vous répondons rapidement, et vous suivez ici chaque étape." cta="Demander un devis" href="/?reprendre=devis" />
  return (
    <Panel title="Mes devis" text="Chaque demande, son avancement et les fichiers joints.">
      <ul className="grid gap-4">
        {list.map((q) => {
          const s = QUOTE[q.status]
          return (
            <li key={q.id} className="rounded-2xl p-5 ring-1 ring-ink/[0.08] transition hover:ring-ink/15">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={s.tone}>{s.label}</Badge>
                <span className="font-mono text-[12px] text-ink/45">
                  n° {ref(q.id)} · {fmtDate(q.createdAt)}
                </span>
              </div>
              <h3 className="mt-3 text-[18px] font-bold">
                {serviceTitle(q.service)}
                {q.quantity ? <span className="font-medium text-ink/50"> · {q.quantity} ex.</span> : null}
              </h3>
              <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink/65">{q.message}</p>
              {(q.logoUrl || q.mockupUrl) && (
                <div className="mt-4 flex gap-2">
                  {[q.mockupUrl, q.logoUrl].filter(Boolean).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="size-16 overflow-hidden rounded-xl bg-[#f4f7fb] ring-1 ring-ink/10">
                      <img src={thumbUrl(u!, 200)} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <Steps steps={['Reçue', 'En cours', 'Traitée']} current={s.step} />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

const ORDER: Record<OrderStatus, { label: string; tone: keyof typeof TONES; step: number }> = {
  nouvelle: { label: 'Reçue', tone: 'accent', step: 0 },
  confirmee: { label: 'Confirmée', tone: 'warn', step: 1 },
  livree: { label: 'Livrée', tone: 'ok', step: 2 },
  annulee: { label: 'Annulée', tone: 'danger', step: -1 },
}

function Orders({ list }: { list?: Order[] }) {
  const [view, setView] = useState<'cours' | 'historique'>('cours')
  if (!list) return <Loading />
  if (!list.length) return <EmptyState icon={TABS[2]!.icon} title="Aucune commande" text="Les produits de la boutique se commandent en quelques clics ; nous vous rappelons pour confirmer." cta="Voir la boutique" href="/" />
  const open = list.filter((o) => o.status === 'nouvelle' || o.status === 'confirmee')
  const past = list.filter((o) => o.status === 'livree' || o.status === 'annulee')
  const shown = view === 'cours' ? open : past
  return (
    <Panel
      title="Mes commandes"
      text="Nous vous appelons pour confirmer la disponibilité et la livraison."
      action={
        <div className="flex gap-1 rounded-full bg-[#f4f7fb] p-1 ring-1 ring-ink/[0.06]">
          {(
            [
              ['cours', `En cours · ${open.length}`],
              ['historique', `Historique · ${past.length}`],
            ] as const
          ).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${view === v ? 'bg-white text-ink shadow-sm' : 'text-ink/50 hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-[#f4f7fb] p-6 text-center text-[14px] text-ink/50">{view === 'cours' ? 'Aucune commande en cours.' : 'Aucune commande terminée.'}</p>
      ) : (
        <ul className="grid gap-4">
          {shown.map((o) => {
            const s = ORDER[o.status]
            return (
              <li key={o.id} className="rounded-2xl p-5 ring-1 ring-ink/[0.08]">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <span className="font-mono text-[12px] text-ink/45">
                    n° {ref(o.id)} · {fmtDate(o.createdAt)}
                  </span>
                  <span className="ml-auto font-mono text-[15px] font-semibold">{o.total !== null ? formatPrice(o.total) : 'Sur devis'}</span>
                </div>
                <ul className="mt-3 divide-y divide-ink/[0.06] text-[14.5px]">
                  {o.items.map((it) => (
                    <li key={it.productId} className="flex justify-between gap-4 py-2">
                      <span>
                        <span className="font-mono text-ink/45">{it.qty} ×</span> {it.name}
                      </span>
                      <span className="text-ink/55">{it.price !== null ? formatPrice(it.price * it.qty) : ''}</span>
                    </li>
                  ))}
                </ul>
                {o.status === 'annulee' ? <p className="mt-3 text-[13px] text-rose-600">Cette commande a été annulée.</p> : <Steps steps={['Reçue', 'Confirmée', 'Livrée']} current={s.step} />}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Fichiers                                                            */
/* ------------------------------------------------------------------ */

interface FileItem {
  url: string
  label: string
  quote: QuoteRecord
}
function filesOf(quotes: QuoteRecord[]): FileItem[] {
  return quotes.flatMap((q) => [
    ...(q.mockupUrl ? [{ url: q.mockupUrl, label: 'Maquette du Studio', quote: q }] : []),
    ...(q.logoUrl ? [{ url: q.logoUrl, label: 'Logo / visuel', quote: q }] : []),
  ])
}

function Files({ list }: { list?: FileItem[] }) {
  if (!list) return <Loading />
  if (!list.length) return <EmptyState icon={TABS[3]!.icon} title="Aucun fichier" text="Les logos, visuels et maquettes joints à vos devis sont gardés ici." cta="Composer dans le Studio" href="/#studio" />
  return (
    <Panel title="Mes fichiers" text="Logos, visuels et maquettes envoyés avec vos demandes.">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {list.map((f) => (
          <li key={f.url}>
            <a href={f.url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-2xl ring-1 ring-ink/[0.08] transition hover:ring-accent/40">
              <div className="aspect-square overflow-hidden" style={{ background: 'repeating-conic-gradient(#eef2f7 0 25%, #ffffff 0 50%) 0 0 / 16px 16px' }}>
                <img src={thumbUrl(f.url, 400)} alt={f.label} className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" loading="lazy" />
              </div>
              <div className="border-t border-ink/[0.06] bg-white p-3">
                <p className="text-[13.5px] font-semibold">{f.label}</p>
                <p className="mt-0.5 truncate text-[12px] text-ink/45">
                  Devis n° {ref(f.quote.id)} · {fmtDate(f.quote.createdAt)}
                </p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Avis                                                                */
/* ------------------------------------------------------------------ */

const REVIEW: Record<ReviewStatus, { label: string; tone: keyof typeof TONES }> = {
  en_attente: { label: 'En attente de validation', tone: 'warn' },
  publie: { label: 'Publié', tone: 'ok' },
  masque: { label: 'Non publié', tone: 'neutral' },
}

function Reviews({ list }: { list?: AccountActivity['reviews'] }) {
  if (!list) return <Loading />
  if (!list.length) return <EmptyState icon={TABS[4]!.icon} title="Aucun avis" text="Votre retour aide les prochains clients : il est publié après une rapide validation." cta="Laisser un avis" href="/?reprendre=avis" />
  return (
    <Panel title="Mes avis" text="Chaque avis est relu avant publication.">
      <ul className="grid gap-4">
        {list.map((r) => (
          <li key={r.id} className="rounded-2xl p-5 ring-1 ring-ink/[0.08]">
            <div className="flex flex-wrap items-center gap-3">
              <Stars value={r.rating} />
              <Badge tone={REVIEW[r.status].tone}>{REVIEW[r.status].label}</Badge>
              <span className="ml-auto text-[12.5px] text-ink/45">{fmtDate(r.createdAt)}</span>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/75">« {r.comment} »</p>
            <p className="mt-2 text-[13px] font-semibold text-ink/50">{r.productName ? `Sur : ${r.productName}` : 'Avis sur l’atelier'}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ------------------------------------------------------------------ */
/* Sécurité                                                            */
/* ------------------------------------------------------------------ */

function Security({ user }: { user: AuthUser }) {
  const [done, setDone] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const methods = useMemo(() => [user.google && 'Google', user.hasPassword && 'E-mail et mot de passe'].filter(Boolean) as string[], [user.google, user.hasPassword])
  return (
    <div className="grid gap-6">
      <Panel
        title={user.hasPassword ? 'Changer le mot de passe' : 'Créer un mot de passe'}
        text={user.hasPassword ? 'Les autres appareils connectés à votre compte seront déconnectés.' : 'Votre compte utilise Google. Ajoutez un mot de passe pour vous connecter aussi avec votre e-mail.'}
      >
        <div className="max-w-md">
          {done && (
            <div className="mb-4">
              <Alert tone="ok">{done}</Alert>
            </div>
          )}
          <NewPasswordForm
            key={formKey}
            submitLabel={user.hasPassword ? 'Changer le mot de passe' : 'Créer le mot de passe'}
            min={user.role === 'admin' ? 10 : undefined}
            needCurrent={user.hasPassword}
            onSubmit={async (next, current) => {
              useAuth.getState().setUser(await api.account.changePassword(next, current))
              setDone(user.hasPassword ? 'Mot de passe modifié. Vos autres appareils sont déconnectés.' : 'Mot de passe créé : vous pouvez aussi vous connecter avec votre e-mail.')
              setFormKey((k) => k + 1)
            }}
          />
        </div>
      </Panel>
      <Panel title="Connexion et appareils" text={`Méthodes de connexion : ${methods.join(' · ') || '—'}.`}>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              await api.account.logoutOthers()
              setDone('Vos autres appareils sont déconnectés.')
            }}
            className="btn h-11 bg-white text-[14px] ring-1 ring-ink/12 hover:ring-ink/25"
          >
            Déconnecter mes autres appareils
          </button>
          <button
            onClick={async () => {
              await useAuth.getState().logout()
              window.location.assign('/')
            }}
            className="btn h-11 text-[14px] text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"
          >
            Se déconnecter
          </button>
        </div>
      </Panel>
    </div>
  )
}
