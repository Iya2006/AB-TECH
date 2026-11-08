import type { AdminStats, AuthStatus, AuthUser, Order, QuoteRecord } from '@atelier/shared'
import { SERVICES } from '@atelier/shared'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatPrice } from '../../config/brand'
import { api } from '../../lib/api'
import { firstName } from '../../lib/auth'
import { useSite } from '../../lib/site'
import { CheckIcon } from '../../ui/primitives'
import { Stars } from '../../ui/shop'
import { Card, errorText, PageHeader, Pill, toast } from '../ui'

/* Palette validée (dataviz) : bleu = devis, orange = commandes. */
const SERIES = [
  { key: 'quotes' as const, label: 'Devis', color: '#2a78d6' },
  { key: 'orders' as const, label: 'Commandes', color: '#eb6834' },
]

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Activité sur 14 jours : colonnes groupées, info-bulle au survol, vue tableau. */
function ActivityChart({ data }: { data: AdminStats['activity'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const max = Math.max(1, ...data.flatMap((d) => [d.quotes, d.orders]))
  const top = max <= 4 ? 4 : Math.ceil(max / 5) * 5
  const ticks = [0, top / 2, top]
  const W = 720
  const H = 220
  const pad = { l: 28, r: 8, t: 12, b: 26 }
  const band = (W - pad.l - pad.r) / data.length
  const bar = Math.min(14, (band - 10) / 2)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top)
  // colonne : extrémité arrondie (4px), base carrée
  const column = (x: number, v: number) => {
    const h = Math.max(0, y(0) - y(v))
    if (h <= 0) return ''
    const r = Math.min(4, h, bar / 2)
    const yt = y(v)
    return `M${x},${y(0)} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + bar - r} Q${x + bar},${yt} ${x + bar},${yt + r} V${y(0)} Z`
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Activité des 14 derniers jours</h2>
          <div className="mt-1 flex gap-4 text-[13px] text-ink/60">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
              </span>
            ))}
          </div>
        </div>
        <button className="text-[13px] font-semibold text-accent" onClick={() => setTable((t) => !t)}>
          {table ? 'Voir le graphique' : 'Voir le tableau'}
        </button>
      </div>
      {table ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-[13.5px]">
            <thead className="text-left text-ink/50">
              <tr>
                <th className="py-1.5 font-medium">Jour</th>
                <th className="py-1.5 text-right font-medium">Devis</th>
                <th className="py-1.5 text-right font-medium">Commandes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="py-1.5">{dayLabel(d.date)}</td>
                  <td className="py-1.5 text-right font-mono">{d.quotes}</td>
                  <td className="py-1.5 text-right font-mono">{d.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Devis et commandes par jour sur 14 jours">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e7ebf0" strokeWidth={1} />
                <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#6b7280">
                  {t}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x0 = pad.l + i * band + (band - (bar * 2 + 2)) / 2
              return (
                <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  {/* zone de survol plus large que les colonnes */}
                  <rect x={pad.l + i * band} y={pad.t} width={band} height={H - pad.t - pad.b} fill={hover === i ? '#f1f5f9' : 'transparent'} />
                  <path d={column(x0, d.quotes)} fill={SERIES[0]!.color} />
                  <path d={column(x0 + bar + 2, d.orders)} fill={SERIES[1]!.color} />
                  {(i % 2 === 0 || i === data.length - 1) && (
                    <text x={pad.l + i * band + band / 2} y={H - 8} textAnchor="middle" fontSize={10.5} fill="#6b7280">
                      {dayLabel(d.date)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
          {hover !== null && data[hover] && (
            <div
              className="pointer-events-none absolute top-2 rounded-xl bg-ink px-3 py-2 text-[12.5px] text-paper shadow-lg"
              style={{ left: `${((pad.l + hover * band + band / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}
            >
              <p className="font-semibold">{dayLabel(data[hover].date)}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} /> {s.label} : {data[hover]![s.key]}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */

/**
 * Courbe des 14 derniers jours dans un indicateur : trait de 2 px, aire très claire, une seule série
 * (le titre de la carte la nomme). Au survol, la valeur du jour remplace la légende de la carte.
 */
function Sparkline({ values, color, onHover }: { values: number[]; color: string; onHover: (i: number | null) => void }) {
  const W = 160
  const H = 44
  const max = Math.max(1, ...values)
  const step = W / Math.max(1, values.length - 1)
  const pts = values.map((v, i) => [i * step, H - 4 - (v / max) * (H - 10)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [hover, setHover] = useState<number | null>(null)
  const set = (i: number | null) => {
    setHover(i)
    onHover(i)
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-full overflow-visible" preserveAspectRatio="none" aria-hidden onMouseLeave={() => set(null)}>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={color} opacity={0.08} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {hover !== null && pts[hover] && <circle cx={pts[hover][0]} cy={pts[hover][1]} r={3.5} fill="#fff" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      {/* zones de survol : une par jour, plus larges que le point */}
      {pts.map(([x], i) => (
        <rect key={i} x={x - step / 2} y={0} width={step} height={H} fill="transparent" onMouseEnter={() => set(i)} />
      ))}
    </svg>
  )
}

function Kpi({
  label,
  value,
  sub,
  go,
  spark,
  children,
}: {
  label: string
  value: string | number
  sub: string
  go: () => void
  spark?: { values: number[]; dates: string[]; color: string; unit: string }
  children?: ReactNode
}) {
  const [hover, setHover] = useState<number | null>(null)
  const hovered = spark && hover !== null ? `${dayLabel(spark.dates[hover]!)} : ${spark.values[hover]} ${spark.unit}${spark.values[hover]! > 1 ? 's' : ''}` : null
  return (
    <button onClick={go} className="admin-enter group flex flex-col rounded-[20px] bg-white p-5 text-left ring-1 ring-ink/[0.07] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-36px_rgba(10,16,32,0.55)] hover:ring-accent/30">
      <p className="flex items-center justify-between gap-2 text-[13px] font-semibold text-ink/55">
        {label}
        <span className="text-ink/25 transition group-hover:translate-x-0.5 group-hover:text-accent">→</span>
      </p>
      <p className="mt-2 font-display text-[2.6rem] leading-none tabular-nums">{value}</p>
      <p className="mt-2 min-h-[1.25rem] text-[12.5px] text-ink/50">{hovered ?? sub}</p>
      {spark ? <div className="mt-3">{<Sparkline values={spark.values} color={spark.color} onHover={setHover} />}</div> : children && <div className="mt-3">{children}</div>}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Mise en route                                                       */
/* ------------------------------------------------------------------ */

const ownPhoto = (url: string) => !url.startsWith('/media/')

/** Les réglages qui rendent le site prêt à recevoir des clients, vérifiés sur les vraies données. */
function useSetupSteps(go: (page: string) => void) {
  const settings = useSite((s) => s.settings)
  const products = useSite((s) => s.products)
  const realisations = useSite((s) => s.realisations)
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  useEffect(() => {
    api.admin.authStatus().then(setAuth, () => {})
  }, [])
  return useMemo(
    () => [
      { label: 'Ajouter votre logo', hint: 'Barre du site, écran de chargement, accueil', done: !!settings.logo, page: 'apparence' },
      { label: 'Téléphone et WhatsApp', hint: 'Numéro et indicatif du pays', done: !!(settings.phones[0] && settings.whatsappCountryCode), page: 'parametres' },
      { label: 'Choisir la devise des prix', hint: 'Sinon « Prix sur demande » partout', done: !!settings.currency, page: 'parametres' },
      { label: 'Photographier vos produits', hint: 'Au moins un produit avec vos propres photos', done: products.some((p) => p.images.some(ownPhoto)), page: 'produits' },
      { label: 'Montrer vos réalisations', hint: 'Trois travaux avec vos photos', done: realisations.filter((r) => r.images.some(ownPhoto)).length >= 3, page: 'realisations' },
      { label: 'Activer « Continuer avec Google »', hint: 'Connexion en un clic pour vos clients', done: !!auth?.google, page: 'parametres' },
      { label: 'Activer les e-mails', hint: 'Liens « mot de passe oublié »', done: !!auth?.mail, page: 'parametres' },
    ].map((s) => ({ ...s, go: () => go(s.page) })),
    [settings, products, realisations, auth, go],
  )
}

function SetupCard({ go }: { go: (page: string) => void }) {
  const steps = useSetupSteps(go)
  const done = steps.filter((s) => s.done).length
  const pct = Math.round((done / steps.length) * 100)
  if (done === steps.length) return null
  const R = 26
  const C = 2 * Math.PI * R
  return (
    <section className="admin-enter mb-6 overflow-hidden rounded-[22px] bg-white ring-1 ring-ink/[0.07]">
      <div className="grid gap-6 p-5 md:p-7 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex items-center gap-5 lg:flex-col lg:items-start">
          <div className="relative grid size-[68px] shrink-0 place-items-center">
            <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="32" cy="32" r={R} fill="none" stroke="#e8edf5" strokeWidth="6" />
              <circle cx="32" cy="32" r={R} fill="none" stroke="url(#setup)" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-1000" />
              <defs>
                <linearGradient id="setup" x1="0" x2="1">
                  <stop offset="0" stopColor="#2563eb" />
                  <stop offset="1" stopColor="#22b8f0" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-mono text-[14px] font-semibold">{pct} %</span>
          </div>
          <div>
            <p className="kicker text-accent">Mise en route</p>
            <h2 className="mt-1.5 font-display text-[1.6rem] leading-tight">
              {done} / {steps.length} étapes
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/55">Quelques réglages pour un site complet, à votre image.</p>
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.label}>
              <button
                onClick={s.go}
                disabled={s.done}
                className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition ${s.done ? 'bg-emerald-50/60' : 'bg-[#f4f7fb] hover:bg-accent-soft hover:ring-1 hover:ring-accent/20'}`}
              >
                <span className={`grid size-7 shrink-0 place-items-center rounded-full ${s.done ? 'bg-emerald-500 text-white' : 'bg-white text-ink/30 ring-1 ring-ink/15'}`}>
                  {s.done ? <CheckIcon className="size-4" /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14px] font-semibold ${s.done ? 'text-ink/45 line-through decoration-ink/25' : ''}`}>{s.label}</span>
                  <span className="block truncate text-[12.5px] text-ink/45">{s.hint}</span>
                </span>
                {!s.done && <span className="shrink-0 text-[13px] font-semibold text-accent">Faire →</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

const serviceTitle = (slug: string) => SERVICES.find((s) => s.slug === slug)?.title ?? slug

export function Dashboard({ user, stats, go }: { user: AuthUser; stats: AdminStats | null; go: (page: string) => void }) {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    Promise.all([api.admin.quotes(), api.admin.orders()])
      .then(([q, o]) => {
        setQuotes(q.slice(0, 5))
        setOrders(o.slice(0, 5))
      })
      .catch((err) => toast(errorText(err), 'error'))
  }, [])

  const hour = new Date().getHours()
  const hello = hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour'
  const pending = stats ? stats.quotes.nouveau + stats.orders.nouvelle + stats.reviews.enAttente : 0
  const dates = stats?.activity.map((d) => d.date) ?? []
  const sum = (k: 'quotes' | 'orders') => stats?.activity.reduce((n, d) => n + d[k], 0) ?? 0

  return (
    <>
      <PageHeader
        kicker="Tableau de bord"
        title={`${hello} ${firstName(user)}`}
        subtitle={
          !stats
            ? 'Vue d’ensemble de l’activité du site.'
            : pending
              ? `${pending} élément${pending > 1 ? 's attendent' : ' attend'} votre réponse : ${[
                  stats.quotes.nouveau && `${stats.quotes.nouveau} devis`,
                  stats.orders.nouvelle && `${stats.orders.nouvelle} commande${stats.orders.nouvelle > 1 ? 's' : ''}`,
                  stats.reviews.enAttente && `${stats.reviews.enAttente} avis`,
                ]
                  .filter(Boolean)
                  .join(', ')}.`
              : 'Tout est à jour : aucune demande en attente.'
        }
      />

      <SetupCard go={go} />

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Devis à traiter"
            value={stats.quotes.nouveau}
            sub={`${sum('quotes')} reçus en 14 jours · ${stats.quotes.total} au total`}
            go={() => go('devis')}
            spark={{ values: stats.activity.map((d) => d.quotes), dates, color: SERIES[0]!.color, unit: 'devis' }}
          />
          <Kpi
            label="Commandes nouvelles"
            value={stats.orders.nouvelle}
            sub={`${sum('orders')} en 14 jours · ${stats.orders.total} au total`}
            go={() => go('commandes')}
            spark={{ values: stats.activity.map((d) => d.orders), dates, color: SERIES[1]!.color, unit: 'commande' }}
          />
          <Kpi label="Comptes clients" value={stats.clients.total} sub={stats.clients.nouveaux ? `+${stats.clients.nouveaux} ces 30 derniers jours` : 'Aucune inscription ce mois-ci'} go={() => go('clients')}>
            <p className="text-[12.5px] text-ink/45">
              {stats.products.actifs} produit{stats.products.actifs > 1 ? 's' : ''} en vitrine · {stats.realisations} réalisation{stats.realisations > 1 ? 's' : ''}
            </p>
          </Kpi>
          <Kpi
            label="Avis clients"
            value={stats.reviews.moyenne ? `${stats.reviews.moyenne.toLocaleString('fr-FR')}/5` : '—'}
            sub={stats.reviews.enAttente ? `${stats.reviews.enAttente} à modérer` : `${stats.reviews.total} avis, aucun en attente`}
            go={() => go('avis')}
          >
            <Stars value={Math.round(stats.reviews.moyenne)} />
          </Kpi>
        </div>
      )}

      <div className="mt-6">{stats && <ActivityChart data={stats.activity} />}</div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Derniers devis</h2>
            <button className="text-[13px] font-semibold text-accent" onClick={() => go('devis')}>
              Tout voir →
            </button>
          </div>
          {quotes.length ? (
            <ul className="divide-y divide-ink/5">
              {quotes.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{q.fullName}</span>
                    <span className="block truncate text-ink/50">{serviceTitle(q.service)}</span>
                  </span>
                  {q.status === 'nouveau' ? <Pill tone="accent">Nouveau</Pill> : <Pill>{q.status === 'en_cours' ? 'En cours' : 'Traité'}</Pill>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[14px] text-ink/45">Aucun devis pour l’instant.</p>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Dernières commandes</h2>
            <button className="text-[13px] font-semibold text-accent" onClick={() => go('commandes')}>
              Tout voir →
            </button>
          </div>
          {orders.length ? (
            <ul className="divide-y divide-ink/5">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{o.fullName}</span>
                    <span className="block truncate text-ink/50">
                      {o.items.reduce((n, i) => n + i.qty, 0)} article(s) · {formatPrice(o.total)}
                    </span>
                  </span>
                  {o.status === 'nouvelle' ? <Pill tone="accent">Nouvelle</Pill> : <Pill>{{ confirmee: 'Confirmée', livree: 'Livrée', annulee: 'Annulée', nouvelle: 'Nouvelle' }[o.status]}</Pill>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[14px] text-ink/45">Aucune commande pour l’instant.</p>
          )}
        </Card>
      </div>
    </>
  )
}
