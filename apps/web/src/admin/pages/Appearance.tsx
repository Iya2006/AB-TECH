import { HeroPreview, NavPreview, PhotocallPreview, PosterPreviewNote, PostersPreview, PreloaderPreview, ScreenPreview, SignPreview, WelcomePreview } from '../previews'
import { useSettingsDraft } from '../settingsDraft'
import { Designer, Field, ImageUploader, inputCls, PageHeader, Preview, SaveBar, Section } from '../ui'

/** Pictogrammes des blocs (24 × 24, au trait). */
const ICON = {
  logo: 'M12 3v18M3 12h18M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  facade: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6',
  welcome: 'M4 5h16v11H8l-4 4V5Zm4 4h8M8 12h5',
  sign: 'M3 6h18v7H3zM7 13v6M17 13v6M7 9.5h10',
  screen: 'M7 3h10v18H7zM10 18h4M9.5 7h5',
  posters: 'M6 3h12v15l-6-3-6 3V3Zm3 4h6',
  photocall: 'M4 7h3l2-3h6l2 3h3v12H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
}

/**
 * Apparence du site : tout ce que voit le visiteur (logo, accueil, message de bienvenue, enseigne, écran de vitrine,
 * affiches, photocall), chaque réglage avec son aperçu en direct.
 */
export function AppearancePage() {
  const { draft: s, set, dirty, saving, save, reset } = useSettingsDraft()
  if (!s) return null
  const display = s.display
  return (
    <>
      <PageHeader
        kicker="Design du site"
        title="Apparence du site"
        subtitle="Votre logo, vos textes d’accueil, votre enseigne et vos visuels dans l’atelier 3D. Ouvrez un bloc : son aperçu suit chaque frappe. Rien ne change sur le site avant « Enregistrer »."
      />
      <div className="pb-24">
        <Designer dirty={dirty} saving={saving} onSave={save}>
        <Section
          icon={ICON.logo}
          title="Logo & identité"
          text="Votre logo remplace le symbole dessiné dans la barre du site, l’écran de chargement et l’accueil. PNG détouré conseillé."
          preview={
            <div className="space-y-3">
              <Preview label="Écran de chargement · le logo passe derrière le verre">
                <PreloaderPreview s={s} />
              </Preview>
              <Preview label="Barre du site" tone="dark">
                <NavPreview s={s} />
              </Preview>
            </div>
          }
        >
          <div>
            <span className="kicker text-ink/50">Logo (facultatif)</span>
            <div className="mt-1.5">
              <ImageUploader single value={s.logo ? [s.logo] : []} onChange={(urls) => set('logo', urls[0] ?? '')} />
            </div>
            <span className="mt-1 block text-[12px] text-ink/40">Sans logo : le symbole et le nom ci-dessous.</span>
          </div>
          <Field label="Nom de l’entreprise" hint="Utilisé partout : titres, enseigne 3D, pied de page, e-mails.">
            <input className={inputCls} value={s.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom — première partie">
              <input className={inputCls} value={s.nameParts[0]} onChange={(e) => set('nameParts', [e.target.value, s.nameParts[1]])} />
            </Field>
            <Field label="Nom — partie en couleur">
              <input className={inputCls} value={s.nameParts[1]} onChange={(e) => set('nameParts', [s.nameParts[0], e.target.value])} />
            </Field>
          </div>
          <Field label="Signature" hint="Sous le logo et dans l’accroche (ex. Impression · Branding · Tech).">
            <input className={inputCls} value={s.tagline} maxLength={80} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
        </Section>

        <Section
          icon={ICON.facade}
          title="Accueil — devant la façade"
          text="Le premier texte que lit le visiteur, posé sur la façade de l’atelier."
          preview={
            <Preview>
              <HeroPreview s={s} />
            </Preview>
          }
        >
          <Field label="Accroche — ligne 1">
            <input className={inputCls} value={s.heroTitle[0]} maxLength={60} onChange={(e) => set('heroTitle', [e.target.value, s.heroTitle[1]])} />
          </Field>
          <Field label="Accroche — ligne 2 (en couleur)">
            <input className={inputCls} value={s.heroTitle[1]} maxLength={60} onChange={(e) => set('heroTitle', [s.heroTitle[0], e.target.value])} />
          </Field>
          <Field label="Texte d’accueil">
            <textarea className={`${inputCls} min-h-24`} value={s.heroText} maxLength={240} onChange={(e) => set('heroText', e.target.value)} />
          </Field>
        </Section>

        <Section
          icon={ICON.welcome}
          title="Message de bienvenue"
          text="La carte qui accueille le visiteur quand il entre dans l’atelier. Les chiffres (postes, réalisations, produits) sont calculés automatiquement."
          preview={
            <Preview>
              <WelcomePreview s={s} />
            </Preview>
          }
        >
          <Field label="Titre — ligne 1">
            <input className={inputCls} value={s.welcome.title[0]} maxLength={40} onChange={(e) => set('welcome', { ...s.welcome, title: [e.target.value, s.welcome.title[1]] })} />
          </Field>
          <Field label="Titre — ligne 2 (en couleur)">
            <input className={inputCls} value={s.welcome.title[1]} maxLength={40} onChange={(e) => set('welcome', { ...s.welcome, title: [s.welcome.title[0], e.target.value] })} />
          </Field>
          <Field label="Texte" hint={`${s.welcome.text.length} / 260 caractères`}>
            <textarea className={`${inputCls} min-h-28`} value={s.welcome.text} maxLength={260} onChange={(e) => set('welcome', { ...s.welcome, text: e.target.value })} />
          </Field>
        </Section>

        <Section
          icon={ICON.sign}
          title="Enseigne de la façade"
          text="Une photo de votre vraie plaque (ou un visuel) posée sur le bandeau lumineux. Format très allongé conseillé, environ 5 × 1 (ex. 2400 × 470 px)."
          preview={
            <Preview>
              <SignPreview sign={display.sign} />
            </Preview>
          }
        >
          <ImageUploader single value={display.sign ? [display.sign] : []} onChange={(urls) => set('display', { ...display, sign: urls[0] ?? '' })} />
        </Section>

        <Section
          icon={ICON.screen}
          title="Écran de la vitrine"
          text="Jusqu’à 8 images qui défilent sur l’écran vertical de la vitrine : promotions, nouveautés, flyers. Format portrait conseillé."
          preview={
            <Preview>
              <ScreenPreview urls={display.screen} />
            </Preview>
          }
        >
          <ImageUploader max={8} value={display.screen} onChange={(urls) => set('display', { ...display, screen: urls })} />
        </Section>

        <Section
          icon={ICON.posters}
          title="Grandes affiches & kakémonos"
          text="Jusqu’à 12 visuels (flyers, logos, affiches d’événements) accrochés au mur de l’impression et sur les kakémonos de l’événementiel."
          preview={
            <Preview>
              <PostersPreview urls={display.posters} />
              <PosterPreviewNote />
            </Preview>
          }
        >
          <ImageUploader max={12} value={display.posters} onChange={(urls) => set('display', { ...display, posters: urls })} />
        </Section>

        <Section
          icon={ICON.photocall}
          title="Fond du photocall"
          text="Le mur de l’espace événementiel : mur de logos, visuel d’inauguration… Format paysage, environ 2 × 1."
          preview={
            <Preview>
              <PhotocallPreview url={display.photocall} />
            </Preview>
          }
        >
          <ImageUploader single value={display.photocall ? [display.photocall] : []} onChange={(urls) => set('display', { ...display, photocall: urls[0] ?? '' })} />
        </Section>
        </Designer>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </>
  )
}
