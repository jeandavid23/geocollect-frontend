import { useEffect, useState } from 'react'
import { X, Hash, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { producersApi, type RecodeReport, type MatchStats } from '../../api/producers'
import { useAppStore } from '../../store/appStore'
import { apiErrorMessage } from '../../utils/retry'

/** Remplace les codes générés (PROD…) par le code producteur du registre, puis recroise les anciens polygones. */
export default function ProducerRecodeModal({ cooperativeId, onClose }: { cooperativeId: string; onClose: () => void }) {
  const addNotification = useAppStore((s) => s.addNotification)
  const [columns, setColumns] = useState<{ name: string; filled: number }[]>([])
  const [column, setColumn] = useState('')
  const [report, setReport] = useState<RecodeReport | null>(null)
  const [match, setMatch] = useState<MatchStats | null>(null)
  const [busy, setBusy] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    producersApi.recodeInfo(cooperativeId).then(({ data }) => {
      setColumns(data.columns); setColumn(data.suggested ?? ''); setReport(data.preview)
    }).catch((e) => addNotification({ type: 'error', title: 'Codes du registre', message: apiErrorMessage(e) }))
      .finally(() => setBusy(false))
  }, [cooperativeId, addNotification])

  const simulate = async (col: string) => {
    setColumn(col); setReport(null); setDone(false); if (!col) return
    setBusy(true)
    try { setReport((await producersApi.recode(col, false, cooperativeId)).data) }
    catch (e) { addNotification({ type: 'error', title: 'Simulation impossible', message: apiErrorMessage(e) }) }
    finally { setBusy(false) }
  }

  const apply = async () => {
    setBusy(true)
    try {
      const { data } = await producersApi.recode(column, true, cooperativeId)
      setReport(data); setMatch(data.match ?? null); setDone(true)
      addNotification({ type: 'success', title: 'Codes du registre appliqués', message: `${data.recoded} producteur(s) recodé(s), polygones recroisés.` })
      useAppStore.getState().refreshData()
    } catch (e) { addNotification({ type: 'error', title: 'Recodage impossible', message: apiErrorMessage(e) }) }
    finally { setBusy(false) }
  }

  const n = (v: number) => v.toLocaleString('fr-FR')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Hash className="mt-0.5 h-5 w-5 text-primary-700" />
            <div>
              <h2 className="font-semibold text-gray-900">Codes producteurs du registre</h2>
              <p className="text-sm text-gray-500">Chaque producteur reprend le code de son registre (aucun code n'est généré). Les anciens polygones sont ensuite recroisés sur ce code.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <label className="block text-xs text-gray-600">Colonne du registre qui contient le code producteur
          <select value={column} disabled={busy || done} onChange={(e) => simulate(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">— Choisir une colonne —</option>
            {columns.map((c) => <option key={c.name} value={c.name}>{c.name} ({n(c.filled)} remplies)</option>)}
          </select>
        </label>

        {busy && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Traitement…</p>}

        {report && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[['Producteurs', report.producers], [done ? 'Recodés' : 'À recoder', report.recoded], ['Sans code', report.without_code], ['Codes en double', report.duplicates]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-semibold tabular-nums">{n(v as number)}</p></div>
              ))}
            </div>
            {report.sample.length > 0 && (
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500"><tr><th className="px-3 py-1.5 text-left font-medium">Code actuel</th><th className="px-3 py-1.5 text-left font-medium">Code du registre</th></tr></thead>
                <tbody className="divide-y divide-gray-100 font-mono">{report.sample.map((s, i) => <tr key={i}><td className="px-3 py-1">{s.avant}</td><td className="px-3 py-1">{s.apres}</td></tr>)}</tbody>
              </table>
            )}
            {(report.duplicates > 0 || report.without_code > 0 || report.conflicts > 0) && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  Les producteurs sans code dans cette colonne gardent leur code actuel.
                  {report.duplicates > 0 && <> Un même code apparaît sur plusieurs lignes ({report.duplicate_codes.slice(0, 5).join(', ')}{report.duplicates > 5 ? '…' : ''}) : seule la première ligne le reçoit, corrigez les autres dans le registre.</>}
                  {report.conflicts > 0 && <> {report.conflicts} code(s) déjà porté(s) par un autre producteur non recodé : laissés tels quels.</>}
                </span>
              </p>
            )}
            {done && match && (
              <p className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{n(match.mapped_producers)} producteur(s) ont déjà leur polygone · {n(match.to_map)} nouveau(x) producteur(s) à mapper par les agents · {n(match.linked_polygons)}/{n(match.legacy_polygons)} anciens polygones rattachés{match.polygons_without_code ? ` · ${n(match.polygons_without_code)} polygone(s) sans code (réimportez le .shp avec son .dbf)` : ''}.</span>
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm">{done ? 'Fermer' : 'Annuler'}</button>
          {!done && <button onClick={apply} disabled={busy || !column || !report?.recoded}
            className="rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40">
            Appliquer ({report ? n(report.recoded) : 0})
          </button>}
        </div>
      </div>
    </div>
  )
}
