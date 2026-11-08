import type { Review } from '@atelier/shared'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Marquee } from '../components/ui/marquee'
import { api } from '../lib/api'
import { scrollToElement } from '../lib/scroll'
import { useSection, useSite } from '../lib/site'
import { useReveal } from '../ui/hooks'
import { ReviewForm } from '../ui/overlays/ProductModal'
import { ArrowRight, Kicker, SplitTitle } from '../ui/primitives'
import { Stars } from '../ui/shop'

/** Largeur d'une carte + écart (px), pour répéter assez de cartes et couvrir les grands écrans. */
const CARD = 376
/** Secondes par carte : la vitesse reste la même quel que soit le nombre d'avis. */
const SECONDS_PER_CARD = 8
/** À partir de ce nombre d'avis, deux rangées qui défilent en sens opposés. */
const TWO_ROWS = 6

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

const card = 'flex w-[300px] shrink-0 flex-col rounded-[22px] p-6 sm:w-[360px]'

function ReviewCard({ review, product }: { review: Review; product?: string }) {
  return (
    <figure className={`${card} bg-white shadow-[0_18px_40px_-28px_rgba(10,16,32,0.35)] ring-1 ring-ink/[0.07]`}>
      <div className="flex items-center justify-between gap-3">
        <Stars value={review.rating} />
        <span className="text-[12.5px] text-ink/45">{MONTH.format(new Date(review.createdAt))}</span>
      </div>
      <blockquote className="mt-4 line-clamp-5 text-[17px] font-medium leading-relaxed text-ink/85">« {review.comment} »</blockquote>
      <figcaption className="mt-auto flex items-center gap-3 pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-accent to-accent-2 text-[14px] font-semibold uppercase text-white">
          {review.name.trim()[0] ?? '?'}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold text-ink">{review.name}</span>
          {product && <span className="block truncate text-[12.5px] text-ink/50">À propos de : {product}</span>}
        </span>
      </figcaption>
    </figure>
  )
}

/** Dernière carte de la rangée : invite à laisser son avis (le formulaire est sous les rangées). */
function InviteCard() {
  return (
    <div className={`${card} justify-between border border-dashed border-accent/40 bg-accent-soft/60`}>
      <span className="kicker text-accent">Votre avis ici</span>
      <p className="mt-3 text-[17px] font-medium leading-relaxed text-ink/80">Vous avez travaillé avec nous ? Dites-le en quelques mots, juste en dessous.</p>
    </div>
  )
}

function goToForm() {
  scrollToElement('#avis-form')
  window.setTimeout(() => document.querySelector<HTMLInputElement>('#avis-form input.field')?.focus({ preventScroll: true }), 900)
}

/** Avis clients publiés (après validation dans l'espace pro), qui défilent en continu, puis le formulaire. */
export function Reviews() {
  const ref = useRef<HTMLElement>(null)
  useReveal(ref, 0.1)
  const t = useSection('avis')
  const products = useSite((s) => s.products)
  const [reviews, setReviews] = useState<Review[]>([])
  useEffect(() => {
    api.reviews().then(setReviews).catch(() => {})
  }, [])
  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  const rows = useMemo(() => {
    const list = reviews.slice(0, 24)
    return list.length >= TWO_ROWS ? [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)] : [list]
  }, [reviews])
  const productName = (id: string | null) => (id ? products.find((p) => p.id === id)?.name : undefined)

  return (
    <section id="avis" ref={ref} className="overflow-hidden bg-paper text-ink">
      <div className="mx-auto max-w-7xl px-5 pt-24 md:px-10 md:pt-32">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <Kicker className="fade-up text-ink/55">
              <span className="text-accent">●</span> {t.kicker}
            </Kicker>
            <SplitTitle lines={t.title} className="mt-5 font-display text-[clamp(2.46rem,5.04vw,4.7rem)] leading-[0.92]" />
            {t.text && (
              <p className="fade-up mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink/65" style={{ '--d': '300ms' } as CSSProperties}>
                {t.text}
              </p>
            )}
          </div>
          <div className="fade-up flex flex-wrap items-center gap-x-8 gap-y-5 md:col-span-5 md:justify-end" style={{ '--d': '300ms' } as CSSProperties}>
            {reviews.length > 0 && (
              <p className="flex items-center gap-3 text-[15px]">
                <span className="font-display text-5xl text-accent">{average.toFixed(1).replace('.', ',')}</span>
                <span>
                  <Stars value={average} />
                  <span className="block text-ink/55">
                    {reviews.length} avis publié{reviews.length > 1 ? 's' : ''}
                  </span>
                </span>
              </p>
            )}
            <button type="button" onClick={goToForm} className="btn btn-ink h-11 px-5 text-[14px]">
              Laisser un avis <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {reviews.length > 0 ? (
        <div className="fade-up mt-12 grid gap-1" style={{ '--d': '400ms' } as CSSProperties}>
          {rows.map((row, i) => {
            const last = i === rows.length - 1
            const cards = row.length + (last ? 1 : 0)
            return (
              <Marquee
                key={i}
                reverse={i === 1}
                pauseOnHover
                ariaLabel={i === 0 ? 'Avis clients' : 'Avis clients, suite'}
                // assez de copies pour couvrir un écran de 2 560 px, à vitesse constante
                repeat={Math.max(2, Math.ceil(2560 / (cards * CARD)) + 1)}
                style={{ '--duration': `${cards * SECONDS_PER_CARD}s` } as CSSProperties}
                className="py-3 [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent [&:focus-within>div]:[animation-play-state:paused]"
              >
                {row.map((r) => (
                  <ReviewCard key={r.id} review={r} product={productName(r.productId)} />
                ))}
                {last && <InviteCard />}
              </Marquee>
            )
          })}
        </div>
      ) : (
        <div className="mx-auto mt-12 max-w-7xl px-5 md:px-10">
          <div className="fade-up grid min-h-48 place-items-center rounded-[22px] border border-dashed border-ink/20 p-10 text-center text-ink/50" style={{ '--d': '300ms' } as CSSProperties}>
            Soyez le premier à partager votre expérience avec nous.
          </div>
        </div>
      )}

      <div id="avis-form" className="mx-auto grid max-w-7xl scroll-mt-24 gap-8 px-5 pb-24 pt-16 md:grid-cols-12 md:px-10 md:pb-32">
        <div className="fade-up md:col-span-5">
          <p className="kicker text-ink/50">Laissez votre avis</p>
          <p className="mt-3 font-display text-[clamp(1.75rem,2.6vw,2.35rem)] leading-tight">
            Votre expérience <em>compte.</em>
          </p>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink/60">
            Une note, quelques mots : votre avis apparaît ici après validation par notre équipe.
          </p>
        </div>
        <div className="fade-up md:col-span-7 lg:col-span-6 lg:col-start-7" style={{ '--d': '150ms' } as CSSProperties}>
          <ReviewForm onDone={() => {}} />
        </div>
      </div>
    </section>
  )
}
