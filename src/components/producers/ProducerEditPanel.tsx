import { useState } from 'react'
import { X, Save, Trash2, Loader2, Eraser } from 'lucide-react'
import type { Producer } from '../../types'
import { producersApi } from '../../api/producers'
import { mapProducer } from '../../api/mappers'
import { useAppStore } from '../../store/appStore'
import { apiErrorMessage } from '../../utils/retry'

// Champs modifiables du producteur (tous peuvent être vidés, sauf le code)
const FIELDS: { key: string; label: string; from: (p: Producer) => unknown; type?: 'number' }[] = [
  { key: 'last_name', label: 'Nom', from: (p) => p.lastName },
  { key: 'first_name', label: 'Prénom(s)', from: (p) => p.firstName },
  { key: 'phone', label: 'Téléphone', from: (p) => p.phone },
  { key: 'national_id', label: "N° pièce d'identité", from: (p) => p.nationalId },
  { key: 'village', label: 'Village', from: (p) => p.village },
  { key: 'section', label: 'Section', from: (p) => p.section },
  { key: 'region', label: 'Région', from: (p) => p.region },
  { key: 'birth_year', label: 'Année de naissance', from: (p) => p.birthYear, type: 'number' },
]

/** Fiche producteur modifiable : chaque valeur peut être corrigée ou effacée ; suppression du producteur. */
export default function ProducerEditPanel({ producer, polygonCount, onClose }: { producer: Producer; polygonCount: number; onClose: () => void }) {
  const { updateProducer, removeProducers, addNotification } = useAppStore()
  const [code, setCode] = useState(producer.fieldIdBase)
  const [gender, setGender] = useState(producer.gender)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, String(f.from(producer) ?? '')])))
  const [extra, setExtra] = useState<[string, string][]>(() => Object.entries(producer.extraData ?? {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)]))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const save = async () => {
    setBusy('save'); setError('')
    try {
      const body: Record<string, unknown> = { gender, extra_data: Object.fromEntries(extra) }
      for (const f of FIELDS) body[f.key] = f.type === 'number' ? (values[f.key].trim() ? Number(values[f.key]) : null) : values[f.key].trim()
      if (code.trim() !== producer.fieldIdBase) body.field_id_base = code.trim()
      const { data } = await producersApi.update(producer.id, body)
      updateProducer(producer.id, mapProducer({ ...data, legacy_polygon_count: producer.legacyPolygonCount, polygon_count: producer.polygonCount, to_map: producer.toMap }))
      if (body.field_id_base) useAppStore.getState().refreshData()          // code corrigé : polygones recroisés
      addNotification({ type: 'success', title: 'Producteur enregistré', message: code })
      onClose()
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy('') }
  }

  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement le producteur ${producer.fullName} (${producer.fieldIdBase}) ?`)) return
    setBusy('delete'); setError('')
    try {
      await producersApi.remove(producer.id)
      removeProducers([producer.id])
      addNotification({ type: 'success', title: 'Producteur supprimé', message: producer.fieldIdBase })
      onClose()
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy('') }
  }

  const input = 'mt-1 w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
  const clearBtn = (onClick: () => void) => (
    <button type="button" onClick={onClick} title="Effacer" className="absolute right-2 top-[30px] text-gray-300 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
  )
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-gray-900">Fiche producteur</h3>
          <p className="text-xs text-gray-500">{polygonCount} polygone(s){polygonCount === 0 ? ' · à mapper par les agents' : ''}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fermer"><X className="h-5 w-5 text-gray-500" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <label className="block text-xs text-gray-600">Code producteur (registre)
          <input value={code} onChange={(e) => setCode(e.target.value)} className={`${input} font-mono`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="relative block text-xs text-gray-600">{f.label}
              <input type={f.type ?? 'text'} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className={`${input} pr-7`} />
              {values[f.key] && clearBtn(() => setValues({ ...values, [f.key]: '' }))}
            </label>
          ))}
          <label className="block text-xs text-gray-600">Genre
            <select value={gender} onChange={(e) => setGender(e.target.value as 'M' | 'F')} className={input}><option value="M">Homme</option><option value="F">Femme</option></select>
          </label>
        </div>
        {extra.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-gray-500">Colonnes du registre</p>
              <button onClick={() => setExtra(extra.map(([k]) => [k, '']))} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"><Eraser className="h-3.5 w-3.5" /> Tout vider</button>
            </div>
            <div className="space-y-2">
              {extra.map(([k, v], i) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-36 flex-shrink-0 truncate text-xs text-gray-500" title={k}>{k}</span>
                  <input value={v} onChange={(e) => setExtra(extra.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm" />
                  <button onClick={() => setExtra(extra.filter((_, j) => j !== i))} title="Retirer cette colonne du producteur" className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-md border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      </div>
      <div className="flex items-center gap-2 border-t border-gray-100 p-4">
        <button onClick={save} disabled={!!busy} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary-700 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </button>
        <button onClick={remove} disabled={!!busy} className="flex items-center gap-2 rounded-md border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
          {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer
        </button>
      </div>
    </div>
  )
}
