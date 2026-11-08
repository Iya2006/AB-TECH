import { quoteRequestSchema, SERVICES, type Customization, type QuoteRequestInput } from '@atelier/shared'
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

/** Ce qui est mis de côté pendant la connexion avec Google (la page est quittée puis rechargée). */
interface QuoteDraft {
  form: FormState
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

/** Remet en place un brouillon de devis (champs, modèle du Studio, maquette, logo). */
async function restoreDraft(d: QuoteDraft, setForm: (f: FormState) => void, setLogo: (f: File | null) => void, setPrefill: (p: QuotePrefill | null) => void) {
  setForm({ ...EMPTY, ...d.form, website: '' })
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
      {error && <span className="mt-1.5 block text-[13px] text-accent">{error}</span>}
    </label>
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
  const [logo, setLogo] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [serverError, setServerError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  const user = useAuth((s) => s.user)

  // saisie reprise après un aller-retour vers Google
  useEffect(() => {
    const d = takeDraft<QuoteDraft>('devis')
    if (d) void restoreDraft(d, setForm, setLogo, setPrefill)
  }, [setPrefill])
  // coordonnées du compte : pré-remplies, toujours modifiables
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, fullName: f.fullName || user.name, phone: f.phone || user.phone, email: f.email || user.email }))
  }, [user])
  // avant le départ vers Google : rien de ce qui a été saisi n'est perdu
  const latest = useRef({ form, logo, prefill })
  latest.current = { form, logo, prefill }
  useEffect(
    () =>
      onBeforeGoogle(async () => {
        const { form: f, logo: l, prefill: p } = latest.current
        if (!f.message && !f.fullName && !p) return
        saveDraft('devis', {
          form: f,
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
  useEffect(() => {
    if (prefill?.service) setForm((f) => ({ ...f, service: prefill.service! }))
  }, [prefill?.service])
  useEffect(() => {
    if (!custom) return
    setForm((f) => (f.message ? f : { ...f, message: studioMessage(custom) }))
  }, [custom])

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((er) => ({ ...er, [key]: '' }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    const input: QuoteRequestInput = {
      ...form,
      quantity: form.quantity ? Number(form.quantity) : undefined,
      customization: custom,
    }
    const parsed = quoteRequestSchema.safeParse(input)
    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>
      setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.[0] ?? ''])))
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
      const res = await api.createQuote({ ...input, mockupUrl, logoUrl })
      setReference(res.id)
      setStatus('done')
      setPrefill(null)
      setLogo(null)
    } catch (err) {
      setStatus('error')
      if (err instanceof ApiError && err.status === 401) useAuth.setState({ user: null })
      if (err instanceof ApiError) {
        setServerError(err.message)
        if (err.issues) setErrors(Object.fromEntries(Object.entries(err.issues).map(([k, v]) => [k, v?.[0] ?? ''])))
      } else setServerError('Une erreur est survenue.')
    }
  }

  const short = reference ? reference.slice(0, 8).toUpperCase() : null
  const wa = whatsappLink(
    short ? `Bonjour ${settings.name}, je viens d'envoyer la demande de devis n° ${short}.` : `Bonjour ${settings.name}, je souhaite un devis.`,
  )

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
                Votre demande {short && <strong className="font-mono text-paper">n° {short}</strong>} est bien enregistrée. Nous
                revenons vers vous très vite.
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
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setForm(user ? { ...EMPTY, fullName: user.name, phone: user.phone, email: user.email } : EMPTY)
                    setStatus('idle')
                  }}
                >
                  Nouvelle demande
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="crop rounded-[28px] bg-paper/[0.04] p-6 ring-1 ring-paper/10 md:p-10">
              {(custom || prefill?.mockupPreview) && (
                <div className="mb-8 flex items-center gap-4 rounded-2xl bg-paper/[0.06] p-3 pr-4">
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
                <Field label="Prestation *" error={errors.service}>
                  <select className="field appearance-none bg-transparent" value={form.service} onChange={set('service')}>
                    <option value="" className="bg-ink">
                      Choisir…
                    </option>
                    <optgroup label="Impression & branding" className="bg-ink">
                      {SERVICES.filter((s) => s.domain === 'print').map((s) => (
                        <option key={s.slug} value={s.slug} className="bg-ink">
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Informatique & sécurité" className="bg-ink">
                      {SERVICES.filter((s) => s.domain === 'tech').map((s) => (
                        <option key={s.slug} value={s.slug} className="bg-ink">
                          {s.title}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </Field>
                <Field label="Quantité" error={errors.quantity}>
                  <input className="field" inputMode="numeric" value={form.quantity} onChange={set('quantity')} placeholder="ex. 50" />
                </Field>
                <Field label="Votre besoin *" error={errors.message} className="sm:col-span-2">
                  <textarea className="field min-h-28 resize-y" value={form.message} onChange={set('message')} maxLength={2000} />
                </Field>
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

              {!prefill?.logo && (
                <label className="mt-8 flex cursor-pointer items-center gap-3 text-[14px] text-paper/70 hover:text-paper">
                  <UploadIcon className="size-5" />
                  {logo ? <span className="truncate">{logo.name}</span> : 'Joindre un logo ou un visuel (PNG, JPG, WEBP · 5 Mo)'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}

              {serverError && <p className="mt-6 text-[14px] text-accent">{serverError}</p>}

              <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-xs text-[12.5px] leading-relaxed text-paper/45">
                  {user ? `Envoyée depuis votre compte ${user.email}.` : 'Vous vous connectez à l’envoi pour suivre votre demande. Vos informations servent uniquement à vous répondre.'}
                </p>
                <button type="submit" disabled={status === 'sending'} className="btn btn-paper disabled:opacity-60">
                  {status === 'sending' ? 'Envoi…' : 'Envoyer ma demande'}
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
