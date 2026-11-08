import { useCallback, useEffect, useState } from 'react'
import { Journey } from './journey/Journey'
import { takeResume, useAuth, type AuthReason } from './lib/auth'
import { peekDraft } from './lib/drafts'
import { initScroll, scrollToElement } from './lib/scroll'
import { loadSite } from './lib/site'
import { useApp } from './lib/store'
import { FloatingContact, Footer } from './sections/Footer'
import { Method } from './sections/Method'
import { QuoteSection } from './sections/Quote'
import { RailSection } from './sections/Rail'
import { Reviews } from './sections/Reviews'
import { ServicesIndex } from './sections/ServicesIndex'
import { Shop } from './sections/Shop'
import { Studio } from './sections/Studio'
import { AuthPrompt } from './ui/AuthPrompt'
import { Nav } from './ui/Nav'
import { Overlays } from './ui/overlays/Overlays'
import { Preloader } from './ui/Preloader'

/** Retour de Google : on rouvre ce que le visiteur était en train de faire (devis, commande, avis). */
function resume(reason: AuthReason) {
  const run = () =>
    setTimeout(() => {
      if (reason === 'devis') scrollToElement('#devis')
      else if (reason === 'commande') useApp.getState().open({ type: 'cart', step: 'checkout' })
      else {
        const productId = peekDraft<{ productId?: string }>('avis')?.productId
        if (productId) useApp.getState().open({ type: 'product', id: productId })
        else scrollToElement('#avis')
      }
    }, 450)
  if (useApp.getState().ready) return run()
  const stop = useApp.subscribe((s) => {
    if (!s.ready) return
    stop()
    run()
  })
}

/** Les textures 3D dessinent du texte : on attend les polices avant de construire la scène. */
const FONTS = [
  '800 48px "Plus Jakarta Sans Variable"',
  '500 48px "Plus Jakarta Sans Variable"',
  '500 20px "JetBrains Mono Variable"',
  '500 20px "Inter Tight Variable"',
  '600 20px "Inter Tight Variable"',
]

export function App() {
  const [fontsReady, setFontsReady] = useState(false)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const onLoaded = useCallback(() => setSceneLoaded(true), [])

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    void loadSite()
    void useAuth.getState().load()
    const reason = takeResume()
    if (reason) resume(reason)
    return initScroll()
  }, [])

  useEffect(() => {
    const timeout = new Promise((resolve) => setTimeout(resolve, 4000))
    Promise.race([Promise.all(FONTS.map((f) => document.fonts.load(f))), timeout]).finally(() => setFontsReady(true))
  }, [])

  return (
    <>
      <Preloader loaded={sceneLoaded} />
      <Nav />
      <main>
        <Journey fontsReady={fontsReady} onLoaded={onLoaded} />
        <RailSection />
        <Shop />
        <Studio />
        <Reviews />
        <Method />
        <ServicesIndex />
        <QuoteSection />
      </main>
      <Footer />
      <FloatingContact />
      <Overlays />
      <AuthPrompt />
    </>
  )
}
