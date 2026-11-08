import {
  ORDER_STATUSES,
  QUOTE_STATUSES,
  REVIEW_STATUSES,
  SERVICES,
  type Order,
  type OrderStatus,
  type QuoteRecord,
  type QuoteStatus,
  type ReviewStatus,
} from '@atelier/shared'
import { useEffect, useMemo, useState } from 'react'
import { BRAND, formatPrice, telHref } from '../../config/brand'
import { api, type AdminReview } from '../../lib/api'
import { MailIcon, PhoneIcon, WhatsAppIcon } from '../../ui/primitives'
import { Stars } from '../../ui/shop'
import { Card, DangerButton, Empty, errorText, PageHeader, Pill, toast } from '../ui'

const fmtDate = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
const ref = (id: string) => id.slice(0, 8).toUpperCase()
const PRODUCT_LABEL = { tshirt: 'T-shirt', polo: 'Polo', sweat: 'Sweat à capuche', casquette: 'Casquette', mug: 'Mug', tote: 'Tote bag', carte: 'Carte de visite' } as const
const WEARER_LABEL = { homme: 'porté homme', femme: 'porté femme', seul: 'produit seul' } as const

function Filters<T extends string>({ values, labels, current, counts, onChange }: { values: readonly T[]; labels: Record<T, string>; current: T | 'tous'; counts: Record<string, number>; onChange: (v: T | 'tous') => void }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {(['tous', ...values] as const).map((v) => (
        <button key={v} onClick={() => onChange(v)} className={`rounded-full px-4 py-2 text-[13px] font-medium ${current === v ? 'bg-ink text-paper' : 'bg-white ring-1 ring-ink/10'}`}>
          {v === 'tous' ? 'Tous' : labels[v as T]} <span className="opacity-60">{counts[v] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}

function useCounts<T extends { status: string }>(list: T[]) {
  return useMemo(() => {
    const c: Record<string, number> = { tous: list.length }
    list.forEach((x) => (c[x.status] = (c[x.status] ?? 0) + 1))
    return c
  }, [list])
}

/** Lien WhatsApp vers un client : on ajoute l'indicatif du pays s'il a saisi un numéro local. */
function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '')
  const cc = BRAND.whatsappCountryCode
  const full = phone.trim().startsWith('+') || !cc || digits.startsWith(cc) ? digits : `${cc}${digits}`
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`
}

function ContactLinks({ phone, email, message }: { phone: string; email?: string | null; message: string }) {
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-[14px]">
      <a href={telHref(phone)} className="inline-flex items-center gap-2 hover:text-accent">
        <PhoneIcon className="size-4" /> {phone}
      </a>
      <a href={waLink(phone, message)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-accent">
        <WhatsAppIcon className="size-4" /> WhatsApp
      </a>
      {email && (
        <a href={`mailto:${email}`} className="inline-flex items-center gap-2 hover:text-accent">
          <MailIcon className="size-4" /> {email}
        </a>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

const QUOTE_LABEL: Record<QuoteStatus, string> = { nouveau: 'Nouveau', en_cours: 'En cours', traite: 'Traité' }

export function QuotesPage() {
  const [list, setList] = useState<QuoteRecord[]>([])
  const [filter, setFilter] = useState<QuoteStatus | 'tous'>('tous')
  const counts = useCounts(list)
  useEffect(() => {
    api.admin.quotes().then(setList).catch((e) => toast(errorText(e), 'error'))
  }, [])
  const setStatus = async (id: string, status: QuoteStatus) => {
    setList((l) => l.map((q) => (q.id === id ? { ...q, status } : q)))
    try {
      await api.admin.setQuoteStatus(id, status)
      toast('Statut mis à jour')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
  const visible = list.filter((q) => filter === 'tous' || q.status === filter)
  return (
    <>
      <PageHeader kicker="Ventes & demandes" title="Demandes de devis" subtitle="Reçues via le formulaire et le Studio 3D." />
      <Filters values={QUOTE_STATUSES} labels={QUOTE_LABEL} current={filter} counts={counts} onChange={setFilter} />
      {visible.length === 0 ? (
        <Empty>Aucune demande pour l’instant.</Empty>
      ) : (
        <ul className="grid gap-4">
          {visible.map((q) => (
            <li key={q.id}>
              <Card className="grid gap-5 md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Pill tone={q.status === 'nouveau' ? 'accent' : q.status === 'en_cours' ? 'warn' : 'neutral'}>{QUOTE_LABEL[q.status]}</Pill>
                    <span className="font-mono text-[12px] text-ink/45">
                      n° {ref(q.id)} · {fmtDate(q.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-3xl leading-tight">
                    {q.fullName}
                    {q.company && <span className="text-ink/45"> — {q.company}</span>}
                  </h3>
                  <p className="mt-1 text-[14px] font-medium">
                    {SERVICES.find((s) => s.slug === q.service)?.title ?? q.service}
                    {q.quantity ? ` · ${q.quantity} ex.` : ''}
                  </p>
                  <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed text-ink/75">{q.message}</p>
                  {q.customization && (
                    <div className="mt-3 rounded-2xl bg-[#f4f7fb] p-3 text-[13px] text-ink/70">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">Studio : {PRODUCT_LABEL[q.customization.product]}</span>
                        {q.customization.style && <Pill tone="accent">{q.customization.style}</Pill>}
                        {q.customization.wearer && <span>· {WEARER_LABEL[q.customization.wearer]}</span>}
                        {q.customization.text && <span>· « {q.customization.text} »</span>}
                        <span className="size-3.5 rounded-full ring-1 ring-ink/20" title="Couleur du support" style={{ background: q.customization.baseColor }} />
                        <span className="size-3.5 rounded-full ring-1 ring-ink/20" title="Couleur d’impression" style={{ background: q.customization.inkColor }} />
                      </p>
                      {q.customization.card && (
                        <p className="mt-1.5">
                          Carte : {[q.customization.card.name, q.customization.card.title, q.customization.card.phone, q.customization.card.email].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {(q.customization.sub || q.customization.font || q.customization.placement || q.customization.technique) && (
                        <p className="mt-1.5 flex flex-wrap gap-x-2">
                          {q.customization.sub && <span>2ᵉ ligne : « {q.customization.sub} »</span>}
                          {q.customization.font && <span>· Police {q.customization.font}</span>}
                          {q.customization.placement && <span>· Emplacement : {q.customization.placement}</span>}
                          {q.customization.technique && <span>· Technique : {q.customization.technique}</span>}
                        </p>
                      )}
                      {q.customization.quantities && Object.keys(q.customization.quantities).length > 0 && (
                        <p className="mt-1.5">
                          Quantités :{' '}
                          {Object.entries(q.customization.quantities)
                            .map(([size, n]) => `${size} × ${n}`)
                            .join(' · ')}{' '}
                          <span className="font-semibold text-ink">(total {Object.values(q.customization.quantities).reduce((a, b) => a + b, 0)})</span>
                        </p>
                      )}
                    </div>
                  )}
                  <ContactLinks phone={q.phone} email={q.email} message={`Bonjour ${q.fullName}, suite à votre demande de devis n° ${ref(q.id)}…`} />
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <div className="flex gap-2">
                    {q.mockupUrl && (
                      <a href={q.mockupUrl} target="_blank" rel="noreferrer" title="Maquette du client (ouvrir en grand)">
                        <img src={q.mockupUrl} alt="Maquette du client" className="h-32 w-28 rounded-xl object-cover ring-1 ring-ink/10" />
                      </a>
                    )}
                    {q.logoUrl && (
                      <a href={q.logoUrl} target="_blank" rel="noreferrer" title="Logo client">
                        <img src={q.logoUrl} alt="Logo client" className="size-24 rounded-xl bg-white object-contain p-2 ring-1 ring-ink/10" />
                      </a>
                    )}
                  </div>
                  <select value={q.status} onChange={(e) => setStatus(q.id, e.target.value as QuoteStatus)} className="rounded-full bg-[#f4f7fb] px-4 py-2 text-[13px] ring-1 ring-ink/15" aria-label="Statut">
                    {QUOTE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {QUOTE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

const ORDER_LABEL: Record<OrderStatus, string> = { nouvelle: 'Nouvelle', confirmee: 'Confirmée', livree: 'Livrée', annulee: 'Annulée' }

export function OrdersPage() {
  const [list, setList] = useState<Order[]>([])
  const [filter, setFilter] = useState<OrderStatus | 'tous'>('tous')
  const counts = useCounts(list)
  useEffect(() => {
    api.admin.orders().then(setList).catch((e) => toast(errorText(e), 'error'))
  }, [])
  const setStatus = async (id: string, status: OrderStatus) => {
    setList((l) => l.map((o) => (o.id === id ? { ...o, status } : o)))
    try {
      await api.admin.setOrderStatus(id, status)
      toast('Statut mis à jour')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
  const visible = list.filter((o) => filter === 'tous' || o.status === filter)
  return (
    <>
      <PageHeader kicker="Ventes & demandes" title="Commandes" subtitle="Paniers validés par les visiteurs de la boutique." />
      <Filters values={ORDER_STATUSES} labels={ORDER_LABEL} current={filter} counts={counts} onChange={setFilter} />
      {visible.length === 0 ? (
        <Empty>Aucune commande pour l’instant.</Empty>
      ) : (
        <ul className="grid gap-4">
          {visible.map((o) => (
            <li key={o.id}>
              <Card className="grid gap-5 md:grid-cols-[1fr_260px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Pill tone={o.status === 'nouvelle' ? 'accent' : o.status === 'confirmee' ? 'warn' : o.status === 'livree' ? 'ok' : 'danger'}>{ORDER_LABEL[o.status]}</Pill>
                    <span className="font-mono text-[12px] text-ink/45">
                      n° {ref(o.id)} · {fmtDate(o.createdAt)}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-3xl leading-tight">{o.fullName}</h3>
                  {o.address && <p className="mt-1 text-[14px] text-ink/60">{o.address}</p>}
                  {o.message && <p className="mt-3 whitespace-pre-line text-[14.5px] text-ink/75">{o.message}</p>}
                  <ContactLinks phone={o.phone} email={o.email} message={`Bonjour ${o.fullName}, au sujet de votre commande n° ${ref(o.id)}…`} />
                </div>
                <div className="rounded-2xl bg-[#f4f7fb] p-4">
                  <ul className="space-y-1.5 text-[13.5px]">
                    {o.items.map((i) => (
                      <li key={i.productId} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {i.qty} × {i.name}
                        </span>
                        <span className="shrink-0 font-mono text-ink/60">{i.price !== null ? formatPrice(i.price * i.qty) : '—'}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex justify-between border-t border-ink/10 pt-2 font-semibold">
                    <span>Total</span>
                    <span className="font-mono">{formatPrice(o.total)}</span>
                  </p>
                  <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)} className="mt-3 w-full rounded-full bg-white px-4 py-2 text-[13px] ring-1 ring-ink/15" aria-label="Statut">
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ORDER_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

const REVIEW_LABEL: Record<ReviewStatus, string> = { en_attente: 'À modérer', publie: 'Publié', masque: 'Masqué' }

export function ReviewsPage() {
  const [list, setList] = useState<AdminReview[]>([])
  const [filter, setFilter] = useState<ReviewStatus | 'tous'>('en_attente')
  const counts = useCounts(list)
  useEffect(() => {
    api.admin.reviews().then(setList).catch((e) => toast(errorText(e), 'error'))
  }, [])
  const setStatus = async (id: string, status: ReviewStatus) => {
    setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await api.admin.setReviewStatus(id, status)
      toast(status === 'publie' ? 'Avis publié sur le site' : 'Avis masqué')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
  const remove = async (id: string) => {
    try {
      await api.admin.deleteReview(id)
      setList((l) => l.filter((r) => r.id !== id))
      toast('Avis supprimé')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
  const visible = list.filter((r) => filter === 'tous' || r.status === filter)
  return (
    <>
      <PageHeader kicker="Clients" title="Avis clients" subtitle="Les avis n’apparaissent sur le site qu’après votre validation." />
      <Filters values={REVIEW_STATUSES} labels={REVIEW_LABEL} current={filter} counts={counts} onChange={setFilter} />
      {visible.length === 0 ? (
        <Empty>Rien à afficher ici.</Empty>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((r) => (
            <li key={r.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <Stars value={r.rating} />
                  <Pill tone={r.status === 'publie' ? 'ok' : r.status === 'en_attente' ? 'warn' : 'neutral'}>{REVIEW_LABEL[r.status]}</Pill>
                </div>
                <p className="mt-3 font-display text-xl leading-snug">« {r.comment} »</p>
                <p className="mt-2 text-[13px] text-ink/55">
                  {r.name} · {fmtDate(r.createdAt)}
                  {r.productName && <> · sur « {r.productName} »</>}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                  {r.status !== 'publie' && (
                    <button onClick={() => setStatus(r.id, 'publie')} className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white">
                      Publier
                    </button>
                  )}
                  {r.status !== 'masque' && (
                    <button onClick={() => setStatus(r.id, 'masque')} className="rounded-full px-4 py-2 text-[13px] font-semibold ring-1 ring-ink/15">
                      Masquer
                    </button>
                  )}
                  <DangerButton onConfirm={() => remove(r.id)} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
