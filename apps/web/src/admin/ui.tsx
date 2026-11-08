import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { api, ApiError } from '../lib/api'
import { thumbUrl } from '../ui/img'
import { CheckIcon, CloseIcon, UploadIcon } from '../ui/primitives'

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}
const useToasts = create<{ list: Toast[]; push: (text: string, tone?: Toast['tone']) => void }>((set) => ({
  list: [],
  push: (text, tone = 'ok') => {
    const id = Date.now() + Math.random()
    set((s) => ({ list: [...s.list, { id, text, tone }] }))
    setTimeout(() => set((s) => ({ list: s.list.filter((t) => t.id !== id) })), 3200)
  },
}))
export const toast = (text: string, tone: Toast['tone'] = 'ok') => useToasts.getState().push(text, tone)
export const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Une erreur est survenue.')

export function Toasts() {
  const list = useToasts((s) => s.list)
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex flex-col gap-2">
      {list.map((t) => (
        <div key={t.id} className={`panel-enter flex items-center gap-2 rounded-2xl px-4 py-3 text-[14px] shadow-lg ${t.tone === 'ok' ? 'bg-ink text-paper' : 'bg-rose-600 text-white'}`}>
          {t.tone === 'ok' ? <CheckIcon className="size-4" /> : <CloseIcon className="size-4" />}
          {t.text}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mise en page                                                        */
/* ------------------------------------------------------------------ */

export function PageHeader({ title, subtitle, action, kicker }: { title: string; subtitle?: string; action?: ReactNode; kicker?: string }) {
  return (
    <header className="admin-enter mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && (
          <p className="kicker mb-3 flex items-center gap-2 text-ink/50">
            <span className="text-accent">●</span> {kicker}
          </p>
        )}
        <h1 className="font-display text-[clamp(2.1rem,3.6vw,3.1rem)] leading-[1.02]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/55">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[24px] bg-white p-5 shadow-[0_24px_60px_-42px_rgba(10,16,32,0.45)] ring-1 ring-ink/[0.06] md:p-7 ${className ?? ''}`}>{children}</div>
}

/**
 * Aperçu en direct d'un réglage : ce que verront les visiteurs, mis à jour à chaque frappe.
 * `tone` : fond du cadre (clair ou nuit), selon ce que l'on montre.
 */
export function Preview({ children, label = 'Aperçu en direct', tone = 'light', className }: { children: ReactNode; label?: string; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <figure className={`overflow-hidden rounded-[20px] ring-1 ${tone === 'dark' ? 'bg-[#0a1124] ring-white/10' : 'bg-[#eef2f8] ring-ink/[0.06]'} ${className ?? ''}`}>
      <figcaption className={`flex items-center gap-2 px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.12em] ${tone === 'dark' ? 'text-white/55' : 'text-ink/45'}`}>
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
        {label}
      </figcaption>
      <div className="p-4">{children}</div>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* Réglages en blocs dépliables, avec un aperçu en direct à droite     */
/* ------------------------------------------------------------------ */

interface DesignerState {
  /** Bloc ouvert (celui dont l'aperçu s'affiche). */
  active: string | null
  setActive: (id: string | null) => void
  register: (id: string) => void
  /** Emplacement de l'aperçu (colonne de droite), sur grand écran. */
  pane: HTMLElement | null
  wide: boolean
}
const DesignerContext = createContext<DesignerState | null>(null)

function useWideScreen() {
  const query = '(min-width: 1280px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

function LiveDot() {
  return (
    <span className="relative flex size-1.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
    </span>
  )
}

/**
 * Page de réglages « designer » : les blocs (`Section`) à gauche, un seul à la fois ouvert,
 * et son aperçu en direct dans la colonne de droite, qui reste à l'écran pendant que l'on fait défiler.
 * Le bandeau de l'aperçu dit si les modifications sont déjà sur le site.
 */
export function Designer({ children, dirty, saving, onSave }: { children: ReactNode; dirty?: boolean; saving?: boolean; onSave?: () => void }) {
  const [active, setActive] = useState<string | null>(null)
  const [pane, setPane] = useState<HTMLDivElement | null>(null)
  const wide = useWideScreen()
  const register = useCallback((id: string) => setActive((a) => a ?? id), [])
  const value = useMemo(() => ({ active, setActive, register, pane, wide }), [active, register, pane, wide])
  return (
    <DesignerContext.Provider value={value}>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-3">{children}</div>
        {wide && (
          <aside className="sticky top-24 min-w-0">
            <div className="overflow-hidden rounded-[22px] bg-[#e6ebf3] ring-1 ring-ink/[0.07]">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-ink/[0.07] bg-ink/[0.045] px-4 py-2">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink/60">
                  {dirty ? <span className="size-1.5 rounded-full bg-amber-400" /> : <LiveDot />}
                  {dirty ? 'Aperçu de vos modifications · pas encore sur le site' : 'Aperçu en direct · identique au site'}
                </p>
                {dirty && onSave && (
                  <button onClick={onSave} disabled={saving} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-sm ring-1 ring-ink/10 transition hover:ring-ink/25 disabled:opacity-50">
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                )}
              </div>
              <div ref={setPane} className="max-h-[calc(100svh-10rem)] overflow-y-auto p-5 empty:hidden" />
              {active === null && <p className="px-6 py-14 text-center text-[14px] text-ink/45">Ouvrez un réglage à gauche pour voir son aperçu.</p>}
            </div>
          </aside>
        )}
      </div>
    </DesignerContext.Provider>
  )
}

const SECTION_ICON = 'M4 7h16M4 12h16M4 17h10'

/**
 * Bloc de réglages dépliable : icône, titre et explication, puis le formulaire.
 * Dans un `Designer`, son aperçu s'affiche dans la colonne de droite quand il est ouvert ;
 * sinon (ou sur petit écran), l'aperçu suit le formulaire.
 */
export function Section({
  title,
  text,
  children,
  preview,
  icon = SECTION_ICON,
  badge,
}: {
  title: ReactNode
  text?: string
  children: ReactNode
  preview?: ReactNode
  icon?: string
  badge?: ReactNode
}) {
  const designer = useContext(DesignerContext)
  const id = useId()
  const [ownOpen, setOwnOpen] = useState(true)
  const register = designer?.register
  useEffect(() => {
    register?.(id)
  }, [register, id])
  const open = designer ? designer.active === id : ownOpen
  const toggle = () => (designer ? designer.setActive(open ? null : id) : setOwnOpen((o) => !o))
  const inPane = !!(designer?.wide && designer.pane)

  return (
    <section className={`admin-enter overflow-hidden rounded-[20px] bg-white transition-shadow duration-300 ${open ? 'shadow-[0_24px_60px_-40px_rgba(10,16,32,0.5)] ring-1 ring-accent/25' : 'ring-1 ring-ink/[0.07] hover:ring-ink/15'}`}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-4 px-5 py-4 text-left md:px-6">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${open ? 'bg-accent text-white' : 'bg-[#eef2f8] text-ink/55'}`}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={icon} />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[1.2rem] leading-tight md:text-[1.3rem]">{title}</span>
          {text && <span className={`mt-1 block text-[13.5px] leading-snug text-ink/50 ${open ? '' : 'line-clamp-1'}`}>{text}</span>}
        </span>
        {badge}
        <svg viewBox="0 0 24 24" className={`size-5 shrink-0 text-ink/35 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {/* hauteur animée (grille 0fr → 1fr) ; fermé, le contenu est inerte (ni clavier ni lecteur d'écran) */}
      <div className={`grid transition-[grid-template-rows] duration-500 ease-[var(--ease-expo)] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="space-y-4 border-t border-ink/[0.06] px-5 pb-6 pt-5 md:px-6">
            {children}
            {preview && !inPane && <div className="pt-2">{preview}</div>}
          </div>
        </div>
      </div>
      {open && inPane && preview && createPortal(<div key={id} className="auth-swap space-y-3">{preview}</div>, designer!.pane!)}
    </section>
  )
}

/** Barre d'enregistrement : apparaît dès qu'un réglage a changé, reste visible en bas de l'écran. */
export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  // rendue directement dans <body> : toujours calée en bas de l'écran, quelle que soit l'animation de la page ;
  // décalée de la largeur de la barre latérale (dépliée ou repliée)
  return createPortal(
    <div className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 transition-all duration-500 ease-[var(--ease-expo)] lg:pl-[calc(var(--admin-rail,264px)+1rem)] ${dirty ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
      <div className={`flex w-full max-w-3xl items-center gap-3 rounded-2xl bg-[linear-gradient(180deg,#121b36,#0a1124)] px-5 py-3 text-white shadow-[0_20px_50px_-20px_rgba(5,10,24,0.9)] ring-1 ring-white/10 ${dirty ? 'pointer-events-auto' : ''}`}>
        <span className="size-2 shrink-0 rounded-full bg-amber-400" />
        <p className="flex-1 text-[14px] text-white/80">Modifications non enregistrées</p>
        <button onClick={onReset} disabled={saving} className="rounded-xl px-3 py-2 text-[13.5px] font-semibold text-white/70 hover:bg-white/10 hover:text-white">
          Annuler
        </button>
        <button onClick={onSave} disabled={saving} className="btn h-10 bg-linear-to-r from-accent to-[#1d9bf0] px-5 text-[14px] text-white hover:brightness-110">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>,
    document.body,
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[20px] border border-dashed border-ink/15 p-12 text-center text-ink/45">{children}</p>
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="kicker text-ink/50">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink/40">{hint}</span>}
    </label>
  )
}

export const inputCls = 'mt-1.5 w-full rounded-xl bg-[#f4f7fb] px-3.5 py-2.5 text-[15px] ring-1 ring-ink/10 outline-none transition focus:bg-white focus:ring-2 focus:ring-accent'

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-3 text-[14px]" aria-pressed={checked}>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-accent' : 'bg-ink/15'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'accent' | 'warn' | 'ok' | 'neutral' | 'danger' }) {
  const cls = {
    accent: 'bg-accent text-white',
    warn: 'bg-amber-100 text-amber-800',
    ok: 'bg-emerald-100 text-emerald-800',
    neutral: 'bg-ink/[0.07] text-ink/60',
    danger: 'bg-rose-100 text-rose-700',
  }[tone]
  return <span className={`kicker inline-flex items-center rounded-full px-2.5 py-1 !text-[10px] ${cls}`}>{children}</span>
}

/** Bouton de suppression en deux temps (évite les erreurs). */
export function DangerButton({ onConfirm, children = 'Supprimer' }: { onConfirm: () => void; children?: ReactNode }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : (setArmed(true), setTimeout(() => setArmed(false), 3000)))}
      className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${armed ? 'bg-rose-600 text-white' : 'text-rose-600 hover:bg-rose-50'}`}
    >
      {armed ? 'Confirmer ?' : children}
    </button>
  )
}

/** Panneau latéral d'édition ; `aside` : colonne d'aperçu en direct à droite du formulaire. */
export function Drawer({ title, onClose, children, footer, aside }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; aside?: ReactNode }) {
  return (
    <div className="overlay-enter fixed inset-0 z-[70] flex bg-ink/45 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`drawer-enter ml-auto flex h-full w-full flex-col bg-[#f4f7fb] shadow-2xl ${aside ? 'max-w-5xl' : 'max-w-2xl'}`}>
        <header className="flex items-center justify-between bg-[linear-gradient(180deg,#121b36,#0a1124)] px-6 py-4 text-white">
          <h2 className="font-display text-[1.75rem]">{title}</h2>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Fermer">
            <CloseIcon className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className={aside ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]' : ''}>
            <div className="space-y-6">{children}</div>
            {aside && <div className="lg:sticky lg:top-0 lg:self-start">{aside}</div>}
          </div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-ink/10 bg-white px-6 py-4">{footer}</footer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

/** Envoi de plusieurs photos (glisser-déposer), réordonnables, supprimables. */
export function ImageUploader({
  value,
  onChange,
  max = 12,
  single = false,
  cutout = false,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  max?: number
  single?: boolean
  /** Propose « Détourer » sur chaque photo (produits posés dans l'atelier). */
  cutout?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [cutting, setCutting] = useState<number | null>(null)
  // Résultat du détourage montré sur damier avant d'être gardé (les fonds proches du produit peuvent déborder).
  const [preview, setPreview] = useState<{ i: number; file: File; url: string } | null>(null)
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url)
    },
    [preview],
  )

  const detour = async (i: number) => {
    setCutting(i)
    try {
      const { removeBackground } = await import('./cutout')
      const file = await removeBackground(thumbUrl(value[i]!, 1600))
      setPreview({ i, file, url: URL.createObjectURL(file) })
    } catch (err) {
      toast(err instanceof Error ? err.message : errorText(err), 'error')
    } finally {
      setCutting(null)
    }
  }
  const keep = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const { urls } = await api.admin.upload([preview.file])
      onChange(value.map((u, j) => (j === preview.i ? urls[0]! : u)))
      toast('Photo détourée enregistrée')
      setPreview(null)
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type)).slice(0, single ? 1 : max - value.length)
    if (!list.length) return toast('Formats acceptés : PNG, JPG, WEBP', 'error')
    setBusy(true)
    try {
      const { urls } = await api.admin.upload(list)
      onChange(single ? urls.slice(0, 1) : [...value, ...urls])
      toast(urls.length > 1 ? `${urls.length} photos ajoutées` : 'Photo ajoutée')
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  const move = (i: number, d: number) => {
    const next = [...value]
    const [item] = next.splice(i, 1)
    next.splice(i + d, 0, item!)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {value.map((url, i) => (
            <li
              key={url + i}
              className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-ink/10"
              // damier : on voit tout de suite si la photo est détourée
              style={{ background: 'repeating-conic-gradient(#eef2f7 0 25%, #ffffff 0 50%) 0 0 / 16px 16px' }}
            >
              <img src={preview?.i === i ? preview.url : thumbUrl(url, 300)} alt="" className={`h-full w-full ${cutout ? 'object-contain p-2' : 'object-cover'}`} />
              {i === 0 && !single && <span className="kicker absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 !text-[9px] text-white">Principale</span>}
              {preview?.i === i && (
                <div className="absolute inset-x-1 bottom-1 z-10 flex gap-1">
                  <button type="button" onClick={keep} disabled={busy} className="flex-1 rounded-full bg-ink py-1 text-[11px] font-semibold text-paper">
                    Garder
                  </button>
                  <button type="button" onClick={() => setPreview(null)} className="flex-1 rounded-full bg-white py-1 text-[11px] font-semibold text-ink shadow">
                    Annuler
                  </button>
                </div>
              )}
              {cutout && preview?.i !== i && (
                <button
                  type="button"
                  disabled={cutting !== null}
                  onClick={() => detour(i)}
                  className="absolute right-1 top-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-ink opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-60"
                  title="Retire un fond uni (mur, drap, carton) pour poser le produit dans l'atelier"
                >
                  {cutting === i ? 'Détourage…' : 'Détourer'}
                </button>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
                {!single && (
                  <span className="flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-7 place-items-center rounded-full bg-white/95 text-[13px] shadow disabled:opacity-30" aria-label="Avancer">
                      ←
                    </button>
                    <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="grid size-7 place-items-center rounded-full bg-white/95 text-[13px] shadow disabled:opacity-30" aria-label="Reculer">
                      →
                    </button>
                  </span>
                )}
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full bg-white/95 text-rose-600 shadow" aria-label="Retirer">
                  <CloseIcon className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(single ? value.length === 0 : value.length < max) && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            void upload(e.dataTransfer.files)
          }}
          className={`flex w-full items-center gap-4 rounded-2xl border-2 border-dashed p-5 text-left transition ${over ? 'border-accent bg-accent-soft' : 'border-ink/15 hover:border-accent'}`}
        >
          <span className="grid size-11 place-items-center rounded-full bg-ink text-paper">{busy ? <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <UploadIcon className="size-5" />}</span>
          <span className="text-[14px] leading-snug">
            {busy ? 'Envoi en cours…' : single ? 'Choisir une image' : 'Ajouter des photos'}
            <span className="block text-ink/45">Glissez-déposez ou cliquez · PNG, JPG, WEBP · 8 Mo max</span>
          </span>
        </button>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple={!single} className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} />
    </div>
  )
}
