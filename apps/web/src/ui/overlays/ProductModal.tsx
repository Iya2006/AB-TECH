import type { Product, Review } from '@atelier/shared'
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import { formatPrice, telHref, whatsappLink } from '../../config/brand'
import { api, ApiError } from '../../lib/api'
import { ensureUser, onBeforeGoogle, useAuth } from '../../lib/auth'
import { peekDraft, saveDraft, takeDraft } from '../../lib/drafts'
import { useCart } from '../../lib/cart'
import { isPhotoModel, PHOTO, tint, type PhotoEntry } from '../../lib/mockup/catalog'
import type { MockupBase } from '../../lib/mockup/engine'
import { MockupView } from '../../lib/mockup/MockupView'
import { useSite } from '../../lib/site'
import { useApp } from '../../lib/store'
import { thumbUrl } from '../img'
import { CheckIcon, Kicker, PhoneIcon, WhatsAppIcon } from '../primitives'
import { Stars, StockBadge } from '../shop'
import { Modal } from './Modal'

const ProductPreview3D = lazy(() => import('./ProductPreview3D'))

interface ReviewDraft {
  productId?: string
  name: string
  rating: number
  comment: string
}

function ReviewForm({ productId, onDone }: { productId?: string; onDone: () => void }) {
  // brouillon gardé pendant un aller-retour vers Google (repris par le bon formulaire uniquement)
  const [draft] = useState(() => {
    const d = peekDraft<ReviewDraft>('avis')
    return d && d.productId === productId ? takeDraft<ReviewDraft>('avis') : null
  })
  const user = useAuth((s) => s.user)
  const [name, setName] = useState(draft?.name ?? '')
  const [rating, setRating] = useState(draft?.rating ?? 5)
  const [comment, setComment] = useState(draft?.comment ?? '')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const latest = useRef<ReviewDraft>({ productId, name, rating, comment })
  latest.current = { productId, name, rating, comment }

  useEffect(() => {
    if (user) setName((n) => n || user.name)
  }, [user])
  useEffect(
    () =>
      onBeforeGoogle(() => {
        if (latest.current.comment.trim()) saveDraft('avis', latest.current)
      }),
    [],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    // un avis est publié depuis un compte : on se connecte d'abord, la saisie reste en place
    if (!(await ensureUser('avis'))) return setError('Connectez-vous pour publier votre avis.')
    setStatus('sending')
    try {
      await api.createReview({ name, rating, comment, productId })
      setStatus('done')
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) useAuth.setState({ user: null })
      setStatus('idle')
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    }
  }
  if (status === 'done') {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-accent-soft p-4 text-[14px] text-ink">
        <CheckIcon className="size-5 text-accent" /> Merci ! Votre avis sera publié après validation.
        <a href="/compte#avis" className="font-semibold text-accent underline-offset-4 hover:underline">
          Suivre sa validation
        </a>
      </p>
    )
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3">
        <span className="kicker text-ink/50">Votre note</span>
        <Stars value={rating} size="size-6" onChange={setRating} />
      </div>
      <input className="field" placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <textarea className="field min-h-20 resize-y" placeholder="Votre avis" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      {error && <p className="text-[13px] text-rose-600">{error}</p>}
      <button className="btn btn-ink justify-center" disabled={status === 'sending'}>
        {status === 'sending' ? 'Envoi…' : 'Publier mon avis'}
      </button>
      {user === null && <p className="text-center text-[12px] text-ink/45">Vous vous connecterez à l’envoi : votre avis reste lié à votre compte.</p>}
    </form>
  )
}

type View =
  | { kind: 'photo'; key: string; src: string }
  | { kind: 'mockup'; key: string; label: string; base: MockupBase; entry: PhotoEntry; worn: boolean }

/** Photos du produit, puis la pièce sur une vraie personne (textile), ou la photo réelle du modèle. */
function viewsOf(product: Product): View[] {
  const views: View[] = product.images.map((src, i) => ({ kind: 'photo', key: `p${i}-${src}`, src }))
  if (!isPhotoModel(product.model)) return views
  const entry = PHOTO[product.model]
  if (!views.length) views.push({ kind: 'mockup', key: 'produit', label: 'Produit', base: entry.produit, entry, worn: false })
  if (entry.homme) views.push({ kind: 'mockup', key: 'homme', label: 'Porté homme', base: entry.homme, entry, worn: true })
  if (entry.femme) views.push({ kind: 'mockup', key: 'femme', label: 'Porté femme', base: entry.femme, entry, worn: true })
  return views
}

/** Visuel imprimé du produit, chargé comme image pour les maquettes. */
function usePrintImage(url: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    setImg(null)
    if (!url) return
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => setImg(i)
    i.src = thumbUrl(url, 800)
  }, [url])
  return img
}

export function ProductModal({ id }: { id: string }) {
  const product = useSite((s) => s.products.find((p) => p.id === id))
  const name = useSite((s) => s.settings.name)
  const phone = useSite((s) => s.settings.phones[0])
  const add = useCart((s) => s.add)
  const logo = usePrintImage(product?.printImage ?? '')
  const [index, setIndex] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [writing, setWriting] = useState(false)

  useEffect(() => {
    api.reviews(id).then(setReviews).catch(() => {})
  }, [id])

  if (!product) return null
  const wa = whatsappLink(`Bonjour ${name}, je suis intéressé(e) par : ${product.name} (x${qty}).`)
  const views = viewsOf(product)
  const view = views[Math.min(index, views.length - 1)]

  return (
    <Modal label={product.name}>
      <div className="grid max-h-[calc(100svh-2rem)] min-h-0 overflow-y-auto md:grid-cols-2 md:overflow-hidden">
        <div className="relative flex min-h-[300px] flex-col bg-[#eef2f7] md:min-h-[560px]">
          <div className="relative min-h-[360px] flex-1 overflow-hidden">
            {!view ? (
              <Suspense fallback={null}>
                <div className="absolute inset-0">
                  <ProductPreview3D product={product} />
                </div>
                <p className="kicker pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-ink/45">Aperçu 3D · glissez pour tourner</p>
              </Suspense>
            ) : view.kind === 'photo' ? (
              <img key={view.key} src={thumbUrl(view.src, 1400)} alt={product.name} className="image-enter absolute inset-0 h-full w-full object-contain p-6" />
            ) : (
              <div key={view.key} className="image-enter absolute inset-0">
                <MockupView
                  base={view.base}
                  color={tint(view.entry, view.base, product.color)}
                  print={logo ? { text: '', ink: '#0e0e10', logo } : null}
                  className={`absolute inset-0 h-full w-full ${view.worn ? 'object-cover object-top' : 'object-contain p-8'}`}
                />
              </div>
            )}
            {view && view.kind === 'mockup' && view.worn && (
              <p className="kicker pointer-events-none absolute bottom-4 left-4 rounded-full bg-white/85 px-3 py-1 text-ink/55">Photo réelle · couleur simulée</p>
            )}
          </div>
          {views.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-4" role="tablist" aria-label="Vues du produit">
              {views.map((v, i) => (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={i === index}
                  onClick={() => setIndex(i)}
                  className={`relative h-16 shrink-0 overflow-hidden rounded-xl bg-white ring-2 ${v.kind === 'photo' ? 'w-16' : 'px-3'} ${i === index ? 'ring-accent' : 'ring-transparent'}`}
                >
                  {v.kind === 'photo' ? (
                    <img src={thumbUrl(v.src, 200)} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <span className="text-[12.5px] font-semibold text-ink">{v.label}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-5 p-6 md:overflow-y-auto md:p-9">
          <div className="flex flex-wrap items-center gap-3 pr-12">
            <Kicker className="text-ink/50">{[product.brand, product.category].filter(Boolean).join(' · ')}</Kicker>
            <StockBadge stock={product.stock} />
          </div>
          <h2 className="font-display text-4xl leading-[1.02] md:text-5xl">{product.name}</h2>
          {product.rating.count > 0 && (
            <p className="flex items-center gap-2 text-[13px] text-ink/60">
              <Stars value={product.rating.average} /> {product.rating.average.toFixed(1)} · {product.rating.count} avis
            </p>
          )}
          <p className="font-display text-3xl text-accent">{formatPrice(product.price)}</p>
          {product.description && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink/70">{product.description}</p>}
          {product.specs.length > 0 && (
            <dl className="divide-y divide-ink/10 rounded-2xl bg-white text-[14px] ring-1 ring-ink/10">
              {product.specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-ink/50">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 items-center rounded-full bg-white ring-1 ring-ink/15">
              <button className="grid size-12 place-items-center text-xl" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Moins">
                −
              </button>
              <span className="w-8 text-center font-mono">{qty}</span>
              <button className="grid size-12 place-items-center text-xl" onClick={() => setQty((q) => Math.min(999, q + 1))} aria-label="Plus">
                +
              </button>
            </div>
            <button
              className="btn btn-ink flex-1 justify-center"
              disabled={product.stock === 'rupture'}
              onClick={() => {
                add(product.id, qty)
                setAdded(true)
              }}
            >
              {added ? (
                <>
                  <CheckIcon className="size-4" /> Ajouté au panier
                </>
              ) : (
                'Ajouter au panier'
              )}
            </button>
          </div>
          {added && (
            <button className="-mt-2 text-left text-[14px] font-semibold text-accent underline-offset-4 hover:underline" onClick={() => useApp.getState().open({ type: 'cart' })}>
              Voir mon panier →
            </button>
          )}
          <div className="flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="btn bg-[#1faa59] text-paper">
                <WhatsAppIcon className="size-5" /> Commander sur WhatsApp
              </a>
            )}
            {phone && (
              <a href={telHref(phone)} className="btn btn-ghost">
                <PhoneIcon className="size-4" /> {phone}
              </a>
            )}
          </div>

          <section className="mt-2 border-t border-ink/10 pt-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Avis clients</h3>
              {!writing && (
                <button className="text-[14px] font-semibold text-accent" onClick={() => setWriting(true)}>
                  Donner mon avis
                </button>
              )}
            </div>
            {writing && (
              <div className="mt-3">
                <ReviewForm productId={product.id} onDone={() => {}} />
              </div>
            )}
            {reviews.length === 0 ? (
              <p className="mt-3 text-[14px] text-ink/50">Aucun avis pour l’instant. Soyez le premier !</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-ink/10">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{r.name}</span>
                      <Stars value={r.rating} size="size-3.5" />
                    </div>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink/70">{r.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Modal>
  )
}

export { ReviewForm }
