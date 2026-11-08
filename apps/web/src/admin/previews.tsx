import type { SectionText, SiteSettings, StationContent } from '@atelier/shared'
import { useEffect, useState } from 'react'
import { GlassIconReveal } from '../components/ui/glass-icon-reveal'
import { useSite } from '../lib/site'
import { thumbUrl } from '../ui/img'
import { PRELOADER_BACKDROP, PRELOADER_MARK } from '../ui/Preloader'
import { ArrowRight, Mark } from '../ui/primitives'

/**
 * Aperçus de l'espace pro : répliques fidèles des éléments du site, alimentées par les réglages en cours de saisie
 * (avant même l'enregistrement). Ce que l'on voit ici est ce que verront les visiteurs.
 */

const FACADE = '/media/atelier-facade-800.webp'

/** Logo tel qu'affiché sur le site : image de l'espace pro, ou symbole + nom en deux parties. */
function LogoPreview({ s, onDark = false, size = 'md' }: { s: SiteSettings; onDark?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 'h-14' : size === 'sm' ? 'h-6' : 'h-8'
  if (s.logo) {
    return (
      <span className={`inline-flex items-center ${onDark ? 'rounded-lg bg-white px-2 py-0.5' : ''}`}>
        <img src={thumbUrl(s.logo, 360)} alt="" className={`${h} w-auto max-w-[160px] object-contain`} />
      </span>
    )
  }
  const text = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-[15px]' : 'text-[19px]'
  return (
    <span className={`inline-flex items-center gap-2 ${onDark ? 'text-white' : 'text-ink'}`}>
      <Mark className={size === 'lg' ? 'size-12' : size === 'sm' ? 'size-5' : 'size-6'} />
      <span className={`font-display font-extrabold leading-none tracking-[-0.04em] ${text}`}>
        {s.nameParts[0]}
        <em>{s.nameParts[1]}</em>
      </span>
    </span>
  )
}

/** Barre de navigation du site (bleu nuit) avec le logo. */
export function NavPreview({ s }: { s: SiteSettings }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[linear-gradient(180deg,#121b36,#0a1124)] px-3 py-2.5 ring-1 ring-white/10">
      <LogoPreview s={s} onDark size="sm" />
      <span className="ml-auto hidden gap-3 text-[10.5px] font-semibold text-white/60 sm:flex">
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-white">L’atelier</span>
        <span>Boutique</span>
        <span>Studio</span>
        <span>Contact</span>
      </span>
      <span className="ml-auto rounded-lg bg-linear-to-r from-accent to-[#1d9bf0] px-2.5 py-1 text-[10.5px] font-bold text-white sm:ml-1">Devis gratuit</span>
    </div>
  )
}

/**
 * Écran de chargement : le vrai verre, en boucle, avec le logo en cours de réglage
 * (il se rejoue au clic). Dessous, le nom et la signature, comme à l'arrivée sur le site.
 */
export function PreloaderPreview({ s }: { s: SiteSettings }) {
  const logo = s.logo ? thumbUrl(s.logo, 640) : PRELOADER_MARK
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-ink/[0.06]" style={{ background: PRELOADER_BACKDROP }}>
      <GlassIconReveal
        logo={logo}
        look="light"
        background={PRELOADER_BACKDROP}
        originalColors
        loop
        hold={1.6}
        tileSize={150}
        tuning={{ present: 2 }}
        label="Aperçu de l’écran de chargement (cliquer pour rejouer)"
        title="Cliquer pour rejouer"
        className="absolute inset-0"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-[8%] flex flex-col items-center gap-1 px-3 text-center">
        {!s.logo && (
          <span className="font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.04em]">
            {s.nameParts[0]}
            <em>{s.nameParts[1]}</em>
          </span>
        )}
        <p className="text-[11px] font-medium text-ink/55">{s.tagline}</p>
      </div>
    </div>
  )
}

/** Accueil du site : la façade et l'accroche, comme à l'arrivée sur le site. */
export function HeroPreview({ s }: { s: SiteSettings }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
      <img src={FACADE} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/30 to-transparent" />
      <div className="absolute inset-x-4 bottom-4 text-white">
        <p className="kicker flex items-center gap-1.5 !text-[8.5px] text-white/75">
          <span className="colorbar inline-block h-1.5 w-5" /> {s.tagline}
        </p>
        <p className="mt-1.5 font-display text-[clamp(1.1rem,2.6vw,1.6rem)] leading-[1.02]">
          {s.heroTitle[0]}
          <br />
          <em>{s.heroTitle[1]}</em>
        </p>
        <p className="mt-1.5 max-w-[80%] text-[10.5px] leading-snug text-white/75">{s.heroText}</p>
      </div>
    </div>
  )
}

/** Carte de bienvenue à l'entrée de l'atelier. */
export function WelcomePreview({ s }: { s: SiteSettings }) {
  const realisations = useSite((x) => x.realisations.length)
  const products = useSite((x) => x.products.length)
  const stats = [
    { value: 7, label: 'postes' },
    { value: realisations, label: 'réalisations' },
    { value: products, label: 'produits' },
  ].filter((x) => x.value > 0)
  return (
    <div
      className="relative overflow-hidden rounded-xl p-4"
      // l'intérieur clair de l'atelier : faux plafond en dalles, allée centrale
      style={{
        background:
          'repeating-linear-gradient(90deg, rgba(150,165,190,.18) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, rgba(150,165,190,.14) 0 1px, transparent 1px 28px), linear-gradient(180deg, #f3f6fb, #dfe7f2)',
      }}
    >
      <div className="max-w-[17rem] rounded-2xl bg-white/[0.97] p-4 text-ink shadow-[0_20px_50px_-30px_rgba(10,16,32,0.6)] ring-1 ring-ink/[0.06]">
        <div className="flex items-center gap-2">
          <LogoPreview s={s} size="sm" />
          <span className="h-3.5 w-px bg-ink/15" />
          <span className="kicker !text-[8.5px] text-accent">Bienvenue</span>
        </div>
        <p className="mt-2.5 font-display text-[1.25rem] leading-[1.04]">
          {s.welcome.title[0]}
          <br />
          <em>{s.welcome.title[1]}</em>
        </p>
        <p className="mt-1.5 text-[10.5px] leading-snug text-ink/65">{s.welcome.text}</p>
        {stats.length > 0 && (
          <div className="mt-2.5 grid grid-cols-3 border-y border-ink/[0.07] py-1.5">
            {stats.map((x, i) => (
              <span key={x.label} className={i ? 'border-l border-ink/[0.07] pl-2' : ''}>
                <span className="block font-display text-[1rem] leading-none">{x.value}</span>
                <span className="text-[8.5px] font-semibold text-ink/50">{x.label}</span>
              </span>
            ))}
          </div>
        )}
        <span className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-[9.5px] font-bold text-white">
          Commencer la visite <ArrowRight className="size-2.5" />
        </span>
      </div>
    </div>
  )
}

/** Enseigne de la façade : la photo de l'espace pro posée sur le bandeau (sinon l'enseigne générée). */
export function SignPreview({ sign }: { sign: string }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
      <img src={FACADE} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {sign ? (
        <div className="absolute grid place-items-center bg-[#101a38] shadow-[0_0_0_2px_rgba(96,165,250,0.5)]" style={{ left: '29.2%', top: '27.9%', width: '41.6%', height: '13.8%' }}>
          <img src={thumbUrl(sign, 900)} alt="" className="h-full w-full object-contain" />
        </div>
      ) : (
        <p className="absolute inset-x-3 bottom-3 rounded-lg bg-ink/70 px-2.5 py-1.5 text-[11px] text-white">Enseigne générée aux couleurs de la marque (aucune photo envoyée)</p>
      )}
    </div>
  )
}

/** Écran vertical de la vitrine : les images défilent comme sur le site. */
export function ScreenPreview({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (urls.length < 2) return
    const id = setInterval(() => setI((n) => (n + 1) % urls.length), 2400)
    return () => clearInterval(id)
  }, [urls.length])
  const current = urls[i % Math.max(1, urls.length)]
  return (
    <div className="flex items-end justify-center gap-6 py-2">
      <div className="relative aspect-[1.46/2.32] w-36 overflow-hidden rounded-lg bg-[#0a1020] p-1.5 shadow-[0_20px_40px_-20px_rgba(10,16,32,0.7)] ring-1 ring-black/40">
        {current ? (
          <img key={current} src={thumbUrl(current, 500)} alt="" className="image-enter h-full w-full rounded object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col justify-end rounded bg-linear-to-br from-accent to-accent-2 p-2.5 text-white">
            <span className="text-[8px] font-bold uppercase tracking-wider opacity-75">Impression</span>
            <span className="font-display text-[13px] leading-tight">Affiches, flyers & cartes</span>
          </div>
        )}
        {urls.length > 1 && (
          <span className="absolute bottom-3 right-3 flex gap-1">
            {urls.map((u, k) => (
              <span key={u + k} className={`h-0.5 w-2.5 rounded ${k === i % urls.length ? 'bg-white' : 'bg-white/35'}`} />
            ))}
          </span>
        )}
      </div>
      <p className="max-w-[10rem] pb-2 text-[12px] leading-snug text-ink/55">
        {urls.length ? `${urls.length} image${urls.length > 1 ? 's' : ''} : une toutes les 4,5 s sur le site.` : 'Sans image : les prestations défilent (visuels générés).'}
      </p>
    </div>
  )
}

/** Mur d'affiches de l'atelier (lames de bois) et ses cadres. */
export function PostersPreview({ urls }: { urls: string[] }) {
  const shown = urls.slice(0, 6)
  return (
    <div className="rounded-xl p-4" style={{ background: 'repeating-linear-gradient(90deg, #d6b98f 0 7px, #e9eef5 7px 13px)' }}>
      {shown.length ? (
        <div className="grid grid-cols-3 gap-3">
          {shown.map((u, k) => (
            <div key={u + k} className="aspect-[3/4] bg-[#151821] p-1 shadow-md">
              <div className="h-full w-full bg-white p-1">
                <img src={thumbUrl(u, 300)} alt="" className="h-full w-full object-cover" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-white/85 p-3 text-center text-[12px] text-ink/60">Sans visuel : les affiches générées (Affiches, Flyers, Vos événements en grand…) restent accrochées.</p>
      )}
    </div>
  )
}

/** Rappel sous l'aperçu des affiches : les réalisations passent devant. */
export function PosterPreviewNote() {
  return <p className="mt-2 text-[12px] leading-snug text-ink/50">Vos réalisations du poste Impression (menu Réalisations) sont accrochées en premier, puis ces affiches.</p>
}

/** Photocall de l'événementiel : le fond en 2 × 1, entre ses montants. */
export function PhotocallPreview({ url }: { url: string }) {
  return (
    <div className="rounded-xl bg-[#e9eef5] px-4 pb-3 pt-4">
      <div className="relative mx-auto aspect-[2.14/1] w-full border-x-4 border-t-4 border-[#aab1ba] bg-white">
        {url ? (
          <img src={thumbUrl(url, 900)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[12px] text-ink/50">Mur de logos généré (aucun fond envoyé)</div>
        )}
      </div>
      <div className="mx-auto h-1 w-[85%] rounded bg-ink/15" />
    </div>
  )
}

/** En-tête d'une section de la page : sur-titre, titre en deux lignes (la seconde en couleur), texte. */
export function SectionHeaderPreview({ t, dark, kickerFallback }: { t: SectionText; dark: boolean; kickerFallback?: string }) {
  return (
    <div className={`rounded-xl p-5 ${dark ? 'bg-ink text-white' : 'bg-paper text-ink ring-1 ring-ink/[0.06]'}`}>
      <p className={`kicker flex items-center gap-1.5 !text-[9.5px] ${dark ? 'text-white/55' : 'text-ink/55'}`}>
        <span className="text-accent">●</span> {t.kicker || kickerFallback}
      </p>
      <p className="mt-2.5 font-display text-[clamp(1.4rem,2.4vw,1.9rem)] leading-[0.98]">
        {t.title[0]}
        <br />
        <em>{t.title[1]}</em>
      </p>
      {t.text && <p className={`mt-3 max-w-md text-[11.5px] leading-relaxed ${dark ? 'text-white/65' : 'text-ink/65'}`}>{t.text}</p>}
    </div>
  )
}

/** Fiche d'une machine, telle qu'elle s'ouvre au clic dans l'atelier. */
export function MachinePreview({ m }: { m: { name: string; kicker: string; text: string; makes: string[]; from: string; to: string } }) {
  return (
    <div className="grid overflow-hidden rounded-xl bg-paper ring-1 ring-ink/[0.06] sm:grid-cols-[0.8fr_1fr]">
      <div className="min-h-28 p-3" style={{ background: `linear-gradient(150deg, ${m.from}, ${m.to})` }} />
      <div className="p-4 text-ink">
        <p className="kicker !text-[8.5px] text-ink/50">
          <span className="text-accent">●</span> {m.kicker}
        </p>
        <p className="mt-1.5 font-display text-[1.15rem] leading-tight">{m.name || 'Sans nom'}</p>
        <p className="mt-1.5 text-[10.5px] leading-snug text-ink/65">{m.text}</p>
        {m.makes.length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {m.makes.map((x) => (
              <li key={x} className="truncate rounded-md bg-white px-1.5 py-1 text-[9.5px] font-semibold ring-1 ring-ink/[0.07]">
                ✓ {x}
              </li>
            ))}
          </ul>
        )}
        <span className="mt-2.5 inline-block rounded-md bg-accent px-2 py-1 text-[9.5px] font-bold text-white">Demander un devis</span>
      </div>
    </div>
  )
}

/** Panneau d'un poste pendant la visite : sur-titre numéroté, titre, texte, mots-clés, boutons. */
export function StationPanelPreview({ station, number }: { station: StationContent; number: string }) {
  return (
    <div className="rounded-xl bg-[radial-gradient(ellipse_at_70%_30%,#ffffff,#dfe7f2)] p-4">
      <article className="ml-auto max-w-[19rem] rounded-2xl bg-white p-4 text-ink shadow-[0_20px_50px_-30px_rgba(10,16,32,0.55)] ring-1 ring-ink/[0.06]">
        <p className="kicker flex items-center gap-2 !text-[9px] text-ink/55">
          <span className="text-accent">{number}</span>
          <span className="h-px w-4 bg-current opacity-40" />
          {station.kicker}
        </p>
        <p className="mt-2 font-display text-[1.2rem] leading-[1.05]">
          {station.title[0]}
          <br />
          <em>{station.title[1]}</em>
        </p>
        <p className="mt-2 text-[10.5px] leading-snug text-ink/70">{station.body}</p>
        {station.tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1">
            {station.tags.map((t) => (
              <li key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-[9px] font-semibold text-accent">
                {t}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex items-center gap-3">
          <span className="rounded-lg bg-accent px-2.5 py-1 text-[9.5px] font-bold text-white">Voir le catalogue</span>
          <span className="border-b border-current text-[9.5px] font-semibold">Demander un devis</span>
        </div>
      </article>
    </div>
  )
}
