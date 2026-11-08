import { ADMIN_PASSWORD_MIN, SERVICES, STATION_SLUGS, type AuthStatus, type StationContent } from '@atelier/shared'
import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { StationPanelPreview } from '../previews'
import { useSettingsDraft } from '../settingsDraft'
import { Designer, errorText, Field, inputCls, PageHeader, Pill, Preview, SaveBar, Section, toast } from '../ui'
import { STATION_LABEL } from './Catalog'

/* ------------------------------------------------------------------ */
/* Textes des postes de l'atelier                                      */
/* ------------------------------------------------------------------ */

function StationCard({ station, onSaved }: { station: StationContent; onSaved: (s: StationContent) => void }) {
  const [s, setS] = useState(station)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(s) !== JSON.stringify(station)
  const number = String(STATION_SLUGS.indexOf(s.slug) + 1).padStart(2, '0')
  const save = async () => {
    setSaving(true)
    try {
      const { slug, ...input } = s
      await api.admin.saveStation(slug, input)
      onSaved(s)
      toast(`« ${STATION_LABEL[slug]} » mis à jour`)
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Section
      icon="M3 21h18M5 21V9l7-5 7 5v12M10 21v-5h4v5"
      title={
        <>
          <span className="mr-2.5 font-mono text-[13px] font-semibold text-accent">{number}</span>
          {STATION_LABEL[s.slug]}
        </>
      }
      text={`${s.kicker} — ${s.title.join(' ')}`}
      badge={dirty ? <Pill tone="warn">Modifié</Pill> : undefined}
      preview={
        <Preview label="Pendant la visite">
          <StationPanelPreview station={s} number={number} />
        </Preview>
      }
    >
          <Field label="Sur-titre">
            <input className={inputCls} value={s.kicker} onChange={(e) => setS({ ...s, kicker: e.target.value })} maxLength={40} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titre — ligne 1">
              <input className={inputCls} value={s.title[0]} onChange={(e) => setS({ ...s, title: [e.target.value, s.title[1]] })} maxLength={40} />
            </Field>
            <Field label="Titre — ligne 2 (en couleur)">
              <input className={inputCls} value={s.title[1]} onChange={(e) => setS({ ...s, title: [s.title[0], e.target.value] })} maxLength={40} />
            </Field>
          </div>
          <Field label="Texte">
            <textarea className={`${inputCls} min-h-24`} value={s.body} onChange={(e) => setS({ ...s, body: e.target.value })} maxLength={400} />
          </Field>
          <Field label="Mots-clés" hint="Séparés par des virgules (8 maximum).">
            <input
              className={inputCls}
              value={s.tags.join(', ')}
              onChange={(e) =>
                setS({
                  ...s,
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .slice(0, 8),
                })
              }
            />
          </Field>
          <Field label="Prestation pré-sélectionnée dans le devis">
            <select className={inputCls} value={s.service} onChange={(e) => setS({ ...s, service: e.target.value as StationContent['service'] })}>
              {SERVICES.map((sv) => (
                <option key={sv.slug} value={sv.slug}>
                  {sv.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center justify-end gap-2 border-t border-ink/[0.06] pt-4">
            {dirty && (
              <button onClick={() => setS(station)} className="rounded-xl px-3 py-2 text-[13px] font-semibold text-ink/55 hover:bg-ink/5">
                Annuler
              </button>
            )}
            <button onClick={save} disabled={!dirty || saving} className="btn h-10 bg-accent px-4 text-[13px] text-white disabled:opacity-30">
              {saving ? 'Enregistrement…' : 'Enregistrer ce poste'}
            </button>
          </div>
    </Section>
  )
}

export function AtelierPage() {
  const [stations, setStations] = useState<StationContent[]>([])
  useEffect(() => {
    api.admin.stations().then(setStations).catch((e) => toast(errorText(e), 'error'))
  }, [])
  return (
    <>
      <PageHeader kicker="Design du site" title="Textes de l’atelier" subtitle="Le panneau qui s’affiche à chaque poste pendant la visite 3D. Ouvrez un poste : l’aperçu montre exactement ce que lira le visiteur." />
      {stations.length > 0 && (
        <Designer>
          {stations.map((s) => (
            <StationCard key={s.slug} station={s} onSaved={(next) => setStations((l) => l.map((x) => (x.slug === next.slug ? next : x)))} />
          ))}
        </Designer>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Paramètres                                                          */
/* ------------------------------------------------------------------ */

/** Mot de passe de l'administrateur et déconnexion des autres appareils. */
function SecurityCard() {
  const user = useAuth((s) => s.user)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [saving, setSaving] = useState(false)
  const needCurrent = !!user?.hasPassword
  const save = async () => {
    setSaving(true)
    try {
      useAuth.getState().setUser(await api.account.changePassword(next, needCurrent ? current : undefined))
      setCurrent('')
      setNext('')
      toast('Mot de passe modifié · vos autres appareils sont déconnectés')
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setSaving(false)
    }
  }
  const others = async () => {
    try {
      await api.account.logoutOthers()
      toast('Les autres appareils sont déconnectés')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
  return (
    <Section icon="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Zm-3 9 2 2 4-4" title="Sécurité de votre compte" text={`Vous seul connaissez ce mot de passe : personne d’autre, pas même le développeur du site, n’y a accès. ${ADMIN_PASSWORD_MIN} caractères minimum.`}>
      <div className="grid gap-3 sm:grid-cols-2">
        {needCurrent && (
          <Field label="Mot de passe actuel">
            <input className={inputCls} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
        )}
        <Field label="Nouveau mot de passe">
          <input className={inputCls} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving || (needCurrent && !current) || next.length < ADMIN_PASSWORD_MIN} className="btn btn-ink disabled:opacity-30">
          Changer le mot de passe
        </button>
        <button onClick={others} className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-ink/60 ring-1 ring-ink/10 hover:text-ink hover:ring-ink/25">
          Déconnecter mes autres appareils
        </button>
      </div>
      <p className="text-[13px] leading-relaxed text-ink/50">
        Mot de passe oublié ? Sur la page de connexion, « Mot de passe oublié ? » envoie un lien temporaire à {user?.email ?? 'votre adresse'}.
      </p>
    </Section>
  )
}

function StatusRow({ ok, title, children }: { ok: boolean; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 rounded-2xl bg-[#f4f7fb] p-4 ring-1 ring-ink/[0.06]">
      <span className={`mt-1 size-2.5 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {title} <Pill tone={ok ? 'ok' : 'warn'}>{ok ? 'Activé' : 'À configurer'}</Pill>
        </p>
        <div className="mt-1 text-ink/60">{children}</div>
      </div>
    </div>
  )
}

/** Connexion Google et envoi d'e-mails : réglés sur le serveur (fichier .env), état affiché ici. */
function SignInMethodsCard() {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  useEffect(() => {
    api.admin.authStatus().then(setStatus, () => {})
  }, [])
  if (!status) return null
  return (
    <Section icon="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0M16 11l2 2 4-4" title="Connexion des clients" text="Vos clients se connectent avec leur e-mail et un mot de passe, ou avec Google. Ces réglages se font une fois, sur le serveur.">
      <StatusRow ok={status.google} title="Continuer avec Google">
        {status.google ? (
          'Le bouton « Continuer avec Google » est proposé sur la page de connexion.'
        ) : (
          <>
            Créez un « ID client OAuth » (type Application Web) dans la console Google Cloud, déclarez l’adresse de redirection ci-dessous, puis renseignez <code className="font-mono text-[12.5px]">GOOGLE_CLIENT_ID</code> et{' '}
            <code className="font-mono text-[12.5px]">GOOGLE_CLIENT_SECRET</code> dans le fichier .env du serveur.
          </>
        )}
        <span className="mt-2 block">
          Adresse de redirection : <code className="break-all rounded bg-white px-1.5 py-0.5 font-mono text-[12.5px] text-ink ring-1 ring-ink/10">{status.googleRedirectUri}</code>
        </span>
      </StatusRow>
      <StatusRow ok={status.mail} title="E-mails « Mot de passe oublié »">
        {status.mail
          ? 'Les liens de réinitialisation partent par e-mail (valables une heure, une seule fois).'
          : 'Renseignez SMTP_URL (et MAIL_FROM) dans le fichier .env du serveur. En attendant, générez un lien de réinitialisation depuis la page « Clients » et transmettez-le à votre client.'}
      </StatusRow>
    </Section>
  )
}

export function SettingsPage() {
  const { draft: s, set, dirty, saving, save, reset } = useSettingsDraft()
  if (!s) return null
  return (
    <>
      <PageHeader kicker="Entreprise" title="Paramètres" subtitle="Coordonnées, boutique, réseaux et sécurité de votre compte. Le logo, les textes d’accueil et la vitrine se règlent dans « Apparence du site »." />
      <div className="space-y-6 pb-24">
        <Section icon="M5.2 4.5h3l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6v3a1.6 1.6 0 0 1-1.7 1.6A15.6 15.6 0 0 1 3.6 6.2a1.6 1.6 0 0 1 1.6-1.7Z" title="Coordonnées" text="Affichées dans le pied de page, les boutons d’appel et les devis.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Field key={i} label={`Téléphone ${i + 1}`}>
                <input
                  className={inputCls}
                  value={s.phones[i] ?? ''}
                  onChange={(e) => {
                    const phones = [...s.phones]
                    phones[i] = e.target.value
                    set('phones', phones.filter((p, j) => p || j < i))
                  }}
                />
              </Field>
            ))}
          </div>
          <Field label="Indicatif pays pour WhatsApp" hint="Sans « + » (ex. 224, 237…). Active les boutons WhatsApp du site.">
            <input className={inputCls} value={s.whatsappCountryCode} onChange={(e) => set('whatsappCountryCode', e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </Field>
          <Field label="E-mail">
            <input className={inputCls} type="email" value={s.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Adresse">
              <input className={inputCls} value={s.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="Horaires">
              <input className={inputCls} value={s.hours} onChange={(e) => set('hours', e.target.value)} placeholder="ex. Lun – Sam · 8h – 19h" />
            </Field>
          </div>
        </Section>
        <Section icon="M5 8h14l-1.2 12H6.2L5 8Zm4 0V6a3 3 0 0 1 6 0v2" title="Boutique & réseaux" text="Sans devise, les prix s’affichent « Prix sur demande » partout. Les réseaux apparaissent dans le pied de page dès qu’un lien https:// est saisi.">
          <Field label="Devise affichée" hint="ex. FCFA, GNF.">
            <input className={inputCls} value={s.currency} onChange={(e) => set('currency', e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['facebook', 'instagram', 'tiktok'] as const).map((k) => (
              <Field key={k} label={k[0]!.toUpperCase() + k.slice(1)}>
                <input className={inputCls} value={s.socials[k]} onChange={(e) => set('socials', { ...s.socials, [k]: e.target.value })} placeholder="https://…" />
              </Field>
            ))}
          </div>
        </Section>
        <SecurityCard />
        <SignInMethodsCard />
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </>
  )
}
