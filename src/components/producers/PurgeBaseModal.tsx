import { useEffect, useState } from 'react'
import { X, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { producersApi } from '../../api/producers'
import { useAppStore } from '../../store/appStore'
import { apiErrorMessage } from '../../utils/retry'

interface Props {
  cooperativeId: string
  /** Page d'origine : coche par défaut le registre (page Registre) ou les producteurs (page Producteurs). */
  from: 'registry' | 'producers'
  onClose: () => void
  onDone?: () => void
}

/** « Supprimer la base » : vide le registre et/ou la base producteurs de la coopérative, après confirmation écrite. */
export default function PurgeBaseModal({ cooperativeId, from, onClose, onDone }: Props) {
  const addNotification = useAppStore((s) => s.addNotification)
  const [info, setInfo] = useState<{ cooperative: string; producers: number; protected: number; registry_sheets: number } | null>(null)
  const [registry, setRegistry] = useState(true)
  const [producers, setProducers] = useState(from === 'producers')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    producersApi.purgeInfo(cooperativeId).then(({ data }) => setInfo(data))
      .catch((e) => addNotification({ type: 'error', title: 'Supprimer la base', message: apiErrorMessage(e) }))
  }, [cooperativeId, addNotification])

  const run = async () => {
    setBusy(true)
    try {
      const { data } = await producersApi.purge({ registry, producers, confirm }, cooperativeId)
      const parts = [registry && `registre vidé (${data.registry_sheets} feuille(s))`, producers && `${data.deleted.toLocaleString('fr-FR')} producteur(s) supprimé(s)`].filter(Boolean)
      addNotification({
        type: 'success', title: 'Base supprimée',
        message: parts.join(', ') + (data.protected ? ` — ${data.protected} producteur(s) conservé(s) car ils ont des parcelles mappées ou figurent dans un lot.` : '.'),
      })
      if (producers) useAppStore.getState().refreshData()
      onDone?.()
      onClose()
    } catch (e) {
      addNotification({ type: 'error', title: 'Suppression impossible', message: apiErrorMessage(e) })
    } finally { setBusy(false) }
  }

  const n = (v?: number) => (v ?? 0).toLocaleString('fr-FR')
  const ok = confirm.trim().toUpperCase() === 'SUPPRIMER' && (registry || producers) && !busy
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Supprimer la base</h2>
              <p className="text-sm text-gray-500">{info?.cooperative ?? '…'} — action définitive, sans retour en arrière.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-2 text-sm text-gray-800">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={registry} onChange={(e) => setRegistry(e.target.checked)} />
            <span>Le registre <span className="text-gray-500">({n(info?.registry_sheets)} feuille(s))</span></span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={producers} onChange={(e) => setProducers(e.target.checked)} />
            <span>La base producteurs <span className="text-gray-500">({n(info?.producers)} producteur(s))</span></span>
          </label>
        </div>

        {producers && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              {info?.protected ? <>{n(info.protected)} producteur(s) seront conservés : ils ont des parcelles mappées par les agents ou figurent dans une fiche de lot. </> : null}
              Les anciens polygones importés ne sont pas supprimés ; ils seront recroisés au prochain import du registre.
            </span>
          </p>
        )}

        <label className="block text-xs text-gray-600">Pour confirmer, saisissez <span className="font-semibold text-red-700">SUPPRIMER</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoFocus
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Annuler</button>
          <button onClick={run} disabled={!ok}
            className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  )
}
