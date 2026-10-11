import { useEffect, useState } from 'react'
import { Eye, Loader2, Search } from 'lucide-react'
import { compareApi, type CoopCompareRow } from '../../api/dashboard'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { useSort, SortTh } from '../ui/table'
import Button from '../ui/Button'
import { alertDialog } from '../ui/dialog'
import { apiErrorMessage } from '../../utils/retry'

const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('fr-FR'))

/** Tableau comparatif : une ligne par coopérative accessible ; « Ouvrir » = espace de la coopérative en lecture seule. */
export default function CoopCompare() {
  const role = useAuthStore((s) => s.user?.role)
  const [rows, setRows] = useState<CoopCompareRow[] | null>(null)
  const [q, setQ] = useState('')
  const [opening, setOpening] = useState('')
  useEffect(() => { compareApi.get().then(({ data }) => setRows(data.cooperatives)).catch(() => setRows([])) }, [])

  const filtered = (rows ?? []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.managed_by ?? '').toLowerCase().includes(q.toLowerCase()))
  const { sorted, sort, toggle } = useSort(filtered, {
    name: (r) => r.name, producers: (r) => r.producers, pct: (r) => r.mapped_pct, to_map: (r) => r.to_map, parcels: (r) => r.parcels,
    non: (r) => r.non_compliant, overlaps: (r) => r.overlaps ?? -1, illegal: (r) => r.illegal ?? -1, agents: (r) => r.agents, lots: (r) => r.lots_ready,
    last: (r) => (r.last_activity ? new Date(r.last_activity).getTime() : 0),
  }, 'compare')

  const open = async (r: CoopCompareRow) => {
    if (!r.coop_account_id) { await alertDialog({ title: 'Aucun compte coopérative', message: `${r.name} n'a pas encore de compte de connexion.` }); return }
    setOpening(r.id)
    try {
      useAppStore.getState().clearData()
      await useAuthStore.getState().startImpersonation(r.coop_account_id)
      window.location.replace('/coop')
    } catch (e) { await alertDialog({ tone: 'danger', title: 'Ouverture impossible', message: apiErrorMessage(e) }) } finally { setOpening('') }
  }

  const pctColor = (p: number) => (p >= 80 ? 'bg-green-500' : p >= 40 ? 'bg-amber-400' : 'bg-red-400')
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <p className="font-semibold text-gray-900">Comparatif des coopératives</p>
          <p className="text-xs text-gray-500">Triez par colonne · « Ouvrir » affiche l'espace de la coopérative en lecture seule</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Coopérative…" className="rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-xs" />
        </div>
      </div>
      {rows === null ? <p className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <SortTh label="Coopérative" k="name" sort={sort} onSort={toggle} />
                <SortTh label="Producteurs" k="producers" sort={sort} onSort={toggle} />
                <SortTh label="Cartographiés" k="pct" sort={sort} onSort={toggle} />
                <SortTh label="À mapper" k="to_map" sort={sort} onSort={toggle} />
                <SortTh label="Parcelles" k="parcels" sort={sort} onSort={toggle} />
                <SortTh label="Non conformes" k="non" sort={sort} onSort={toggle} />
                <SortTh label="Chevauch." k="overlaps" sort={sort} onSort={toggle} />
                <SortTh label="Forêt classée" k="illegal" sort={sort} onSort={toggle} />
                <SortTh label="Agents" k="agents" sort={sort} onSort={toggle} />
                <SortTh label="Lots validés" k="lots" sort={sort} onSort={toggle} />
                <SortTh label="Dernière activité" k="last" sort={sort} onSort={toggle} />
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5">
                    <p className="font-medium text-gray-900">{r.name}{!r.is_active && <span className="ml-2 rounded bg-gray-100 px-1.5 text-[10px] text-gray-500">désactivée</span>}</p>
                    {role === 'owner' && r.managed_by && <p className="text-[11px] text-gray-500">{r.managed_by}</p>}
                  </td>
                  <td className="px-5 py-2.5 tabular-nums">{n(r.producers)}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${pctColor(r.mapped_pct)}`} style={{ width: `${r.mapped_pct}%` }} /></div><span className="tabular-nums text-xs">{r.mapped_pct} %</span></div>
                  </td>
                  <td className="px-5 py-2.5 tabular-nums">{n(r.to_map)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{n(r.parcels)}</td>
                  <td className={`px-5 py-2.5 tabular-nums ${r.non_compliant ? 'font-semibold text-red-700' : ''}`}>{n(r.non_compliant)}</td>
                  <td className={`px-5 py-2.5 tabular-nums ${r.overlaps ? 'font-semibold text-amber-700' : ''}`} title={r.overlaps === null ? 'Contrôle pas encore lancé (tableau de bord de la coopérative)' : undefined}>{n(r.overlaps)}</td>
                  <td className={`px-5 py-2.5 tabular-nums ${r.illegal ? 'font-semibold text-red-700' : ''}`}>{n(r.illegal)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{n(r.agents)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{n(r.lots_ready)}</td>
                  <td className="px-5 py-2.5 text-xs text-gray-500">{r.last_activity ? new Date(r.last_activity).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-5 py-2.5"><Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} loading={opening === r.id} onClick={() => open(r)}>Ouvrir</Button></td>
                </tr>
              ))}
              {sorted.length === 0 && <tr><td colSpan={12} className="px-5 py-8 text-center text-sm text-gray-500">Aucune coopérative.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
