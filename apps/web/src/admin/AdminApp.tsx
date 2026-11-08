import { ADMIN_PASSWORD_MIN, type AdminStats, type AuthUser } from '@atelier/shared'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { NewPasswordForm, Spinner } from '../auth/forms'
import { accessEvents, api } from '../lib/api'
import { firstName, useAuth } from '../lib/auth'
import { loadSite, useSite } from '../lib/site'
import { Avatar } from '../ui/Avatar'
import { thumbUrl } from '../ui/img'
import { Logo, Mark } from '../ui/primitives'
import { Dashboard } from './pages/Dashboard'
import { OrdersPage, QuotesPage, ReviewsPage } from './pages/Inbox'
import { ProductsPage, RealisationsPage } from './pages/Catalog'
import { AppearancePage } from './pages/Appearance'
import { AtelierPage, SettingsPage } from './pages/Settings'
import { MachinesPage, SectionsPage } from './pages/Texts'
import { UsersPage } from './pages/Users'
import { Toasts } from './ui'

type Page = 'tableau-de-bord' | 'devis' | 'commandes' | 'clients' | 'produits' | 'realisations' | 'apparence' | 'atelier' | 'sections' | 'machines' | 'avis' | 'parametres'

/** Menu de l'administration, regroupé comme on pense son activité. */
const NAV: Array<{ page: Page; label: string; icon: string; group: string; badge?: (s: AdminStats) => number }> = [
  { group: 'Vue d’ensemble', page: 'tableau-de-bord', label: 'Tableau de bord', icon: 'M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-16v4h6V4h-6Z' },
  { group: 'Ventes & demandes', page: 'devis', label: 'Devis', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6', badge: (s) => s.quotes.nouveau },
  { group: 'Ventes & demandes', page: 'commandes', label: 'Commandes', icon: 'M5 8h14l-1.2 12H6.2L5 8Zm4 0V6a3 3 0 0 1 6 0v2', badge: (s) => s.orders.nouvelle },
  { group: 'Clients', page: 'clients', label: 'Comptes clients', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 13.5a7 7 0 0 1 4 6.5' },
  { group: 'Clients', page: 'avis', label: 'Avis clients', icon: 'M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.8L12 3Z', badge: (s) => s.reviews.enAttente },
  { group: 'Catalogue', page: 'produits', label: 'Produits', icon: 'M4 7l8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v10' },
  { group: 'Catalogue', page: 'realisations', label: 'Réalisations', icon: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5' },
  { group: 'Design du site', page: 'apparence', label: 'Apparence du site', icon: 'M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.2-4-7.4-9-7.4ZM7.5 12a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm3-4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm4 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z' },
  { group: 'Design du site', page: 'atelier', label: 'Textes de l’atelier', icon: 'M4 6h16M4 12h10M4 18h13' },
  { group: 'Design du site', page: 'sections', label: 'Sections de la page', icon: 'M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z' },
  { group: 'Design du site', page: 'machines', label: 'Machines de l’atelier', icon: 'M2 8h20v7H2zM5 8V5h14v3M5 15v5h14v-5M17 11.5h2' },
  { group: 'Entreprise', page: 'parametres', label: 'Paramètres', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h5l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z' },
]
const GROUPS = [...new Set(NAV.map((n) => n.group))]

/** Couleur du cadre (barre latérale et barre du haut). */
const FRAME = '#101a3c'
/** Largeur de la barre latérale, dépliée ou repliée (reprise par la barre d'enregistrement). */
const RAIL = { open: '264px', closed: '84px' }
const RAIL_KEY = 'abt-admin-rail'

const readPage = (): Page => {
  const h = window.location.hash.replace(/^#\/?/, '') as Page
  return NAV.some((n) => n.page === h) ? h : 'tableau-de-bord'
}

function Icon({ d, className = 'size-5' }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

/** Écran d'entrée (accès refusé, premier mot de passe) : la façade de l'atelier à gauche, la carte à droite. */
function Gate({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh bg-[#f4f7fb] text-ink lg:grid-cols-[1.15fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/media/atelier-facade.webp" alt="" className="auth-kenburns absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-[#0a1124] via-[#0a1124]/45 to-[#0a1124]/10" />
        <div className="absolute inset-x-12 bottom-12 text-white">
          <p className="kicker flex items-center gap-2 text-white/70">
            <span className="colorbar inline-block h-2 w-8" /> Administration
          </p>
          <p className="mt-4 font-display text-[clamp(2.4rem,3.6vw,3.6rem)] leading-[1.02]">
            Votre atelier,
            <br />
            <em>en coulisses.</em>
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">Produits, réalisations, devis, commandes, clients, textes et visuels : tout ce que voient vos clients se règle ici.</p>
        </div>
      </div>
      <div className="grid place-items-center px-5 py-10">
        <div className="panel-enter w-full max-w-md rounded-[28px] bg-white p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.4)] ring-1 ring-ink/5">{children}</div>
      </div>
    </div>
  )
}

/** Compte CLIENT sur /admin : l'accès est refusé (le serveur refuse aussi chaque requête). */
function AccessDenied({ user }: { user: AuthUser }) {
  return (
    <Gate>
      <span className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
        </svg>
      </span>
      <h1 className="mt-6 font-display text-[2.3rem] leading-[1.02]">Accès réservé</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink/60">
        L’administration est réservée à l’équipe de l’atelier. Vous êtes connecté avec <strong className="text-ink">{user.email}</strong>, un compte client.
      </p>
      <div className="mt-8 grid gap-2.5">
        <a href="/compte" className="btn h-12 justify-center rounded-xl bg-linear-to-r from-accent to-[#1d9bf0] text-white hover:brightness-110">
          Aller à mon compte
        </a>
        <button
          onClick={async () => {
            await useAuth.getState().logout()
            window.location.assign('/connexion?next=/admin')
          }}
          className="h-12 rounded-xl text-[14.5px] font-semibold text-ink/65 ring-1 ring-ink/12 hover:text-ink hover:ring-ink/25"
        >
          Se connecter avec un autre compte
        </button>
        <a href="/" className="mt-2 text-center text-[13px] font-semibold text-ink/45 hover:text-ink">
          ← Retour au site
        </a>
      </div>
    </Gate>
  )
}

/** Première connexion : le mot de passe fourni à la livraison est remplacé avant tout le reste. */
function FirstPassword({ user }: { user: AuthUser }) {
  return (
    <Gate>
      <Logo />
      <p className="kicker mt-8 flex items-center gap-2 text-ink/45">
        <span className="text-accent">●</span> Première connexion
      </p>
      <h1 className="mt-3 font-display text-[2.2rem] leading-[1.02]">Choisissez votre mot de passe</h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink/60">
        Bienvenue {firstName(user)}. Le mot de passe reçu à la livraison du site était temporaire : remplacez-le par le vôtre. Vous seul le connaîtrez, et les autres appareils seront déconnectés.
      </p>
      <div className="mt-7">
        <NewPasswordForm
          submitLabel="Enregistrer et ouvrir l’administration"
          min={ADMIN_PASSWORD_MIN}
          needCurrent={user.hasPassword}
          onSubmit={async (next, current) => useAuth.getState().setUser(await api.account.changePassword(next, current))}
        />
      </div>
      <button
        onClick={async () => {
          await useAuth.getState().logout()
          window.location.assign('/')
        }}
        className="mt-5 block w-full text-center text-[13px] font-semibold text-ink/45 hover:text-ink"
      >
        Se déconnecter
      </button>
    </Gate>
  )
}

/* ------------------------------------------------------------------ */
/* Menus de la barre du haut                                           */
/* ------------------------------------------------------------------ */

/** Ouverture / fermeture d'un petit menu : clic à l'extérieur ou Échap le referment. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, box }
}

const popCls = 'menu-pop absolute right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl bg-white text-ink shadow-[0_24px_60px_-20px_rgba(5,10,24,0.55)] ring-1 ring-ink/10'

/** Ce qui attend une action : devis, commandes, avis. */
function Notifications({ stats, go }: { stats: AdminStats | null; go: (p: Page) => void }) {
  const { open, setOpen, box } = usePopover()
  const rows = stats
    ? [
        { page: 'devis' as const, label: 'Devis à traiter', n: stats.quotes.nouveau },
        { page: 'commandes' as const, label: 'Commandes nouvelles', n: stats.orders.nouvelle },
        { page: 'avis' as const, label: 'Avis à modérer', n: stats.reviews.enAttente },
      ]
    : []
  const total = rows.reduce((s, r) => s + r.n, 0)
  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={total ? `${total} élément${total > 1 ? 's' : ''} à traiter` : 'Rien à traiter'}
        className="relative grid size-10 place-items-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <Icon d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" />
        {total > 0 && <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-accent-2 px-1 font-mono text-[10.5px] font-bold leading-[18px] text-[#04122b]">{total}</span>}
      </button>
      {open && (
        <div className={`${popCls} w-72`}>
          <p className="border-b border-ink/[0.07] px-4 py-3 text-[13px] font-semibold text-ink/55">{total ? 'À traiter' : 'Tout est à jour'}</p>
          <div className="p-1.5">
            {rows.map((r) => (
              <button
                key={r.page}
                onClick={() => {
                  setOpen(false)
                  go(r.page)
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] hover:bg-[#f1f5fb]"
              >
                {r.label}
                <span className={`min-w-7 rounded-full px-2 text-center font-mono text-[12px] font-semibold leading-6 ${r.n ? 'bg-accent text-white' : 'bg-ink/[0.06] text-ink/45'}`}>{r.n}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu({ user, onLogout, go }: { user: AuthUser; onLogout: () => void; go: (p: Page) => void }) {
  const { open, setOpen, box } = usePopover()
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={`Compte de ${firstName(user)}`} className="ml-1 rounded-full ring-2 ring-white/15 transition hover:ring-white/40">
        <Avatar user={user} className="size-9 text-[14px]" />
      </button>
      {open && (
        <div role="menu" className={`${popCls} w-72`}>
          <div className="flex items-center gap-3 border-b border-ink/[0.07] p-4">
            <Avatar user={user} className="size-11 text-[16px]" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{user.name || firstName(user)}</p>
              <p className="truncate text-[12.5px] text-ink/50">{user.email}</p>
            </div>
            <span className="kicker ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 !text-[9.5px] text-white">Admin</span>
          </div>
          <div className="p-1.5 text-[14px]">
            <a role="menuitem" href="/compte" className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-ink/80 hover:bg-[#f1f5fb]">
              <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" className="size-[18px]" /> Mon profil
            </a>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false)
                go('parametres')
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium text-ink/80 hover:bg-[#f1f5fb]"
            >
              <Icon d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" className="size-[18px]" /> Paramètres et sécurité
            </button>
            <a role="menuitem" href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-ink/80 hover:bg-[#f1f5fb]">
              <Icon d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" className="size-[18px]" /> Voir le site
            </a>
          </div>
          <div className="border-t border-ink/[0.07] p-1.5">
            <button role="menuitem" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-rose-600 hover:bg-rose-50">
              <Icon d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" className="size-[18px]" /> Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cadre de l'administration                                           */
/* ------------------------------------------------------------------ */

function Shell({ user, onLogout, children, page, go, stats }: { user: AuthUser; onLogout: () => void; children: ReactNode; page: Page; go: (p: Page) => void; stats: AdminStats | null }) {
  const [menu, setMenu] = useState(false)
  const [rail, setRail] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) === '1'
    } catch {
      return false
    }
  })
  const logo = useSite((s) => s.settings.logo)
  const siteName = useSite((s) => s.settings.name)
  const current = NAV.find((n) => n.page === page)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // la largeur de la barre latérale est partagée avec la barre d'enregistrement (fixée en bas de l'écran)
  useEffect(() => {
    document.documentElement.style.setProperty('--admin-rail', rail ? RAIL.closed : RAIL.open)
    try {
      localStorage.setItem(RAIL_KEY, rail ? '1' : '0')
    } catch {
      /* préférence non gardée */
    }
  }, [rail])

  const nav = (compact: boolean) => (
    <nav className={compact ? 'space-y-3' : 'space-y-6'} aria-label="Administration">
      {GROUPS.map((group) => (
        <div key={group}>
          {compact ? (
            <span className="mx-auto mb-3 block h-px w-8 bg-white/10" aria-hidden />
          ) : (
            <p className="mb-2 px-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-white/40">{group}</p>
          )}
          <div className="space-y-0.5">
            {NAV.filter((n) => n.group === group).map((n) => {
              const badge = stats && n.badge ? n.badge(stats) : 0
              const on = page === n.page
              return (
                <button
                  key={n.page}
                  onClick={() => {
                    go(n.page)
                    setMenu(false)
                  }}
                  title={compact ? n.label : undefined}
                  aria-label={compact ? n.label : undefined}
                  aria-current={on ? 'page' : undefined}
                  className={`relative flex w-full items-center rounded-xl text-left text-[14px] font-medium transition-colors ${compact ? 'justify-center py-2.5' : 'gap-3 px-3 py-2.5'} ${
                    on ? 'bg-white/[0.13] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <Icon d={n.icon} />
                  {!compact && <span className="flex-1 truncate">{n.label}</span>}
                  {badge > 0 &&
                    (compact ? (
                      <span className="absolute right-3 top-2 size-2 rounded-full bg-accent-2 ring-2 ring-[#101a3c]" />
                    ) : (
                      <span className="grid min-w-5 place-items-center rounded-full bg-accent-2 px-1.5 font-mono text-[11px] font-bold leading-5 text-[#04122b]">{badge}</span>
                    ))}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-svh text-ink" style={{ background: FRAME }}>
      {/* le cadre de la marque (barre latérale + barre du haut) entoure une feuille claire où l'on travaille */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden flex-col text-white transition-[width] duration-500 ease-[var(--ease-expo)] lg:flex" style={{ width: 'var(--admin-rail, 264px)', background: FRAME }}>
        <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-accent/20 blur-3xl" />
        <div className={`relative flex h-16 shrink-0 items-center ${rail ? 'justify-center' : 'px-6'}`}>
          <a href="/" target="_blank" rel="noreferrer" aria-label={`Voir le site ${siteName}`}>
            {!rail ? (
              <Logo onDark />
            ) : logo ? (
              <span className="grid size-10 place-items-center rounded-xl bg-white p-1">
                <img src={thumbUrl(logo, 120)} alt="" className="max-h-full max-w-full object-contain" />
              </span>
            ) : (
              <Mark className="size-8 text-white" />
            )}
          </a>
        </div>
        <div className={`relative min-h-0 flex-1 overflow-y-auto pb-6 pt-5 ${rail ? 'px-3' : 'px-4'}`}>{nav(rail)}</div>
        {/* replier la barre pour donner toute la place au travail */}
        <button
          onClick={() => setRail((r) => !r)}
          aria-label={rail ? 'Déplier le menu' : 'Replier le menu'}
          title={rail ? 'Déplier le menu' : 'Replier le menu'}
          className="absolute -right-3 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[0_6px_16px_-6px_rgba(5,10,24,0.6)] ring-1 ring-ink/10 transition hover:scale-110"
        >
          <svg viewBox="0 0 24 24" className={`size-4 transition-transform duration-500 ${rail ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m14.5 6-6 6 6 6" />
          </svg>
        </button>
      </aside>

      <div className="transition-[padding] duration-500 ease-[var(--ease-expo)] lg:pl-[var(--admin-rail,264px)]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 px-4 text-white md:px-6" style={{ background: FRAME }}>
          <span className="lg:hidden">
            <Logo onDark />
          </span>
          <span className="hidden items-center gap-2.5 rounded-full bg-white/[0.07] py-1.5 pl-3 pr-4 text-[13px] font-semibold ring-1 ring-white/15 lg:inline-flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            Site en ligne
            <span className="font-medium text-white/45">· {siteName}</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            <a href="/" target="_blank" rel="noreferrer" className="hidden h-10 items-center gap-2 rounded-xl px-3 text-[13.5px] font-semibold text-white/80 transition hover:bg-white/10 hover:text-white md:inline-flex">
              <Icon d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" className="size-[18px]" />
              Aperçu du site
            </a>
            <Notifications stats={stats} go={go} />
            <UserMenu user={user} onLogout={onLogout} go={go} />
            <button onClick={() => setMenu((m) => !m)} className="ml-1 rounded-xl px-3.5 py-2 text-[14px] font-semibold ring-1 ring-white/20 lg:hidden" aria-expanded={menu}>
              {menu ? 'Fermer' : 'Menu'}
            </button>
          </div>
        </header>
        {menu && (
          <div className="panel-enter fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto p-5 text-white lg:hidden" style={{ background: FRAME }}>
            {nav(false)}
          </div>
        )}

        {/* la feuille de travail */}
        <div className="min-h-[calc(100svh-4rem)] bg-[#f3f6fb] lg:rounded-tl-[28px]">
          <div className="flex h-14 items-center justify-between gap-4 border-b border-ink/[0.07] bg-white px-5 lg:rounded-tl-[28px] lg:px-8">
            <p className="min-w-0 truncate text-[13.5px] text-ink/45">
              <span className="hidden sm:inline">
                Administration <span className="mx-1.5">/</span>
              </span>
              {current?.group} <span className="mx-1.5">/</span> <span className="font-semibold text-ink">{current?.label}</span>
            </p>
            <p className="hidden shrink-0 text-[13px] text-ink/40 first-letter:uppercase md:block">{today}</p>
          </div>
          <main className="px-4 py-6 md:px-8 lg:px-10 lg:py-8">
            {/* fondu seul (pas de transform) : les fenêtres fixes des pages (panneaux d'édition) restent calées sur l'écran */}
            <div key={page} className="admin-page mx-auto max-w-[1200px]">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Toasts />
    </div>
  )
}

/**
 * /admin : même connexion que le reste du site, puis vérification du rôle.
 * Pas de session → page de connexion ; compte CLIENT → accès refusé ; ADMIN → tableau de bord.
 * L'interface suit ce que dit le serveur, qui contrôle lui-même chaque requête.
 */
export default function AdminApp() {
  const user = useAuth((s) => s.user)
  const name = useSite((s) => s.settings.name)

  useEffect(() => {
    document.body.style.background = FRAME
    void loadSite()
    void useAuth.getState().load()
    // session expirée ou droits retirés en cours de route : on revérifie, l'écran suit
    accessEvents.onDenied = (status) => {
      if (status === 401) useAuth.setState({ user: null })
      else void useAuth.getState().load()
    }
    return () => {
      accessEvents.onDenied = null
    }
  }, [])

  useEffect(() => {
    document.title = `Administration — ${name}`
  }, [name])

  useEffect(() => {
    if (user === null) window.location.replace(`/connexion?next=${encodeURIComponent(window.location.pathname + window.location.hash)}`)
  }, [user])

  if (!user)
    return (
      <div className="grid min-h-svh place-items-center bg-[#f4f7fb]">
        <Spinner className="border-ink/15 border-t-accent" />
      </div>
    )
  if (user.role !== 'admin') return <AccessDenied user={user} />
  if (user.mustChangePassword) return <FirstPassword user={user} />
  return <Admin user={user} />
}

function Admin({ user }: { user: AuthUser }) {
  const [page, setPage] = useState<Page>(readPage)
  const [stats, setStats] = useState<AdminStats | null>(null)

  const refreshStats = useCallback(() => {
    api.admin.stats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    const onHash = () => setPage(readPage())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    refreshStats()
  }, [page, refreshStats])

  const go = (p: Page) => {
    window.location.hash = `/${p}`
    setPage(p)
    window.scrollTo(0, 0)
  }

  const logout = async () => {
    await useAuth.getState().logout()
    window.location.assign('/connexion')
  }

  return (
    <Shell user={user} onLogout={logout} page={page} go={go} stats={stats}>
      {page === 'tableau-de-bord' && <Dashboard user={user} stats={stats} go={(p) => go(p as Page)} />}
      {page === 'devis' && <QuotesPage />}
      {page === 'commandes' && <OrdersPage />}
      {page === 'produits' && <ProductsPage />}
      {page === 'realisations' && <RealisationsPage />}
      {page === 'apparence' && <AppearancePage />}
      {page === 'atelier' && <AtelierPage />}
      {page === 'sections' && <SectionsPage />}
      {page === 'machines' && <MachinesPage />}
      {page === 'avis' && <ReviewsPage />}
      {page === 'clients' && <UsersPage />}
      {page === 'parametres' && <SettingsPage />}
    </Shell>
  )
}
