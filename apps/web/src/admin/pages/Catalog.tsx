import {
  PRODUCT_MODELS,
  STATION_SLUGS,
  STOCK_STATUSES,
  type Product,
  type ProductInput,
  type ProductModel,
  type Realisation,
  type RealisationInput,
  type StationSlug,
} from '@atelier/shared'
import { useEffect, useMemo, useState } from 'react'
import { formatPrice } from '../../config/brand'
import { api } from '../../lib/api'
import { thumbUrl } from '../../ui/img'
import { ProductCard, ProductVisual } from '../../ui/shop'
import { Card, DangerButton, Drawer, Empty, errorText, Field, ImageUploader, inputCls, PageHeader, Pill, Preview, toast, Toggle } from '../ui'

export const STATION_LABEL: Record<StationSlug, string> = {
  creation: 'Création',
  impression: 'Impression',
  textile: 'Textile',
  objets: 'Objets & cadeaux',
  evenementiel: 'Événementiel',
  informatique: 'Informatique',
  securite: 'Sécurité',
}

const MODEL_LABEL: Record<ProductModel, string> = {
  aucun: 'Aucune (pas affiché dans l’atelier)',
  tshirt: 'T-shirt (portant)',
  polo: 'Polo (portant)',
  sweat: 'Sweat à capuche (portant)',
  pull: 'Pull col rond (portant)',
  casquette: 'Casquette classique',
  snapback: 'Casquette visière plate',
  trucker: 'Casquette trucker (filet)',
  mug: 'Mug',
  tote: 'Tote bag',
  gourde: 'Gourde',
  portable: 'Ordinateur portable',
  ecran: 'Écran',
  tour: 'Unité centrale',
  clavier: 'Clavier & souris',
  routeur: 'Routeur',
  'camera-dome': 'Caméra dôme',
  'camera-bullet': 'Caméra bullet',
  extincteur: 'Extincteur',
  coffret: 'Coffret cadeau',
  boite: 'Boîte produit',
}

const STOCK_LABEL = { en_stock: 'En stock', sur_commande: 'Sur commande', rupture: 'Rupture' } as const

function StationFilter({ value, onChange, counts }: { value: StationSlug | 'tous'; onChange: (v: StationSlug | 'tous') => void; counts: Record<string, number> }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {(['tous', ...STATION_SLUGS] as const).map((s) => (
        <button key={s} onClick={() => onChange(s)} className={`rounded-full px-4 py-2 text-[13px] font-medium ${value === s ? 'bg-ink text-paper' : 'bg-white ring-1 ring-ink/10'}`}>
          {s === 'tous' ? 'Tous' : STATION_LABEL[s]} <span className="opacity-60">{counts[s] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}

function useStationCounts(list: Array<{ station: string }>) {
  return useMemo(() => {
    const c: Record<string, number> = { tous: list.length }
    list.forEach((x) => (c[x.station] = (c[x.station] ?? 0) + 1))
    return c
  }, [list])
}

/* ------------------------------------------------------------------ */
/* Produits                                                            */
/* ------------------------------------------------------------------ */

const EMPTY_PRODUCT: ProductInput = {
  name: '',
  station: 'informatique',
  category: '',
  brand: '',
  price: null,
  description: '',
  specs: [],
  images: [],
  stock: 'en_stock',
  featured: false,
  active: true,
  sortOrder: 0,
  model: 'boite',
  color: '#2563eb',
  printImage: '',
}

function ProductEditor({ initial, id, onClose, onSaved }: { initial: ProductInput; id?: string; onClose: () => void; onSaved: (p: Product) => void }) {
  const [p, setP] = useState<ProductInput>(initial)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setP((x) => ({ ...x, [k]: v }))
  const save = async () => {
    setSaving(true)
    try {
      const saved = await api.admin.saveProduct(p, id)
      toast(id ? 'Produit enregistré' : 'Produit ajouté — visible sur le site')
      onSaved(saved)
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setSaving(false)
    }
  }
  const printable = ['tshirt', 'polo', 'sweat', 'pull', 'casquette', 'snapback', 'trucker', 'mug', 'tote', 'gourde'].includes(p.model)
  // carte boutique alimentée par le formulaire en cours (non cliquable)
  const preview: Product = { ...p, id: id ?? 'apercu', slug: 'apercu', rating: { average: 0, count: 0 } }
  return (
    <Drawer
      title={id ? 'Modifier le produit' : 'Nouveau produit'}
      onClose={onClose}
      aside={
        <Preview label="En boutique">
          <div className="pointer-events-none mx-auto max-w-[15rem]" aria-hidden>
            <ProductCard product={preview} />
          </div>
          <p className="mt-3 text-[12px] leading-snug text-ink/50">
            {p.active ? 'Visible sur le site' : 'Masqué : non visible sur le site'} · exposé au poste « {STATION_LABEL[p.station]} » de l’atelier 3D.
          </p>
        </Preview>
      }
      footer={
        <>
          <Toggle checked={p.active} onChange={(v) => set('active', v)} label="Visible sur le site" />
          <button onClick={save} disabled={saving} className="btn btn-ink">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <Card className="space-y-4">
        <Field label="Nom du produit *">
          <input className={inputCls} value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="ex. Ordinateur portable 15,6″" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Poste de l’atelier" hint="Où le produit est exposé en 3D.">
            <select className={inputCls} value={p.station} onChange={(e) => set('station', e.target.value as StationSlug)}>
              {STATION_SLUGS.map((s) => (
                <option key={s} value={s}>
                  {STATION_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Catégorie *">
            <input className={inputCls} value={p.category} onChange={(e) => set('category', e.target.value)} placeholder="ex. Ordinateurs" />
          </Field>
          <Field label="Marque">
            <input className={inputCls} value={p.brand} onChange={(e) => set('brand', e.target.value)} />
          </Field>
          <Field label="Prix" hint="Laisser vide : « Prix sur demande ».">
            <input
              className={inputCls}
              inputMode="numeric"
              value={p.price ?? ''}
              onChange={(e) => set('price', e.target.value.trim() === '' ? null : Math.max(0, Math.round(Number(e.target.value.replace(/\s/g, '')) || 0)))}
              placeholder="ex. 250000"
            />
          </Field>
          <Field label="Disponibilité">
            <select className={inputCls} value={p.stock} onChange={(e) => set('stock', e.target.value as ProductInput['stock'])}>
              {STOCK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STOCK_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ordre d’affichage" hint="Les plus petits d’abord.">
            <input className={inputCls} type="number" min={0} value={p.sortOrder} onChange={(e) => set('sortOrder', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className={`${inputCls} min-h-28`} value={p.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Toggle checked={p.featured} onChange={(v) => set('featured', v)} label="Mettre en avant" />
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="kicker text-ink/50">Caractéristiques</span>
          <button type="button" className="text-[13px] font-semibold text-accent" onClick={() => set('specs', [...p.specs, ['', '']])}>
            + Ajouter une ligne
          </button>
        </div>
        {p.specs.length === 0 && <p className="text-[13px] text-ink/45">ex. Écran → 15,6 pouces · Stockage → SSD 512 Go</p>}
        {p.specs.map(([k, v], i) => (
          <div key={i} className="flex gap-2">
            <input className={inputCls} placeholder="Caractéristique" value={k} onChange={(e) => set('specs', p.specs.map((s, j) => (j === i ? [e.target.value, s[1]] : s)))} />
            <input className={inputCls} placeholder="Valeur" value={v} onChange={(e) => set('specs', p.specs.map((s, j) => (j === i ? [s[0], e.target.value] : s)))} />
            <button type="button" className="mt-1.5 shrink-0 rounded-xl px-3 text-rose-600 hover:bg-rose-50" onClick={() => set('specs', p.specs.filter((_, j) => j !== i))} aria-label="Retirer">
              ×
            </button>
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <span className="kicker text-ink/50">Photos (la première est la principale)</span>
        <ImageUploader cutout value={p.images} onChange={(v) => set('images', v)} />
        <p className="text-[12.5px] leading-relaxed text-ink/50">
          Pour l’atelier, préférez une photo détourée (PNG transparent) ou prise sur fond uni, puis « Détourer » : le vêtement apparaît sur le
          portant comme un vrai article. Sans photo, l’atelier montre une vraie pièce du même modèle, à la couleur choisie.
        </p>
      </Card>

      <Card className="space-y-4">
        <span className="kicker text-ink/50">Présentation dans l’atelier 3D</span>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Forme 3D">
            <select className={inputCls} value={p.model} onChange={(e) => set('model', e.target.value as ProductModel)}>
              {PRODUCT_MODELS.map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Couleur">
            <input type="color" className="mt-1.5 h-11 w-20 cursor-pointer rounded-xl bg-white ring-1 ring-ink/10" value={p.color} onChange={(e) => set('color', e.target.value)} />
          </Field>
        </div>
        {printable && (
          <Field label="Visuel imprimé sur le produit" hint="Idéalement un PNG à fond transparent (logo, motif).">
            <div className="mt-1.5">
              <ImageUploader single value={p.printImage ? [p.printImage] : []} onChange={(v) => set('printImage', v[0] ?? '')} />
            </div>
          </Field>
        )}
      </Card>
    </Drawer>
  )
}

export function ProductsPage() {
  const [list, setList] = useState<Product[]>([])
  const [station, setStation] = useState<StationSlug | 'tous'>('tous')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{ id?: string; input: ProductInput } | null>(null)
  const counts = useStationCounts(list)
  useEffect(() => {
    api.admin.products().then(setList).catch((e) => toast(errorText(e), 'error'))
  }, [])
  const remove = async (id: string) => {
    try {
      await api.admin.deleteProduct(id)
      setList((l) => l.filter((p) => p.id !== id))
      toast('Produit supprimé')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
  const visible = list.filter(
    (p) => (station === 'tous' || p.station === station) && (!query || `${p.name} ${p.category} ${p.brand}`.toLowerCase().includes(query.toLowerCase())),
  )
  const edit = (p: Product) => {
    const { id, slug: _slug, rating: _rating, ...input } = p
    setEditing({ id, input })
  }
  return (
    <>
      <PageHeader kicker="Catalogue"
        title="Produits"
        subtitle="Boutique, textile, objets : tout ce qui est exposé dans l’atelier et vendu en ligne."
        action={
          <button className="btn btn-ink" onClick={() => setEditing({ input: { ...EMPTY_PRODUCT, station: station === 'tous' ? 'informatique' : station } })}>
            + Nouveau produit
          </button>
        }
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StationFilter value={station} onChange={setStation} counts={counts} />
        <input className={`${inputCls} !mt-0 max-w-xs`} placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {visible.length === 0 ? (
        <Empty>Aucun produit ici. Ajoutez-en un : il apparaîtra dans l’atelier 3D et la boutique.</Empty>
      ) : (
        <div className="overflow-hidden rounded-[20px] bg-white ring-1 ring-ink/[0.07]">
          <table className="w-full text-[14px]">
            <thead className="bg-[#f4f7fb] text-left text-[12px] uppercase tracking-wider text-ink/50">
              <tr>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Poste</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Prix</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Stock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {visible.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-[#f8fafc]" onClick={() => edit(p)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-[#eef2f7]">
                        <ProductVisual product={p} size="thumb" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-[12.5px] text-ink/50">
                          {p.category}
                          {!p.active && ' · masqué'}
                          {p.featured && ' · ★ en avant'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{STATION_LABEL[p.station]}</td>
                  <td className="hidden px-4 py-3 font-mono sm:table-cell">{formatPrice(p.price)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <Pill tone={p.stock === 'en_stock' ? 'ok' : p.stock === 'rupture' ? 'danger' : 'warn'}>{STOCK_LABEL[p.stock]}</Pill>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DangerButton onConfirm={() => remove(p.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ProductEditor
          initial={editing.input}
          id={editing.id}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setList((l) => (l.some((x) => x.id === saved.id) ? l.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...l]))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Réalisations                                                        */
/* ------------------------------------------------------------------ */

const EMPTY_REALISATION: RealisationInput = { station: 'impression', title: '', description: '', images: [], featured: false, published: true, sortOrder: 0 }

function RealisationEditor({ initial, id, onClose, onSaved }: { initial: RealisationInput; id?: string; onClose: () => void; onSaved: (r: Realisation) => void }) {
  const [r, setR] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof RealisationInput>(k: K, v: RealisationInput[K]) => setR((x) => ({ ...x, [k]: v }))
  const save = async () => {
    setSaving(true)
    try {
      const saved = await api.admin.saveRealisation(r, id)
      toast(id ? 'Réalisation enregistrée' : 'Réalisation ajoutée — accrochée dans l’atelier')
      onSaved(saved)
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Drawer
      title={id ? 'Modifier la réalisation' : 'Nouvelle réalisation'}
      onClose={onClose}
      footer={
        <>
          <Toggle checked={r.published} onChange={(v) => set('published', v)} label="Publiée" />
          <button onClick={save} disabled={saving} className="btn btn-ink">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <Card className="space-y-4">
        <Field label="Titre *">
          <input className={inputCls} value={r.title} onChange={(e) => set('title', e.target.value)} placeholder="ex. Identité visuelle du restaurant Le Phare" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Accrochée au poste" hint="Le cadre apparaît sur le mur de ce poste.">
            <select className={inputCls} value={r.station} onChange={(e) => set('station', e.target.value as StationSlug)}>
              {STATION_SLUGS.map((s) => (
                <option key={s} value={s}>
                  {STATION_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ordre d’accrochage">
            <input className={inputCls} type="number" min={0} value={r.sortOrder} onChange={(e) => set('sortOrder', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className={`${inputCls} min-h-28`} value={r.description} onChange={(e) => set('description', e.target.value)} placeholder="Le contexte, le support, la quantité…" />
        </Field>
        <Toggle checked={r.featured} onChange={(v) => set('featured', v)} label="Mettre en avant" />
      </Card>
      <Card className="space-y-3">
        <span className="kicker text-ink/50">Photos * (la première s’affiche dans le cadre)</span>
        <ImageUploader value={r.images} onChange={(v) => set('images', v)} max={20} />
      </Card>
    </Drawer>
  )
}

export function RealisationsPage() {
  const [list, setList] = useState<Realisation[]>([])
  const [station, setStation] = useState<StationSlug | 'tous'>('tous')
  const [editing, setEditing] = useState<{ id?: string; input: RealisationInput } | null>(null)
  const counts = useStationCounts(list)
  useEffect(() => {
    api.admin.realisations().then(setList).catch((e) => toast(errorText(e), 'error'))
  }, [])
  const remove = async (id: string) => {
    try {
      await api.admin.deleteRealisation(id)
      setList((l) => l.filter((r) => r.id !== id))
      toast('Réalisation supprimée')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }
  const visible = list.filter((r) => station === 'tous' || r.station === station)
  return (
    <>
      <PageHeader kicker="Catalogue"
        title="Réalisations"
        subtitle="Les cadres accrochés dans l’atelier 3D et le catalogue. Autant que vous voulez, plusieurs photos chacun."
        action={
          <button className="btn btn-ink" onClick={() => setEditing({ input: { ...EMPTY_REALISATION, station: station === 'tous' ? 'impression' : station } })}>
            + Nouvelle réalisation
          </button>
        }
      />
      <StationFilter value={station} onChange={setStation} counts={counts} />
      {visible.length === 0 ? (
        <Empty>Aucune réalisation ici pour l’instant.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((r) => {
            const { id, createdAt: _c, ...input } = r
            return (
              <div key={r.id} className="group overflow-hidden rounded-[20px] bg-white ring-1 ring-ink/[0.07]">
                <button className="relative block aspect-[4/3] w-full overflow-hidden bg-[#eef2f7]" onClick={() => setEditing({ id, input })}>
                  <img src={thumbUrl(r.images[0] ?? '', 600)} alt={r.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 flex gap-1.5">
                    {!r.published && <Pill tone="neutral">Brouillon</Pill>}
                    {r.featured && <Pill tone="accent">En avant</Pill>}
                  </span>
                  <span className="kicker absolute bottom-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 !text-[10px] text-paper">{r.images.length} photo(s)</span>
                </button>
                <div className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="kicker text-accent">{STATION_LABEL[r.station]}</p>
                    <p className="truncate font-medium">{r.title}</p>
                  </div>
                  <DangerButton onConfirm={() => remove(r.id)}>×</DangerButton>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {editing && (
        <RealisationEditor
          initial={editing.input}
          id={editing.id}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setList((l) => (l.some((x) => x.id === saved.id) ? l.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...l]))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
