import type { AdminUser, UserRole } from '@atelier/shared'
import { useEffect, useMemo, useState } from 'react'
import { BRAND } from '../../config/brand'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Avatar } from '../../ui/Avatar'
import { CheckIcon, WhatsAppIcon } from '../../ui/primitives'
import { Card, Drawer, Empty, errorText, inputCls, PageHeader, Pill, toast } from '../ui'

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const ago = (iso: string | null) => {
  if (!iso) return 'Jamais'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'Aujourd’hui' : days === 1 ? 'Hier' : days < 30 ? `Il y a ${days} j` : fmtDay(iso)
}
const ROLE_FILTERS = [
  { value: 'tous', label: 'Tous' },
  { value: 'client', label: 'Clients' },
  { value: 'admin', label: 'Administrateurs' },
] as const

function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, '')
  const cc = BRAND.whatsappCountryCode
  const full = phone.trim().startsWith('+') || !cc || digits.startsWith(cc) ? digits : `${cc}${digits}`
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card className="admin-enter !p-5">
      <p className="kicker text-ink/45">{label}</p>
      <p className="mt-2 font-display text-4xl leading-none">{value}</p>
      <p className="mt-2 text-[12.5px] text-ink/45">{hint}</p>
    </Card>
  )
}

/** Comptes du site : clients et administrateurs, avec leur activité. */
export function UsersPage() {
  const me = useAuth((s) => s.user)
  const [list, setList] = useState<AdminUser[] | null>(null)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<'tous' | UserRole>('tous')
  const [selected, setSelected] = useState<AdminUser | null>(null)

  const load = () => api.admin.users().then(setList, (e) => toast(errorText(e), 'error'))
  useEffect(() => {
    void load()
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (list ?? []).filter((u) => (role === 'tous' || u.role === role) && (!q || `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q)))
  }, [list, query, role])

  const month = Date.now() - 30 * 86_400_000
  const stats = useMemo(() => {
    const all = list ?? []
    return {
      total: all.filter((u) => u.role === 'client').length,
      fresh: all.filter((u) => u.role === 'client' && new Date(u.createdAt).getTime() > month).length,
      active: all.filter((u) => u.lastLoginAt && new Date(u.lastLoginAt).getTime() > month).length,
    }
  }, [list, month])

  return (
    <>
      <PageHeader kicker="Clients" title="Comptes clients" subtitle="Les comptes créés sur le site, leurs devis, commandes et avis. Chaque client retrouve son historique dans « Mon compte »." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Comptes clients" value={stats.total} hint="Depuis l’ouverture des comptes" />
        <Stat label="Nouveaux" value={stats.fresh} hint="Ces 30 derniers jours" />
        <Stat label="Actifs" value={stats.active} hint="Connectés ces 30 derniers jours" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Rechercher</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] size-4 -translate-y-1/2 text-ink/40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input className={`${inputCls} !bg-white pl-10`} placeholder="Nom, e-mail ou téléphone…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="flex gap-2">
          {ROLE_FILTERS.map((f) => (
            <button key={f.value} onClick={() => setRole(f.value)} className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${role === f.value ? 'bg-ink text-paper' : 'bg-white ring-1 ring-ink/10 hover:ring-ink/25'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {list === null ? null : visible.length === 0 ? (
        <Empty>{list.length ? 'Aucun compte ne correspond à cette recherche.' : 'Aucun compte pour l’instant : ils apparaîtront ici dès la première inscription.'}</Empty>
      ) : (
        <Card className="admin-enter overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-ink/[0.07] text-[11px] font-bold uppercase tracking-[0.12em] text-ink/40">
                  <th className="px-5 py-3.5">Compte</th>
                  <th className="px-3 py-3.5">Connexion</th>
                  <th className="px-3 py-3.5 text-center">Devis</th>
                  <th className="px-3 py-3.5 text-center">Commandes</th>
                  <th className="px-3 py-3.5 text-center">Avis</th>
                  <th className="px-3 py-3.5">Inscrit</th>
                  <th className="px-5 py-3.5">Vu</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} onClick={() => setSelected(u)} className="cursor-pointer border-b border-ink/[0.05] transition last:border-0 hover:bg-[#f6f9fd]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} className="size-9 text-[13px]" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-semibold">
                            {u.name || '—'} {u.role === 'admin' && <Pill tone="accent">Admin</Pill>}
                            {u.id === me?.id && <span className="text-[12px] font-normal text-ink/40">(vous)</span>}
                          </p>
                          <p className="truncate text-[12.5px] text-ink/50">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {u.google && <Pill tone="neutral">Google</Pill>}
                        {u.hasPassword && <Pill tone="neutral">E-mail</Pill>}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono">{u.quotes || '·'}</td>
                    <td className="px-3 py-3.5 text-center font-mono">{u.orders || '·'}</td>
                    <td className="px-3 py-3.5 text-center font-mono">{u.reviews || '·'}</td>
                    <td className="px-3 py-3.5 text-ink/60">{fmtDay(u.createdAt)}</td>
                    <td className="px-5 py-3.5 text-ink/60">{ago(u.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selected && (
        <UserDrawer
          user={selected}
          self={selected.id === me?.id}
          onClose={() => setSelected(null)}
          onChanged={(role) => {
            setList((l) => l?.map((x) => (x.id === selected.id ? { ...x, role } : x)) ?? l)
            setSelected({ ...selected, role })
          }}
        />
      )}
    </>
  )
}

function UserDrawer({ user, self, onClose, onChanged }: { user: AdminUser; self: boolean; onClose: () => void; onChanged: (role: UserRole) => void }) {
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const nextRole: UserRole = user.role === 'admin' ? 'client' : 'admin'

  const makeLink = async () => {
    setBusy(true)
    try {
      setLink(await api.admin.resetLink(user.id))
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  const changeRole = async () => {
    if (!confirm) return setConfirm(true)
    setBusy(true)
    try {
      await api.admin.setUserRole(user.id, nextRole)
      onChanged(nextRole)
      toast(nextRole === 'admin' ? `${user.name || user.email} est maintenant administrateur` : 'Rôle administrateur retiré')
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Copie impossible : sélectionnez le lien à la main', 'error')
    }
  }

  return (
    <Drawer
      title={user.name || user.email}
      onClose={onClose}
      footer={
        <>
          <span className="text-[12.5px] text-ink/45">Inscrit le {fmtDay(user.createdAt)}</span>
          <button onClick={onClose} className="btn btn-ink h-11">
            Fermer
          </button>
        </>
      }
    >
      <Card>
        <div className="flex items-center gap-4">
          <Avatar user={user} className="size-16 text-[22px]" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-2xl">
              {user.name || '—'} {user.role === 'admin' && <Pill tone="accent">Admin</Pill>}
            </p>
            <a href={`mailto:${user.email}`} className="block truncate text-[14px] text-accent hover:underline">
              {user.email}
            </a>
            {user.phone && <p className="text-[14px] text-ink/60">{user.phone}</p>}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            ['Devis', user.quotes],
            ['Commandes', user.orders],
            ['Avis', user.reviews],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-[#f4f7fb] p-3">
              <dt className="kicker text-ink/45">{k}</dt>
              <dd className="mt-1 font-display text-3xl">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-ink/50">
          Connexion : {[user.google && 'Google', user.hasPassword && 'e-mail et mot de passe'].filter(Boolean).join(' · ') || '—'} · dernière visite : {ago(user.lastLoginAt).toLowerCase()}
        </p>
      </Card>

      {user.role === 'client' && (
        <Card>
          <h3 className="font-display text-xl">Mot de passe oublié</h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink/55">
            Créez un lien sécurisé, valable 24 heures et utilisable une seule fois, puis envoyez-le au client. Le mot de passe actuel n’est jamais affiché : il en choisit un nouveau.
          </p>
          {link ? (
            <div className="mt-4 space-y-3">
              <input readOnly value={link.url} onFocus={(e) => e.target.select()} className={`${inputCls} font-mono text-[12.5px]`} />
              <div className="flex flex-wrap gap-2">
                <button onClick={copy} className="btn h-10 bg-ink px-4 text-[13.5px] text-paper">
                  {copied ? (
                    <>
                      <CheckIcon className="size-4" /> Copié
                    </>
                  ) : (
                    'Copier le lien'
                  )}
                </button>
                {user.phone && (
                  <a
                    href={waLink(user.phone, `Bonjour ${user.name.split(' ')[0] ?? ''}, voici votre lien pour choisir un nouveau mot de passe (valable 24 h) : ${link.url}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn h-10 bg-[#1faa59] px-4 text-[13.5px] text-white"
                  >
                    <WhatsAppIcon className="size-4" /> Envoyer sur WhatsApp
                  </a>
                )}
              </div>
              <p className="text-[12.5px] text-ink/45">Expire le {new Date(link.expiresAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}. Créer un nouveau lien annule le précédent.</p>
            </div>
          ) : (
            <button onClick={makeLink} disabled={busy} className="btn btn-ink mt-4 h-11 disabled:opacity-50">
              Créer un lien de réinitialisation
            </button>
          )}
        </Card>
      )}

      <Card>
        <h3 className="font-display text-xl">Rôle</h3>
        {self ? (
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink/55">C’est votre compte : votre rôle ne peut être modifié que par un autre administrateur.</p>
        ) : (
          <>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/55">
              {user.role === 'admin'
                ? 'Ce compte a accès à toute l’administration. Le retirer le repasse en compte client.'
                : 'Un administrateur accède à toute l’administration : devis, commandes, produits, clients et réglages du site. À réserver aux personnes de confiance.'}
            </p>
            <button
              onClick={changeRole}
              disabled={busy}
              className={`btn mt-4 h-11 disabled:opacity-50 ${confirm ? 'bg-rose-600 text-white' : user.role === 'admin' ? 'text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50' : 'btn-ink'}`}
            >
              {confirm ? 'Confirmer ?' : user.role === 'admin' ? 'Retirer le rôle administrateur' : 'Nommer administrateur'}
            </button>
          </>
        )}
      </Card>
    </Drawer>
  )
}
