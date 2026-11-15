import {
  CONTACT_LABEL,
  DEADLINE_LABEL,
  DELIVERY_LABEL,
  QUOTE_CONTACTS,
  QUOTE_DEADLINES,
  QUOTE_DELIVERIES,
  quoteRequestSchema,
  SERVICES,
  type Customization,
  type QuoteDetails,
  type QuoteRequestInput,
  type ServiceDomain,
} from '@atelier/shared'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { z } from 'zod'
import { telHref, whatsappLink } from '../config/brand'
import { useSection, useSite } from '../lib/site'
import { api, ApiError } from '../lib/api'
import { ensureUser, onBeforeGoogle, useAuth } from '../lib/auth'
import { blobToDataUrl, dataUrlToFile, saveDraft, takeDraft } from '../lib/drafts'
import { useApp, type QuotePrefill } from '../lib/store'
import { ArrowRight, CheckIcon, CloseIcon, Kicker, MailIcon, PhoneIcon, SplitTitle, UploadIcon, WhatsAppIcon } from '../ui/primitives'
import { useReveal } from '../ui/hooks'

const PRODUCT_LABEL = { tshirt: 'T-shirt', polo: 'Polo', sweat: 'Sweat à capuche', casquette: 'Casquette', mug: 'Mug', tote: 'Tote bag', carte: 'Cartes de visite' } as const
const PRODUCT_WANTED = { tshirt: 'un T-shirt', polo: 'un polo', sweat: 'un sweat à capuche', casquette: 'une casquette', mug: 'un mug', tote: 'un tote bag', carte: 'des cartes de visite' } as const

/** Première phrase du message, d'après le modèle composé dans le Studio. */
function studioMessage(c: Customization) {
  const what = PRODUCT_WANTED[c.product]
  if (c.product === 'carte') return `Je souhaite ${what}, modèle ${c.style ?? ''}${c.card?.name ? ` au nom de ${c.card.name}` : ''}. `
  return `Je souhaite ${what} personnalisé${c.product === 'casquette' ? 'e' : ''}${c.style ? ` (${c.style.toLowerCase()})` : ''}${c.text ? ` « ${c.text} »` : ''}. `
}

interface FormState {
  fullName: string
  company: string
  phone: string
  email: string
  service: string
  quantity: string
  message: string
  website: string
}

const EMPTY: FormState = { fullName: '', company: '', phone: '', email: '', service: '', quantity: '', message: '', website: '' }

/** Les trois étapes du devis guidé, et les champs que chacune contrôle. */
const STEPS = [
  { id: 'projet', label: 'Votre projet', fields: ['service', 'quantity'] },
  { id: 'precisions', label: 'Précisions', fields: ['message', 'details'] },
  { id: 'coordonnees', label: 'Coordonnées', fields: ['fullName', 'company', 'phone', 'email'] },
] as const
const stepOf = (field: string) => Math.max(0, STEPS.findIndex((s) => (s.fields as readonly string[]).includes(field)))

const DOMAINS: Array<{ id: ServiceDomain; label: string }> = [
  { id: 'print', label: 'Impression & branding' },
  { id: 'tech', label: 'Informatique & sécurité' },
]
const QUANTITIES = [10, 25, 50, 100, 250, 500]

/** Ce qu'il est utile de préciser, selon la prestation. */
function messageHint(service: string) {
  if (['textile', 'casquettes', 'sacs-accessoires', 'objets-cadeaux'].includes(service)) return 'Modèle, tailles, couleurs, emplacement du marquage… ex. « 40 polos bleu marine, logo brodé côté cœur »'
  if (SERVICES.find((s) => s.slug === service)?.domain === 'tech') return 'Nombre de postes ou de caméras, type de local, matériel déjà en place…'
  if (service === 'creation-graphique') return 'Votre activité, vos couleurs, ce que le logo doit évoquer, des exemples que vous aimez…'
  return 'Format, papier, couleurs, finitions… ex. « 500 flyers A5 recto verso »'
}

/** Ce qui est mis de côté pendant la connexion avec Google (la page est quittée puis rechargée). */
interface QuoteDraft {
  form: FormState
  details?: QuoteDetails
  step?: number
  service?: string
  customization?: Customization
  mockup?: string | null
  studioLogo?: { name: string; data: string } | null
  logo?: { name: string; data: string } | null
}

async function fileDraft(file: File | null | undefined) {
  if (!file) return null
  const data = await blobToDataUrl(file)
  return data ? { name: file.name, data } : null
}

/** Remet en place un brouillon de devis (champs, précisions, étape, modèle du Studio, maquette, logo). */
async function restoreDraft(
  d: QuoteDraft,
  setForm: (f: FormState) => void,
  setLogo: (f: File | null) => void,
  setPrefill: (p: QuotePrefill | null) => void,
  setDetails: (d: QuoteDetails) => void,
  setStep: (n: number) => void,
) {
  setForm({ ...EMPTY, ...d.form, website: '' })
  if (d.details) setDetails(d.details)
  if (typeof d.step === 'number') setStep(Math.min(STEPS.length - 1, Math.max(0, d.step)))
  const [mockup, studioLogo, logo] = await Promise.all([
    d.mockup ? dataUrlToFile(d.mockup, 'apercu.jpg') : null,
    d.studioLogo ? dataUrlToFile(d.studioLogo.data, d.studioLogo.name) : null,
    d.logo ? dataUrlToFile(d.logo.data, d.logo.name) : null,
  ])
  if (d.service || d.customization || mockup || studioLogo) {
    setPrefill({
      service: d.service,
      customization: d.customization,
      mockup: mockup ?? undefined,
      mockupPreview: mockup ? URL.createObjectURL(mockup) : undefined,
      logo: studioLogo ?? undefined,
    })
  }
  if (logo) setLogo(logo)
}

function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="kicker text-paper/50">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-[13px] text-accent-2">{error}</span>}
    </label>
  )
}

/** Choix unique sous forme de pastilles (délai, remise, moyen de contact…). Recliquer la pastille choisie la retire. */
function Choice<T extends string>({ label, options, labels, value, onChange, required }: { label: string; options: readonly T[]; labels: Record<T, string>; value?: T; onChange: (v: T | undefined) => void; required?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <span className="kicker text-paper/50">{label}</span>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(value === o && !required ? undefined : o)}
            className={`rounded-full px-4 py-2 text-[13.5px] font-semibold ring-1 transition ${value === o ? 'bg-paper text-ink ring-paper' : 'text-paper/75 ring-paper/15 hover:text-paper hover:ring-paper/40'}`}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Fil des étapes : on revient en arrière d'un clic ; l'étape suivante s'ouvre par « Continuer ». */
function Stepper({ step, reached, onGo }: { step: number; reached: number; onGo: (n: number) => void }) {
  return (
    <ol className="flex items-center gap-2 text-[13px] font-semibold" aria-label="Étapes de la demande">
      {STEPS.map((s, i) => {
        const done = i < step
        const open = i <= reached
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!open}
              onClick={() => onGo(i)}
              aria-current={i === step ? 'step' : undefined}
              className={`flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-3 transition disabled:cursor-not-allowed ${i === step ? 'text-paper' : open ? 'text-paper/60 hover:text-paper' : 'text-paper/30'}`}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] ring-1 transition ${i === step ? 'bg-accent text-white ring-accent' : done ? 'bg-paper/15 text-paper ring-paper/20' : 'ring-paper/20'}`}>
                {done ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
              <span className="truncate max-sm:hidden">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`h-px flex-1 ${done ? 'bg-accent' : 'bg-paper/15'}`} aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

export function QuoteSection() {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref, 0.1)
  const settings = useSite((s) => s.settings)
  const t = useSection('devis')
  const prefill = useApp((s) => s.prefill)
  const setPrefill = useApp((s) => s.setPrefill)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [details, setDetails] = useState<QuoteDetails>({ contact: 'whatsapp' })
  const [step, setStep] = useState(0)
  /** Étape la plus avancée déjà validée : on peut y revenir d'un clic. */
  const [reached, setReached] = useState(0)
  const [domain, setDomain] = useState<ServiceDomain>('print')
  const [logo, setLogo] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [serverError, setServerError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  const user = useAuth((s) => s.user)
  const go = (n: number) => {
    setStep(n)
    setReached((r) => Math.max(r, n))
  }

  // saisie reprise après un aller-retour vers Google
  useEffect(() => {
    const d = takeDraft<QuoteDraft>('devis')
    if (d) void restoreDraft(d, setForm, setLogo, setPrefill, setDetails, go)
  }, [setPrefill])
  // coordonnées du compte : pré-remplies, toujours modifiables
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, fullName: f.fullName || user.name, phone: f.phone || user.phone, email: f.email || user.email }))
  }, [user])
  // avant le départ vers Google : rien de ce qui a été saisi n'est perdu
  const latest = useRef({ form, logo, prefill, details, step })
  latest.current = { form, logo, prefill, details, step }
  useEffect(
    () =>
      onBeforeGoogle(async () => {
        const { form: f, logo: l, prefill: p, details: d, step: st } = latest.current
        if (!f.message && !f.fullName && !f.service && !p) return
        saveDraft('devis', {
          form: f,
          details: d,
          step: st,
          service: p?.service,
          customization: p?.customization,
          mockup: p?.mockup ? await blobToDataUrl(p.mockup) : null,
          studioLogo: await fileDraft(p?.logo),
          logo: await fileDraft(l),
        } satisfies QuoteDraft)
      }),
    [],
  )

  const custom = prefill?.customization
  // prestation déjà connue (bouton d'un poste, Studio) : on passe directement aux précisions
  useEffect(() => {
    const service = prefill?.service
    if (!service) return
    setForm((f) => ({ ...f, service }))
    setDomain(SERVICES.find((s) => s.slug === service)?.domain ?? 'print')
    setErrors((er) => ({ ...er, service: '' }))
    setStep((s) => (s === 0 ? 1 : s))
    setReached((r) => Math.max(r, 1))
  }, [prefill?.service])
  useEffect(() => {
    if (!custom) return
    const total = Object.values(custom.quantities ?? {}).reduce((a, b) => a + b, 0)
    setForm((f) => ({ ...f, message: f.message || studioMessage(custom), quantity: f.quantity || (total ? String(total) : '') }))
  }, [custom])

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: '' }))
  }
  const detail = <K extends keyof QuoteDetails>(key: K, value: QuoteDetails[K]) => setDetails((d) => ({ ...d, [key]: value }))

  const input = (): QuoteRequestInput => ({
    ...form,
    quantity: form.quantity ? Number(form.quantity) : undefined,
    customization: custom,
    details: { ...details, date: details.date || undefined },
  })

  /** Contrôle l'étape en cours ; renvoie vrai si l'on peut avancer. */
  const validateStep = (n: number) => {
    const parsed = quoteRequestSchema.safeParse(input())
    if (parsed.success) return true
    const fields = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>
    const mine = Object.entries(fields).filter(([k]) => (STEPS[n]!.fields as readonly string[]).includes(k))
    if (!mine.length) return true
    setErrors((er) => ({ ...er, ...Object.fromEntries(mine.map(([k, v]) => [k, v?.[0] ?? ''])) }))
    return false
  }
  const next = () => {
    if (validateStep(step)) go(step + 1)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (step < STEPS.length - 1) return next()
    setServerError(null)
    const data = input()
    const parsed = quoteRequestSchema.safeParse(data)
    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.[0] ?? ''])))
      // on rouvre la première étape qui pose problème
      setStep(Math.min(...Object.keys(fields).map(stepOf)))
      return
    }
    // la demande est rattachée à un compte : connexion d'abord, le formulaire reste rempli
    if (!(await ensureUser('devis'))) {
      setServerError('Connectez-vous ou créez un compte gratuit pour envoyer votre demande et la suivre.')
      return
    }
    setStatus('sending')
    try {
      const logoFile = logo ?? prefill?.logo
      const [mockupUrl, logoUrl] = await Promise.all([
        prefill?.mockup ? api.upload(prefill.mockup, 'mockup').then((r) => r.url) : undefined,
        logoFile ? api.upload(logoFile, 'logo').then((r) => r.url) : undefined,
      ])
      const res = await api.createQuote({ ...data, mockupUrl, logoUrl })
      setReference(res.id)
      setStatus('done')
      setPrefill(null)
      setLogo(null)
    } catch (err) {
      setStatus('error')
      if (err instanceof ApiError && err.status === 401) useAuth.setState({ user: null })
      if (err instanceof ApiError) {
        setServerError(err.message)
        if (err.issues) {
          setErrors(Object.fromEntries(Object.entries(err.issues).map(([k, v]) => [k, v?.[0] ?? ''])))
          setStep(Math.min(...Object.keys(err.issues).map(stepOf)))
        }
      } else setServerError('Une erreur est survenue.')
    }
  }

  const restart = () => {
    setForm(user ? { ...EMPTY, fullName: user.name, phone: user.phone, email: user.email } : EMPTY)
    setDetails({ contact: 'whatsapp' })
    setStep(0)
    setReached(0)
    setErrors({})
    setStatus('idle')
  }

  const short = reference ? reference.slice(0, 8).toUpperCase() : null
  const wa = whatsappLink(
    short ? `Bonjour ${settings.name}, je viens d'envoyer la demande de devis n° ${short}.` : `Bonjour ${settings.name}, je souhaite un devis.`,
  )
  const service = SERVICES.find((s) => s.slug === form.service)
  const attached = [prefill?.mockup && 'maquette du Studio', (logo ?? prefill?.logo) && 'logo'].filter(Boolean) as string[]
  /** Récapitulatif de la demande, relu avant l'envoi. */
  const recap: Array<[string, string]> = [
    ['Prestation', service?.title ?? '—'],
    ...(form.quantity ? ([['Quantité', `${form.quantity} ex.`]] as Array<[string, string]>) : []),
    ...(details.deadline ? ([['Délai', DEADLINE_LABEL[details.deadline]]] as Array<[string, string]>) : []),
    ...(details.date ? ([['Date souhaitée', new Date(`${details.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })]] as Array<[string, string]>) : []),
    ...(details.delivery ? ([['Remise', DELIVERY_LABEL[details.delivery]]] as Array<[string, string]>) : []),
    ...(attached.length ? ([['Pièces jointes', attached.join(', ')]] as Array<[string, string]>) : []),
  ]

  return (
    <section id="devis" ref={ref} className="relative bg-ink-2 text-paper">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 md:px-10 md:py-32 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Kicker className="fade-up text-paper/50">
            <span className="text-accent">●</span> {t.kicker}
          </Kicker>
          <SplitTitle lines={t.title} className="mt-5 font-display text-[clamp(2.46rem,5.04vw,4.7rem)] leading-[0.92]" />
          {t.text && (
            <p className="fade-up mt-6 max-w-md text-[15.5px] leading-relaxed text-paper/65" style={{ '--d': '300ms' } as CSSProperties}>
              {t.text}
            </p>
          )}
          <ol className="fade-up mt-8 max-w-md space-y-3 text-[14.5px] text-paper/70" style={{ '--d': '380ms' } as CSSProperties}>
            {['Vous décrivez votre projet en trois étapes.', 'Nous vous répondons avec un prix et un délai.', 'Vous validez le bon à tirer, nous fabriquons.'].map((line, i) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-paper/10 font-mono text-[12px] text-paper">{i + 1}</span>
                {line}
              </li>
            ))}
          </ol>
          <ul className="fade-up mt-10 space-y-3 text-[15px]" style={{ '--d': '450ms' } as CSSProperties}>
            {settings.phones.map((p) => (
              <li key={p}>
                <a href={telHref(p)} className="group inline-flex items-center gap-3 hover:text-yellow">
                  <PhoneIcon className="size-5 text-paper/50 group-hover:text-yellow" /> {p}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${settings.email}`} className="group inline-flex items-center gap-3 hover:text-yellow">
                <MailIcon className="size-5 text-paper/50 group-hover:text-yellow" /> {settings.email}
              </a>
            </li>
            {wa && (
              <li>
                <a href={wa} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-3 hover:text-yellow">
                  <WhatsAppIcon className="size-5 text-paper/50 group-hover:text-yellow" /> Écrire sur WhatsApp
                </a>
              </li>
            )}
          </ul>
        </div>

        <div className="fade-up lg:col-span-7" style={{ '--d': '250ms' } as CSSProperties}>
          {status === 'done' ? (
            <div className="crop flex min-h-[520px] flex-col justify-center rounded-[28px] bg-paper/[0.04] p-8 ring-1 ring-paper/10 md:p-12">
              <span className="grid size-16 place-items-center rounded-full bg-accent">
                <CheckIcon className="size-8" />
              </span>
              <h3 className="mt-8 font-display text-5xl leading-none">
                Merci{form.fullName ? `, ${form.fullName.split(' ')[0]}` : ''} !
              </h3>
              <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-paper/70">
                Votre demande {short && <strong className="font-mono text-paper">n° {short}</strong>} est bien enregistrée.
                {details.contact ? ` Nous vous répondons par ${CONTACT_LABEL[details.contact].toLowerCase()} très vite.` : ' Nous revenons vers vous très vite.'}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/compte#devis" className="btn btn-paper">
                  Suivre ma demande <ArrowRight className="size-4" />
                </a>
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    <WhatsAppIcon className="size-5" /> WhatsApp
                  </a>
                )}
                <button className="btn btn-ghost" onClick={restart}>
                  Nouvelle demande
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="crop rounded-[28px] bg-paper/[0.04] p-6 ring-1 ring-paper/10 md:p-10">
              <Stepper step={step} reached={reached} onGo={setStep} />

              {(custom || prefill?.mockupPreview) && (
                <div className="mt-7 flex items-center gap-4 rounded-2xl bg-paper/[0.06] p-3 pr-4">
                  {prefill?.mockupPreview && (
                    <img src={prefill.mockupPreview} alt="Aperçu de votre modèle" className="size-20 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="kicker text-paper/50">Maquette jointe depuis le Studio</p>
                    {custom && (
                      <p className="mt-1 flex items-center gap-2 truncate text-[15px]">
                        {PRODUCT_LABEL[custom.product]}
                        {custom.style && <span className="truncate text-paper/60">· {custom.style}</span>}
                        {custom.text && <span className="truncate text-paper/60">« {custom.text} »</span>}
                        <span className="size-3.5 shrink-0 rounded-full ring-1 ring-paper/30" style={{ background: custom.baseColor }} />
                        <span className="size-3.5 shrink-0 rounded-full ring-1 ring-paper/30" style={{ background: custom.inkColor }} />
                      </p>
                    )}
                    {custom && (custom.placement || custom.technique) && (
                      <p className="mt-0.5 truncate text-[13px] text-paper/50">{[custom.placement, custom.technique].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrefill(prefill?.service ? { service: prefill.service } : null)}
                    className="grid size-9 place-items-center rounded-full hover:bg-paper/10"
                    aria-label="Retirer le modèle"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                </div>
              )}

              <div key={step} className="shop-enter mt-8 min-h-[23rem]">
                {step === 0 && (
                  <div className="space-y-8">
                    <div>
                      <span className="kicker block text-paper/50">Que souhaitez-vous réaliser ? *</span>
                      <div className="mt-3 inline-flex max-w-full rounded-full bg-paper/[0.06] p-1" role="tablist" aria-label="Domaine">
                        {DOMAINS.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            role="tab"
                            aria-selected={domain === d.id}
                            onClick={() => setDomain(d.id)}
                            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${domain === d.id ? 'bg-paper text-ink' : 'text-paper/65 hover:text-paper'}`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Prestation">
                        {SERVICES.filter((s) => s.domain === domain).map((s) => {
                          const on = form.service === s.slug
                          return (
                            <button
                              key={s.slug}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => set('service')({ target: { value: s.slug } })}
                              className={`flex items-start gap-3 rounded-2xl p-3.5 text-left ring-1 transition ${on ? 'bg-paper text-ink ring-paper' : 'ring-paper/12 hover:bg-paper/[0.05] hover:ring-paper/35'}`}
                            >
                              <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 ${on ? 'bg-accent text-white ring-accent' : 'ring-paper/30'}`}>
                                {on && <CheckIcon className="size-3" />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[14.5px] font-semibold leading-snug">{s.title}</span>
                                <span className={`mt-0.5 block truncate text-[12.5px] ${on ? 'text-ink/55' : 'text-paper/45'}`}>{s.highlights.join(' · ')}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {errors.service && <p className="mt-2 text-[13px] text-accent-2">{errors.service}</p>}
                    </div>
                    <div>
                      <span className="kicker block text-paper/50">Quantité approximative</span>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {QUANTITIES.map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={form.quantity === String(n)}
                            onClick={() => set('quantity')({ target: { value: form.quantity === String(n) ? '' : String(n) } })}
                            className={`rounded-full px-4 py-2 font-mono text-[13.5px] font-semibold ring-1 transition ${form.quantity === String(n) ? 'bg-paper text-ink ring-paper' : 'text-paper/75 ring-paper/15 hover:text-paper hover:ring-paper/40'}`}
                          >
                            {n}
                          </button>
                        ))}
                        <input
                          className="field !w-28 !py-2 text-center"
                          inputMode="numeric"
                          value={form.quantity}
                          onChange={(e) => set('quantity')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 6) } })}
                          placeholder="Autre"
                          aria-label="Autre quantité"
                        />
                      </div>
                      {errors.quantity && <p className="mt-2 text-[13px] text-accent-2">{errors.quantity}</p>}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-8">
                    <Field label="Décrivez votre besoin *" error={errors.message}>
                      <textarea className="field min-h-32 resize-y" value={form.message} onChange={set('message')} maxLength={2000} placeholder={messageHint(form.service)} autoFocus />
                    </Field>
                    <div className="grid gap-8 sm:grid-cols-2">
                      <div>
                        <Choice label="Pour quand ?" options={QUOTE_DEADLINES} labels={DEADLINE_LABEL} value={details.deadline} onChange={(v) => detail('deadline', v)} />
                        <label className="mt-4 flex items-center gap-3 text-[13.5px] text-paper/60">
                          ou une date précise
                          <input
                            type="date"
                            className="field !w-auto !py-1.5 [color-scheme:dark]"
                            value={details.date ?? ''}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => detail('date', e.target.value || undefined)}
                            aria-label="Date souhaitée"
                          />
                        </label>
                      </div>
                      <Choice label="Remise de la commande" options={QUOTE_DELIVERIES} labels={DELIVERY_LABEL} value={details.delivery} onChange={(v) => detail('delivery', v)} />
                    </div>
                    {!prefill?.logo && (
                      <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-paper/20 p-4 text-[14px] text-paper/70 transition hover:border-paper/50 hover:text-paper">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper/10">
                          <UploadIcon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          {logo ? <span className="block truncate font-semibold text-paper">{logo.name}</span> : 'Joindre un logo ou un visuel'}
                          <span className="block text-[12.5px] text-paper/45">PNG, JPG ou WEBP · 5 Mo maximum</span>
                        </span>
                        {logo && (
                          <button type="button" onClick={(e) => (e.preventDefault(), setLogo(null))} className="grid size-9 place-items-center rounded-full hover:bg-paper/10" aria-label="Retirer le fichier">
                            <CloseIcon className="size-4" />
                          </button>
                        )}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
                      </label>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-8">
                    <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
                      <Field label="Nom complet *" error={errors.fullName}>
                        <input className="field" autoComplete="name" value={form.fullName} onChange={set('fullName')} />
                      </Field>
                      <Field label="Entreprise" error={errors.company}>
                        <input className="field" autoComplete="organization" value={form.company} onChange={set('company')} />
                      </Field>
                      <Field label="Téléphone / WhatsApp *" error={errors.phone}>
                        <input className="field" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
                      </Field>
                      <Field label="E-mail" error={errors.email}>
                        <input className="field" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
                      </Field>
                    </div>
                    <Choice label="Comment préférez-vous être recontacté ?" options={QUOTE_CONTACTS} labels={CONTACT_LABEL} value={details.contact} onChange={(v) => detail('contact', v)} required />
                    <dl className="grid gap-x-8 gap-y-2 rounded-2xl bg-paper/[0.05] p-4 text-[13.5px] sm:grid-cols-2">
                      {recap.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 border-b border-paper/[0.07] py-1.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
                          <dt className="text-paper/45">{k}</dt>
                          <dd className="truncate text-right font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>

              {/* champ piège anti-robots : invisible pour les humains */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={set('website')}
                className="absolute -left-[9999px] size-px opacity-0"
                aria-hidden
              />

              {serverError && <p className="mt-6 text-[14px] text-accent-2">{serverError}</p>}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-paper/10 pt-6">
                {step > 0 ? (
                  <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 text-[14px] font-semibold text-paper/65 hover:text-paper">
                    <ArrowRight className="size-4 rotate-180" /> Retour
                  </button>
                ) : (
                  <p className="max-w-xs text-[12.5px] leading-relaxed text-paper/45">Gratuit et sans engagement. Réponse rapide, sur WhatsApp ou par téléphone.</p>
                )}
                {step < STEPS.length - 1 ? (
                  <button type="submit" className="btn btn-paper">
                    Continuer <ArrowRight className="size-4" />
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-4">
                    <p className="max-w-[15rem] text-[12.5px] leading-relaxed text-paper/45">
                      {user ? `Envoyée depuis votre compte ${user.email}.` : 'Vous vous connectez à l’envoi pour suivre votre demande.'}
                    </p>
                    <button type="submit" disabled={status === 'sending'} className="btn btn-paper disabled:opacity-60">
                      {status === 'sending' ? 'Envoi…' : 'Envoyer ma demande'}
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
