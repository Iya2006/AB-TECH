import { SECTION_IDS, SERVICES, type MachineText, type SectionId, type SectionText } from '@atelier/shared'
import { MACHINES, type MachineId } from '../../lib/machines'
import { MACHINE_ICON } from '../../ui/overlays/MachineModal'
import { MachinePreview, SectionHeaderPreview } from '../previews'
import { useSettingsDraft } from '../settingsDraft'
import { Designer, Field, inputCls, PageHeader, Pill, Preview, SaveBar, Section } from '../ui'

/** Pictogrammes des sections de la page (24 × 24, au trait). */
const SECTION_ICON: Record<SectionId, string> = {
  portant: 'M4 6h16M7 6l-2 4h4l-2-4Zm10 0-2 4h4l-2-4ZM6 10v8M18 10v8M12 6v12',
  boutique: 'M5 8h14l-1.2 12H6.2L5 8Zm4 0V6a3 3 0 0 1 6 0v2',
  studio: 'M4 20l4-1 11-11-3-3L5 16l-1 4ZM14 7l3 3',
  avis: 'M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.8L12 3Z',
  methode: 'M5 5h4v4H5zM15 5h4v4h-4zM5 15h4v4H5zM15 15h4v4h-4zM9 7h6M17 9v6M9 17h6',
  prestations: 'M4 6h16M4 12h16M4 18h10',
  devis: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  contact: 'M5.2 4.5h3l1.6 4-2 1.3a10.5 10.5 0 0 0 6.4 6.4l1.3-2 4 1.6v3a1.6 1.6 0 0 1-1.7 1.6A15.6 15.6 0 0 1 3.6 6.2a1.6 1.6 0 0 1 1.6-1.7Z',
}

/** Où apparaît chaque section, et sur quel fond (pour l'aperçu). */
const SECTION_INFO: Record<SectionId, { title: string; where: string; dark: boolean; fallback?: string }> = {
  portant: { title: 'Le portant', where: 'Les vêtements suspendus qui défilent, juste après la visite de l’atelier.', dark: false },
  boutique: { title: 'La boutique', where: 'Les produits par rayon, ajout au panier.', dark: false },
  studio: { title: 'Le Studio', where: 'L’essai du logo en direct sur les vêtements, mugs, cartes…', dark: false },
  avis: { title: 'Avis clients', where: 'Les avis validés qui défilent, et le formulaire pour en laisser un.', dark: false },
  methode: { title: 'Notre méthode', where: 'Les quatre étapes, du brief à la remise.', dark: true },
  prestations: { title: 'Les prestations', where: 'La liste complète des prestations. Sur-titre vide : le nombre de prestations s’affiche.', dark: false, fallback: `${SERVICES.length} prestations` },
  devis: { title: 'Le devis', where: 'Le formulaire de demande de devis gratuit.', dark: true },
  contact: { title: 'Contact (pied de page)', where: 'L’appel à nous joindre, au-dessus du pied de page.', dark: true },
}

/** Textes des sections de la page, chacun avec l'aperçu de son en-tête. */
export function SectionsPage() {
  const { draft: s, set, dirty, saving, save, reset } = useSettingsDraft()
  if (!s) return null
  const update = (id: SectionId, next: SectionText) => set('sections', { ...s.sections, [id]: next })
  return (
    <>
      <PageHeader kicker="Design du site" title="Sections de la page" subtitle="Le titre et le texte de chaque partie du site, sous la visite 3D. Le titre a deux lignes : la seconde s’affiche en couleur." />
      <div className="pb-24">
        <Designer dirty={dirty} saving={saving} onSave={save}>
        {SECTION_IDS.map((id) => {
          const t = s.sections[id]
          const info = SECTION_INFO[id]
          return (
            <Section
              key={id}
              icon={SECTION_ICON[id]}
              title={info.title}
              text={info.where}
              preview={
                <Preview label="En-tête sur le site">
                  <SectionHeaderPreview t={t} dark={info.dark} kickerFallback={info.fallback} />
                </Preview>
              }
            >
              <Field label="Sur-titre">
                <input className={inputCls} value={t.kicker} maxLength={40} onChange={(e) => update(id, { ...t, kicker: e.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Titre — ligne 1">
                  <input className={inputCls} value={t.title[0]} maxLength={50} onChange={(e) => update(id, { ...t, title: [e.target.value, t.title[1]] })} />
                </Field>
                <Field label="Titre — ligne 2 (en couleur)">
                  <input className={inputCls} value={t.title[1]} maxLength={50} onChange={(e) => update(id, { ...t, title: [t.title[0], e.target.value] })} />
                </Field>
              </div>
              <Field label="Texte (facultatif)" hint={`${t.text.length} / 320 caractères`}>
                <textarea className={`${inputCls} min-h-24`} value={t.text} maxLength={320} onChange={(e) => update(id, { ...t, text: e.target.value })} />
              </Field>
            </Section>
          )
        })}
        </Designer>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </>
  )
}

/** Fiches des machines de l'atelier (ouvertes au clic pendant la visite). */
export function MachinesPage() {
  const { draft: s, set, dirty, saving, save, reset } = useSettingsDraft()
  if (!s) return null
  const ids = Object.keys(MACHINES) as MachineId[]
  const valueOf = (id: MachineId): MachineText => s.machines[id] ?? { name: MACHINES[id].name, text: MACHINES[id].text, makes: MACHINES[id].makes }
  const update = (id: MachineId, next: MachineText) => set('machines', { ...s.machines, [id]: next })
  const restore = (id: MachineId) => {
    const next = { ...s.machines }
    delete next[id]
    set('machines', next)
  }
  return (
    <>
      <PageHeader
        kicker="Design du site"
        title="Machines de l’atelier"
        subtitle="La fiche qui s’ouvre quand le visiteur clique sur une machine pendant la visite 3D. Décrivez ce que vous réalisez avec, pour vos clients."
      />
      <div className="pb-24">
        <Designer dirty={dirty} saving={saving} onSave={save}>
        {ids.map((id) => {
          const v = valueOf(id)
          const base = MACHINES[id]
          return (
            <Section
              key={id}
              icon={MACHINE_ICON[id]}
              title={v.name || base.name}
              text={base.kicker}
              badge={s.machines[id] ? <Pill tone="accent">Personnalisé</Pill> : undefined}
              preview={
                <Preview label="Au clic sur la machine">
                  <MachinePreview m={{ ...base, ...v, makes: v.makes.filter((x) => x.trim()) }} />
                </Preview>
              }
            >
              <Field label="Nom">
                <input className={inputCls} value={v.name} maxLength={60} onChange={(e) => update(id, { ...v, name: e.target.value })} />
              </Field>
              <Field label="Présentation" hint={`${v.text.length} / 300 caractères`}>
                <textarea className={`${inputCls} min-h-24`} value={v.text} maxLength={300} onChange={(e) => update(id, { ...v, text: e.target.value })} />
              </Field>
              <Field label="Ce que vous réalisez avec" hint="Une réalisation par ligne (6 maximum).">
                <textarea
                  className={`${inputCls} min-h-28`}
                  value={v.makes.join('\n')}
                  onChange={(e) =>
                    update(id, {
                      ...v,
                      makes: e.target.value
                        .split('\n')
                        .map((x) => x.slice(0, 60))
                        .slice(0, 6),
                    })
                  }
                />
              </Field>
              {s.machines[id] && (
                <button type="button" onClick={() => restore(id)} className="text-[13px] font-semibold text-ink/55 underline-offset-4 hover:text-ink hover:underline">
                  Rétablir le texte par défaut
                </button>
              )}
            </Section>
          )
        })}
        </Designer>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </>
  )
}
