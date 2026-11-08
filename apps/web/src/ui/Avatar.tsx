import type { AuthUser } from '@atelier/shared'
import { useState } from 'react'
import { firstName } from '../lib/auth'

/** Photo de profil, ou initiale sur le dégradé de la marque. */
export function Avatar({ user, className = 'size-10 text-[15px]' }: { user: Pick<AuthUser, 'name' | 'email' | 'avatarUrl'>; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  if (user.avatarUrl && broken !== user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(user.avatarUrl)} className={`shrink-0 rounded-full object-cover ${className}`} />
  }
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-linear-to-br from-accent to-accent-2 font-bold text-white ${className}`} aria-hidden>
      {firstName(user)[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
