import type { CSSProperties, ReactNode, SVGProps } from 'react'
import { useSite } from '../lib/site'
import { thumbUrl } from './img'

/** Mire de repérage : le symbole de la marque. */
export function Mark({ className, accent = true }: { className?: string; accent?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 3v26M3 16h26" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="16" cy="16" r="3" fill={accent ? 'var(--color-accent)' : 'currentColor'} />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  const [a, b] = useSite((s) => s.settings.nameParts)
  return (
    <span className={`font-display font-extrabold leading-none tracking-[-0.04em] ${className ?? ''}`}>
      {a}
      <em>{b}</em>
    </span>
  )
}

/**
 * Logo de l'entreprise : celui envoyé dans l'espace pro s'il existe, sinon le symbole et le nom.
 * `onDark` : posé sur une pastille claire, pour qu'un logo foncé reste lisible sur fond sombre.
 */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const logo = useSite((s) => s.settings.logo)
  const name = useSite((s) => s.settings.name)
  if (logo) {
    return (
      <span className={`inline-flex items-center ${onDark ? 'rounded-xl bg-white px-2.5 py-1 shadow-sm' : ''} ${className ?? ''}`}>
        <img src={thumbUrl(logo, 360)} alt={name} className="h-8 w-auto max-w-[170px] object-contain" />
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <Mark className="size-7" />
      <Wordmark className="text-[22px] tracking-tight" />
    </span>
  )
}

/**
 * Titre révélé mot à mot quand un parent porte `.is-active` ou `.is-revealed`.
 * La ligne d'index `italicLine` passe dans le dégradé de la marque (signature visuelle du site).
 */
export function SplitTitle({
  lines,
  italicLine = 1,
  as: Tag = 'h2',
  className,
  delay = 0,
}: {
  lines: readonly string[]
  italicLine?: number
  as?: 'h1' | 'h2' | 'h3'
  className?: string
  delay?: number
}) {
  let i = delay
  return (
    <Tag className={className}>
      {lines.map((line, li) => (
        <span key={li} className="split-line">
          {line.split(' ').map((word, wi) => (
            <span key={wi}>
              {wi > 0 && ' '}
              <span className={`split-word ${li === italicLine ? 'accent-text' : ''}`} style={{ '--i': i++ } as CSSProperties}>
                {word}
              </span>
            </span>
          ))}
        </span>
      ))}
    </Tag>
  )
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`kicker flex items-center gap-2 ${className ?? ''}`}>{children}</p>
}

/* Icônes (traits fins, 24px) */
type IconProps = SVGProps<SVGSVGElement>
const base = (p: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
})

export const ArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const ArrowDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)
export const PhoneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
)
export const MailIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)
export const UploadIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
  </svg>
)
export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12 5 5L20 7" />
  </svg>
)
export const RotateIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </svg>
)
export const WhatsAppIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
  </svg>
)
