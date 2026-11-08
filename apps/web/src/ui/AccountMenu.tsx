import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { firstName, openSignIn, useAuth } from '../lib/auth'
import { Avatar } from './Avatar'

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
const ICONS = {
  profil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  devis: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  commandes: 'M5 8h14l-1.2 12H6.2L5 8Zm4 0V6a3 3 0 0 1 6 0v2',
  admin: 'M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-4H4v4Zm10-16v4h6V4h-6Z',
  reglages: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h5l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  sortie: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4',
}

/**
 * Compte dans la barre du site : « Se connecter », ou le menu du profil.
 * L'entrée « Administration » n'apparaît que pour un administrateur (l'accès lui-même est vérifié par le serveur).
 */
export function AccountMenu({ className }: { className: string }) {
  const user = useAuth((s) => s.user)
  // position du menu : sous le bouton, aligné à droite (rendu hors de la barre, qui coupe ce qui dépasse)
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const open = !!at
  const close = () => setAt(null)
  const toggle = () => {
    if (open) return close()
    const r = button.current!.getBoundingClientRect()
    setAt({ top: r.bottom + 14, right: Math.max(12, window.innerWidth - r.right - 8) })
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close)
    }
  }, [open])

  if (user === undefined) return <span className={`${className} pointer-events-none opacity-0`} aria-hidden />
  if (!user) {
    return (
      <button onClick={() => openSignIn('compte')} className={className} aria-label="Se connecter" title="Se connecter">
        {icon(ICONS.profil)}
      </button>
    )
  }

  const admin = user.role === 'admin'
  const items: Array<{ label: string; href: string; icon: string; strong?: boolean }> = admin
    ? [
        { label: 'Mon profil', href: '/compte', icon: ICONS.profil },
        { label: 'Administration', href: '/admin', icon: ICONS.admin, strong: true },
        { label: 'Paramètres', href: '/admin#/parametres', icon: ICONS.reglages },
      ]
    : [
        { label: 'Mon compte', href: '/compte', icon: ICONS.profil },
        { label: 'Mes devis', href: '/compte#devis', icon: ICONS.devis },
        { label: 'Mes commandes', href: '/compte#commandes', icon: ICONS.commandes },
        { label: 'Paramètres', href: '/compte#securite', icon: ICONS.reglages },
      ]

  return (
    <>
      <button ref={button} onClick={toggle} className={className} aria-haspopup="menu" aria-expanded={open} aria-label={`Compte de ${firstName(user)}`}>
        <Avatar user={user} className="size-8 text-[13px] ring-2 ring-white/20" />
      </button>
      {at &&
        createPortal(
        <div ref={menu} role="menu" style={{ top: at.top, right: at.right }} className="menu-pop fixed z-[60] w-72 max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl bg-white text-ink shadow-[0_24px_60px_-20px_rgba(5,10,24,0.55)] ring-1 ring-ink/10">
          <div className="flex items-center gap-3 border-b border-ink/[0.07] p-4">
            <Avatar user={user} className="size-11 text-[16px]" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{user.name || firstName(user)}</p>
              <p className="truncate text-[12.5px] text-ink/50">{user.email}</p>
            </div>
            {admin && <span className="kicker ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 !text-[9.5px] text-white">Admin</span>}
          </div>
          <div className="p-1.5">
            {items.map((it) => (
              <a key={it.label} role="menuitem" href={it.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition hover:bg-[#f1f5fb] ${it.strong ? 'font-semibold text-accent' : 'font-medium text-ink/80'}`}>
                {icon(it.icon)} {it.label}
              </a>
            ))}
          </div>
          <div className="border-t border-ink/[0.07] p-1.5">
            <button
              role="menuitem"
              onClick={async () => {
                close()
                await useAuth.getState().logout()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-rose-600 transition hover:bg-rose-50"
            >
              {icon(ICONS.sortie)} Déconnexion
            </button>
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}
