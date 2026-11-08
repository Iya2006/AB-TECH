import { scrollToElement } from './scroll'
import { useApp } from './store'

/** Ouvre le formulaire de devis, avec une prestation pré-sélectionnée si fournie. */
export function requestQuote(service?: string) {
  const { prefill, setPrefill } = useApp.getState()
  if (service) setPrefill({ ...(prefill ?? {}), service })
  scrollToElement('#devis')
}
