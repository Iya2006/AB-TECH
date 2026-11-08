import { useEffect, useState, type FormEvent } from 'react'
import { formatPrice, whatsappLink } from '../../config/brand'
import { api, ApiError } from '../../lib/api'
import { ensureUser, useAuth } from '../../lib/auth'
import { useCart } from '../../lib/cart'
import { useSite } from '../../lib/site'
import { useApp } from '../../lib/store'
import { CheckIcon, CloseIcon, Kicker, WhatsAppIcon } from '../primitives'
import { ProductVisual } from '../shop'
import { Modal } from './Modal'

export function CartDrawer({ initialStep }: { initialStep?: 'checkout' }) {
  const lines = useCart((s) => s.lines)
  const { setQty, remove, clear } = useCart.getState()
  const products = useSite((s) => s.products)
  const shopName = useSite((s) => s.settings.name)
  const user = useAuth((s) => s.user)
  const [step, setStep] = useState<'cart' | 'checkout' | 'done'>(initialStep ?? 'cart')
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', address: '', message: '' })
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [order, setOrder] = useState<{ id: string; total: number | null } | null>(null)

  // coordonnées reprises du compte (modifiables)
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, fullName: f.fullName || user.name, phone: f.phone || user.phone, email: f.email || user.email }))
  }, [user])

  const checkout = async () => {
    setError(null)
    if (await ensureUser('commande')) setStep('checkout')
  }

  const items = lines.flatMap((l) => {
    const p = products.find((x) => x.id === l.productId)
    return p ? [{ ...l, product: p }] : []
  })
  const allPriced = items.every((i) => i.product.price !== null)
  const total = allPriced ? items.reduce((s, i) => s + i.product.price! * i.qty, 0) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!(await ensureUser('commande'))) return setError('Connectez-vous pour valider votre commande.')
    setSending(true)
    try {
      const res = await api.createOrder({ ...form, items: items.map((i) => ({ productId: i.productId, qty: i.qty })) })
      setOrder({ id: res.id ?? '', total: res.total })
      clear()
      setStep('done')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) useAuth.setState({ user: null })
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setSending(false)
    }
  }

  const ref = order?.id.slice(0, 8).toUpperCase()
  const wa = whatsappLink(ref ? `Bonjour ${shopName}, je viens de passer la commande n° ${ref}.` : `Bonjour ${shopName}, je souhaite commander.`)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Modal label="Panier" variant="drawer">
      <header className="border-b border-ink/10 p-6 pr-16">
        <Kicker className="text-accent">{step === 'checkout' ? 'Vos coordonnées' : 'Panier'}</Kicker>
        <h2 className="mt-1 font-display text-4xl">{step === 'done' ? 'Merci !' : step === 'checkout' ? 'Commander' : 'Votre sélection'}</h2>
      </header>

      {step === 'done' ? (
        <div className="flex flex-1 flex-col justify-center gap-5 p-6">
          <span className="grid size-16 place-items-center rounded-full bg-accent text-paper">
            <CheckIcon className="size-8" />
          </span>
          <p className="text-[15.5px] leading-relaxed text-ink/70">
            Votre commande <strong className="font-mono text-ink">n° {ref}</strong> est bien enregistrée. Nous vous appelons pour confirmer la disponibilité et la livraison.
          </p>
          <a href="/compte#commandes" className="btn btn-ink justify-center">
            Suivre ma commande
          </a>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn justify-center bg-[#1faa59] text-paper">
              <WhatsAppIcon className="size-5" /> Écrire sur WhatsApp
            </a>
          )}
          <button className="btn btn-ghost justify-center" onClick={() => useApp.getState().close()}>
            Continuer la visite
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-ink/55">Votre panier est vide.</p>
          <button className="btn btn-ink" onClick={() => useApp.getState().open({ type: 'catalogue', tab: 'produits' })}>
            Découvrir les produits
          </button>
        </div>
      ) : step === 'cart' ? (
        <>
          <ul className="min-h-0 flex-1 divide-y divide-ink/10 overflow-y-auto px-6">
            {items.map(({ product, qty, productId }) => (
              <li key={productId} className="flex gap-4 py-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#eef2f7]">
                  <ProductVisual product={product} size="thumb" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate font-semibold">{product.name}</p>
                  <p className="text-[13.5px] font-bold text-accent">{formatPrice(product.price)}</p>
                  <div className="mt-auto flex items-center gap-2">
                    <button className="grid size-8 place-items-center rounded-full ring-1 ring-ink/15" onClick={() => setQty(productId, qty - 1)} aria-label="Moins">
                      −
                    </button>
                    <span className="w-6 text-center font-mono text-[14px]">{qty}</span>
                    <button className="grid size-8 place-items-center rounded-full ring-1 ring-ink/15" onClick={() => setQty(productId, qty + 1)} aria-label="Plus">
                      +
                    </button>
                    <button className="ml-auto grid size-8 place-items-center rounded-full text-ink/40 hover:text-rose-600" onClick={() => remove(productId)} aria-label="Retirer">
                      <CloseIcon className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <footer className="space-y-3 border-t border-ink/10 p-6">
            <div className="flex items-baseline justify-between">
              <span className="text-ink/60">Total</span>
              <span className="font-mono text-xl font-semibold">{total !== null ? formatPrice(total) : 'Sur devis'}</span>
            </div>
            <button className="btn btn-ink w-full justify-center" onClick={checkout}>
              Commander
            </button>
            {error && <p className="text-center text-[13px] text-rose-600">{error}</p>}
            <p className="text-center text-[12px] text-ink/45">
              Aucun paiement en ligne : nous vous rappelons pour confirmer la commande.{user ? '' : ' Un compte gratuit vous permet de la suivre.'}
            </p>
          </footer>
        </>
      ) : (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-6">
            <label className="block">
              <span className="kicker text-ink/50">Nom complet *</span>
              <input className="field" autoComplete="name" value={form.fullName} onChange={set('fullName')} required />
            </label>
            <label className="block">
              <span className="kicker text-ink/50">Téléphone / WhatsApp *</span>
              <input className="field" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} required />
            </label>
            <label className="block">
              <span className="kicker text-ink/50">E-mail</span>
              <input className="field" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
            </label>
            <label className="block">
              <span className="kicker text-ink/50">Adresse de livraison</span>
              <input className="field" autoComplete="street-address" value={form.address} onChange={set('address')} />
            </label>
            <label className="block">
              <span className="kicker text-ink/50">Message</span>
              <textarea className="field min-h-20" value={form.message} onChange={set('message')} />
            </label>
            {error && <p className="text-[14px] text-rose-600">{error}</p>}
          </div>
          <footer className="flex gap-2 border-t border-ink/10 p-6">
            <button type="button" className="btn btn-ghost" onClick={() => setStep('cart')}>
              Retour
            </button>
            <button className="btn btn-ink flex-1 justify-center" disabled={sending}>
              {sending ? 'Envoi…' : 'Valider la commande'}
            </button>
          </footer>
        </form>
      )}
    </Modal>
  )
}
