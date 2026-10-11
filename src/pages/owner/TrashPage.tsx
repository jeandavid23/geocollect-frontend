import { useEffect, useState } from 'react'
import { Trash2, RotateCcw, Clock, Loader2, Inbox } from 'lucide-react'
import Header from '../../components/layout/Header'
import Button from '../../components/ui/Button'
import { alertDialog, confirmDialog } from '../../components/ui/dialog'
import { trashApi, type TrashItem } from '../../api/platform'
import { useAppStore } from '../../store/appStore'
import { apiErrorMessage } from '../../utils/retry'

const ROLE: Record<string, string> = { owner: 'Super Super Admin', super_admin: 'Super admin', cooperative: 'Coopérative', agent: 'Agent' }
const LABELS: [string, string][] = [
  ['cooperatives', 'coopérative(s)'], ['accounts', 'compte(s)'], ['producers', 'producteur(s)'], ['parcels', 'parcelle(s)'],
  ['legacy_polygons', 'ancien(s) polygone(s)'], ['registry_sheets', 'feuille(s) de registre'], ['lots', 'lot(s)'], ['reports', 'rapport(s)'],
]
const daysLeft = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000))

/** Corbeille du propriétaire : comptes supprimés depuis moins de 30 jours, restaurables avec toutes leurs données. */
export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = () => trashApi.list().then(({ data }) => setItems(data)).catch((e) => setError(apiErrorMessage(e)))
  useEffect(() => { load() }, [])

  const restore = async (t: TrashItem) => {
    if (!(await confirmDialog({ title: `Restaurer ${t.label} ?`, message: 'Le compte et toutes ses données reviennent dans l’état du moment de la suppression.', details: summary(t), confirmLabel: 'Restaurer' }))) return
    setBusy(t.id)
    try {
      const { data } = await trashApi.restore(t.id)
      useAppStore.getState().refreshData()
      await alertDialog({ tone: 'success', title: 'Restauration terminée', message: data.detail })
      load()
    } catch (e) { await alertDialog({ tone: 'danger', title: 'Restauration impossible', message: apiErrorMessage(e) }) } finally { setBusy(null) }
  }
  const erase = async (t: TrashItem) => {
    if (!(await confirmDialog({ tone: 'danger', title: `Effacer définitivement ${t.label} ?`, message: 'La copie est supprimée tout de suite : plus aucune restauration possible.', confirmLabel: 'Effacer définitivement', requireText: 'EFFACER' }))) return
    setBusy(t.id)
    try { await trashApi.erase(t.id); load() } catch (e) { await alertDialog({ tone: 'danger', title: 'Action impossible', message: apiErrorMessage(e) }) } finally { setBusy(null) }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Corbeille" subtitle="Comptes supprimés depuis moins de 30 jours — restaurables avec toutes leurs données" />
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Une suppression efface immédiatement le compte et ses données de la plateforme. Une copie compressée reste ici 30 jours, puis est effacée automatiquement, fichiers compris.
      </p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!items && !error && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>}
      {items?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center text-sm text-gray-500">
          <Inbox className="h-9 w-9 text-gray-300" /> La corbeille est vide.
        </div>
      )}
      <ul className="space-y-3">
        {items?.map((t) => (
          <li key={t.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{t.label}</p>
                <p className="text-xs text-gray-500">{ROLE[t.role] ?? t.role} · {t.username} · supprimé le {new Date(t.deleted_at).toLocaleString('fr-FR')}{t.deleted_by ? ` par ${t.deleted_by}` : ''}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {summary(t).map((s) => <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{s}</span>)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 text-xs ${daysLeft(t.expires_at) <= 3 ? 'text-red-600' : 'text-gray-500'}`}><Clock className="h-3.5 w-3.5" /> {daysLeft(t.expires_at)} j</span>
                <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />} loading={busy === t.id} onClick={() => restore(t)}>Restaurer</Button>
                <Button size="icon" variant="ghost" label="Effacer définitivement" icon={<Trash2 className="h-4 w-4 text-red-600" />} disabled={busy === t.id} onClick={() => erase(t)} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function summary(t: TrashItem) {
  const out = LABELS.filter(([k]) => Number(t.summary[k]) > 0).map(([k, l]) => `${Number(t.summary[k]).toLocaleString('fr-FR')} ${l}`)
  if (t.summary.cooperative_names?.length) out.unshift(t.summary.cooperative_names.join(', '))
  return out
}
