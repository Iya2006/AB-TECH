import { useApp } from '../../lib/store'
import { CartDrawer } from './Cart'
import { Catalogue } from './Catalogue'
import { Lightbox } from './Lightbox'
import { MachineModal } from './MachineModal'
import { ProductModal } from './ProductModal'

/** Fenêtre active (galerie, fiche produit, catalogue, panier) — une seule à la fois. */
export function Overlays() {
  const overlay = useApp((s) => s.overlay)
  if (!overlay) return null
  switch (overlay.type) {
    case 'realisation':
      return <Lightbox key={overlay.id} id={overlay.id} startIndex={overlay.index} />
    case 'product':
      return <ProductModal key={overlay.id} id={overlay.id} />
    case 'catalogue':
      return <Catalogue key={`${overlay.tab}-${overlay.station}`} tab={overlay.tab} station={overlay.station} />
    case 'cart':
      return <CartDrawer initialStep={overlay.step} />
    case 'machine':
      return <MachineModal key={overlay.id} id={overlay.id} />
  }
}
