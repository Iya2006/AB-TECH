import type { SiteSettings } from '@atelier/shared'
import { useEffect, useState } from 'react'
import { applySettings } from '../config/brand'
import { api } from '../lib/api'
import { useSite } from '../lib/site'
import { errorText, toast } from './ui'

/**
 * Réglages du site en cours d'édition : brouillon (alimente les aperçus en direct), version enregistrée,
 * enregistrement et annulation. Après l'enregistrement, l'espace pro reflète aussitôt les changements (logo…).
 */
export function useSettingsDraft() {
  const [saved, setSaved] = useState<SiteSettings | null>(null)
  const [draft, setDraft] = useState<SiteSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.admin
      .settings()
      .then((s) => {
        setSaved(s)
        setDraft(s)
      })
      .catch((e) => toast(errorText(e), 'error'))
  }, [])

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))
  const dirty = !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft)

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const result = await api.admin.saveSettings(draft)
      setSaved(result)
      setDraft(result)
      applySettings(result)
      useSite.setState({ settings: result })
      toast('Enregistré — visible sur le site au prochain chargement')
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return { draft, set, dirty, saving, save, reset: () => setDraft(saved) }
}
