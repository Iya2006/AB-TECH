import type { ReactNode } from 'react'
import BeamWordmarkFooter, { type FooterCredit, type FooterSocial } from '../components/ui/beam-wordmark-footer'
import { telHref, whatsappLink } from '../config/brand'
import { scrollToElement, scrollToJourney } from '../lib/scroll'
import { useSection, useSite } from '../lib/site'
import { useApp } from '../lib/store'
import { ArrowRight, Kicker, PhoneIcon, WhatsAppIcon } from '../ui/primitives'

/** Couleurs du pied de page : bleu nuit, rayon de lumière à l'accent AB-TECH. */
const NIGHT = '#040a1a'

type FooterLink = { label: string; href?: string; action?: () => void }

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: 'Explorer',
    links: [
      { label: 'Visiter l’atelier', action: () => scrollToJourney(0) },
      { label: 'Le portant', action: () => scrollToElement('#portant') },
      { label: 'Boutique', action: () => scrollToElement('#boutique') },
      { label: 'Studio', action: () => scrollToElement('#studio') },
      { label: 'Avis clients', action: () => scrollToElement('#avis') },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'Prestations', action: () => scrollToElement('#prestations') },
      { label: 'Catalogue', action: () => useApp.getState().open({ type: 'catalogue' }) },
      { label: 'Notre méthode', action: () => scrollToElement('#methode') },
      { label: 'Demander un devis', action: () => scrollToElement('#devis') },
      { label: 'Espace pro', href: '/admin' },
    ],
  },
]

const ACTIONS = new Map(COLUMNS.flatMap((c) => c.links.flatMap((l) => (l.action ? [[l.label, l.action] as const] : []))))

/** Icônes 24 × 24 au trait, dans le style des icônes intégrées du composant. */
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const ICONS: Record<'phone' | 'whatsapp' | 'mail' | 'facebook' | 'tiktok', ReactNode> = {
  phone: <path {...stroke} d="M5.2 4.5h3l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6v3a1.6 1.6 0 0 1-1.7 1.6A15.6 15.6 0 0 1 3.6 6.2a1.6 1.6 0 0 1 1.6-1.7Z" />,
  whatsapp: (
    <g {...stroke}>
      <path d="m3.8 20.2 1.2-4.1a8.4 8.4 0 1 1 3.1 3l-4.3 1.1Z" />
      <path d="M9.2 8.4c.3-.3.6-.4 1-.3l1 2.3-.7.9a5.6 5.6 0 0 0 2.2 2.2l.9-.7 2.3 1c.1.4 0 .7-.3 1-.7.7-1.9.8-3.2.2a8 8 0 0 1-3.4-3.4c-.6-1.3-.5-2.5.2-3.2Z" />
    </g>
  ),
  mail: (
    <g {...stroke}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="m4.5 7.2 7.5 5.8 7.5-5.8" />
    </g>
  ),
  facebook: <path {...stroke} strokeWidth={1.4} d="M13.9 20.5V14h2.4l.5-3.3h-2.9V8.9c0-.9.4-1.5 1.6-1.5h1.4V4.6a16 16 0 0 0-2.2-.1c-2.4 0-3.9 1.4-3.9 4v2.2H8.3V14h2.5v6.5h3.1Z" />,
  tiktok: <path {...stroke} d="M14.5 3.5v11.3a3.4 3.4 0 1 1-3.4-3.4M14.5 3.5c.4 2.5 2 4.1 4.6 4.4" />,
}

const isUrl = (v: string) => /^https?:\/\//i.test(v)

/** Pied de page : appel à nous joindre, puis le pied de page « Beam Wordmark » (21st.dev) aux couleurs d'AB-TECH. */
export function Footer() {
  const { phones, email, address, hours, name, tagline, socials } = useSite((s) => s.settings)
  const t = useSection('contact')
  const wa = whatsappLink(`Bonjour ${name}, je souhaite des informations.`)

  const buttons: FooterSocial[] = []
  if (phones[0]) buttons.push({ label: 'Appeler', href: telHref(phones[0]), icon: ICONS.phone })
  if (wa) buttons.push({ label: 'WhatsApp', href: wa, icon: ICONS.whatsapp })
  if (email) buttons.push({ label: 'E-mail', href: `mailto:${email}`, icon: ICONS.mail })
  if (isUrl(socials.facebook)) buttons.push({ label: 'Facebook', href: socials.facebook, icon: ICONS.facebook })
  if (isUrl(socials.instagram)) buttons.push({ label: 'Instagram', href: socials.instagram, icon: 'instagram' })
  if (isUrl(socials.tiktok)) buttons.push({ label: 'TikTok', href: socials.tiktok, icon: ICONS.tiktok })

  const contact: FooterCredit[] = [
    ...(tagline ? [{ label: tagline }] : []),
    ...phones.map((p) => ({ lead: 'Tél. ', label: p, href: telHref(p) })),
    ...(email ? [{ lead: 'E-mail ', label: email, href: `mailto:${email}` }] : []),
    ...(address ? [{ label: address }] : []),
    ...(hours ? [{ lead: 'Horaires : ', label: hours }] : []),
  ]

  return (
    <div id="contact" className="text-paper" style={{ background: NIGHT }}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-8 px-5 pb-16 pt-24 md:px-10">
        <div>
          <Kicker className="text-paper/50">
            <span className="text-accent-2">●</span> {t.kicker}
          </Kicker>
          <p className="mt-5 font-display text-[clamp(2.11rem,3.86vw,3.53rem)] leading-[0.95]">
            {t.title[0]} <em>{t.title[1]}</em>
          </p>
          {t.text && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-paper/65">{t.text}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {phones.map((p) => (
            <a key={p} href={telHref(p)} className="btn h-12 bg-white px-5 text-[14.5px] text-ink hover:bg-accent hover:text-white">
              <PhoneIcon className="size-4" /> {p}
            </a>
          ))}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn h-12 bg-[#1faa59] px-5 text-[14.5px] text-white hover:bg-[#178a48]">
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
          )}
          <button type="button" onClick={() => scrollToElement('#devis')} className="btn h-12 px-5 text-[14.5px] text-white ring-1 ring-white/25 hover:bg-white/10">
            Devis gratuit <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <BeamWordmarkFooter
        brand={name}
        company={`${name} · Tous droits réservés`}
        socials={buttons}
        credits={contact}
        columns={COLUMNS}
        onLinkClick={(label) => ACTIONS.get(label)?.()}
        background={NIGHT}
        ink="#eef3fb"
        muted="#8b95ab"
        accent="#3b82f6"
        wordTop="#1c3f9e"
        wordFoot="#071229"
        fontSans="'Plus Jakarta Sans Variable', 'Inter Tight Variable', ui-sans-serif, system-ui, sans-serif"
        wordWeight={800}
      />
    </div>
  )
}

/** Bouton flottant : WhatsApp si l'indicatif est configuré, sinon appel direct. */
export function FloatingContact() {
  const ready = useApp((s) => s.ready)
  const settings = useSite((s) => s.settings)
  const wa = whatsappLink(`Bonjour ${settings.name}, je souhaite des informations.`)
  const phone = settings.phones[0]
  if (!wa && !phone) return null
  return (
    <a
      href={wa ?? telHref(phone!)}
      target={wa ? '_blank' : undefined}
      rel="noreferrer"
      aria-label={wa ? 'Écrire sur WhatsApp' : `Appeler le ${phone}`}
      className={`fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full text-paper shadow-[0_10px_30px_-8px_rgba(0,0,0,0.5)] transition-all duration-700 hover:scale-110 ${
        wa ? 'bg-[#1faa59]' : 'bg-accent'
      } ${ready ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
    >
      {wa ? <WhatsAppIcon className="size-7" /> : <PhoneIcon className="size-6" />}
    </a>
  )
}
