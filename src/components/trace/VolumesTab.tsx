import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Info } from 'lucide-react'
import Button from '../ui/Button'
import { SortTh, useSort } from '../ui/table'
import { AREA_SOURCE, traceApi, VOLUME_STATUS, type VolumeStatus, type Volumes } from '../../api/trace'
import { exportExcel } from '../../utils/featureExport'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'

const ORDER: Record<VolumeStatus, number> = { depassement: 0, a_surveiller: 1, sans_surface: 2, ok: 3 }

/** Volumes livrés par producteur sur la campagne, comparés à la capacité de ses parcelles (risque de mélange). */
export default function VolumesTab({ campaign }: { campaign: string }) {
  const [v, setV] = useState<Volumes | null>(null)
  const [error, setError] = useState('')
  const [only, setOnly] = useState<VolumeStatus | 'all'>('all')
  useEffect(() => { setV(null); traceApi.volumes(campaign).then(({ data }) => setV(data)).catch((e) => setError(apiErrorMessage(e))) }, [campaign])
  const rows = useMemo(() => (v?.producers ?? []).filter((p) => only === 'all' || p.status === only), [v, only])
  const { sorted, sort, toggle } = useSort(rows, {
    name: (p) => p.name, net: (p) => p.net_kg, area: (p) => p.area_ha, yld: (p) => p.yield_kg_ha ?? -1, status: (p) => ORDER[p.status],
  }, 'volumes')

  if (error) return <p className="text-sm text-red-700">{error}</p>
  if (!v) return <p className="text-sm text-gray-500">Chargement des volumes…</p>
  const t = v.totals
  const excel = () => exportExcel([{ name: 'Volumes', rows: v.producers.map((p) => ({
    producteur: p.name, code: p.code, village: p.village, pesees: p.deliveries, sacs: p.bags, poids_net_kg: p.net_kg,
    dans_les_lots_kg: p.in_lots_kg, hors_lot_kg: p.not_in_lot_kg, montant_fcfa: p.amount, surface_ha: p.area_ha,
    source_surface: AREA_SOURCE[p.area_source], rendement_kg_ha: p.yield_kg_ha, production_estimee_kg: p.estimated_kg,
    rendement_estime_kg_ha: p.estimated_yield_kg_ha, realisation_pct: p.realisation_pct, capacite_kg: p.capacity_kg,
    source_capacite: p.capacity_source === 'registre' ? 'production estimée (registre)' : 'surface × rendement maximal',
    statut: VOLUME_STATUS[p.status].label })) }],
  `volumes_${campaign}.xlsx`)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {([['Poids net livré', `${fr(t.net_kg, 0)} kg`, 'all'], ['Dans des lots', `${fr(t.in_lots_kg, 0)} kg`, 'all'],
          ['Hors lot', `${fr(t.not_in_lot_kg, 0)} kg`, 'all'], ['À surveiller', String(t.producers_to_watch), 'a_surveiller'],
          ['Dépassements', String(t.producers_over_capacity), 'depassement']] as const).map(([label, value, f]) => (
          <button key={label} onClick={() => setOnly(only === f ? 'all' : f)} className={`rounded-xl border bg-white p-3 text-left ${only === f && f !== 'all' ? 'ring-1 ring-primary-600' : ''}`}>
            <p className="text-xs text-gray-500">{label}</p><p className={`text-xl font-semibold tabular-nums ${f === 'depassement' && t.producers_over_capacity ? 'text-red-700' : ''}`}>{value}</p>
          </button>
        ))}
      </div>
      <p className="flex gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 flex-none" />
        <span>Chaque producteur ne peut livrer que ce que ses parcelles produisent. La référence est la <b>production totale estimée
          de l'année en cours</b> inscrite au registre ({t.producers_with_estimate} producteur(s) sur {t.producers}) : au-delà, le volume est{' '}
          <b>à surveiller</b> ; au-delà de {v.thresholds.estimate_tolerance_pct} % de plus, c'est un <b>dépassement</b>. Sans estimation au registre,
          la référence est la surface : au-delà de <b>{fr(v.thresholds.watch_kg_ha, 0)} kg/ha</b> à surveiller, de <b>{fr(v.thresholds.max_kg_ha, 0)} kg/ha</b>{' '}
          dépassement. Un dépassement signale du cacao d'une autre origine possiblement mélangé (le règlement EUDR exige que tout le cacao vienne
          de parcelles géolocalisées).</span>
      </p>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 p-3">
          <span className="text-xs text-gray-500">{sorted.length} producteur(s) · {t.deliveries} pesée(s)</span>
          <span className="flex-1" />
          <Button variant="secondary" size="sm" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={excel}>Excel</Button>
        </div>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500"><tr>
              <SortTh label="Producteur" k="name" sort={sort} onSort={toggle} /><th className="px-5 py-3 text-left font-medium">Pesées</th>
              <SortTh label="Poids net" k="net" sort={sort} onSort={toggle} /><th className="px-5 py-3 text-left font-medium">Hors lot</th>
              <SortTh label="Surface" k="area" sort={sort} onSort={toggle} /><SortTh label="Rendement" k="yld" sort={sort} onSort={toggle} />
              <th className="px-5 py-3 text-left font-medium">Utilisation de la capacité</th><SortTh label="Statut" k="status" sort={sort} onSort={toggle} />
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((p) => {
                const used = p.capacity_kg ? Math.min(100, (100 * p.net_kg) / p.capacity_kg) : 0
                return (
                  <tr key={p.producer}>
                    <td className="px-5 py-2">{p.name}<span className="block text-xs text-gray-400">{p.code} · {p.village}</span></td>
                    <td className="px-5 py-2 tabular-nums">{p.deliveries}</td>
                    <td className="px-5 py-2 font-semibold tabular-nums">{fr(p.net_kg, 0)} kg</td>
                    <td className="px-5 py-2 tabular-nums">{p.not_in_lot_kg ? `${fr(p.not_in_lot_kg, 0)} kg` : '—'}</td>
                    <td className="px-5 py-2 tabular-nums">{p.area_ha ? `${fr(p.area_ha, 2)} ha` : '—'}<span className="block text-xs text-gray-400">{AREA_SOURCE[p.area_source]}</span></td>
                    <td className="px-5 py-2 tabular-nums">{p.yield_kg_ha != null ? `${fr(p.yield_kg_ha, 0)} kg/ha` : '—'}
                      {p.estimated_yield_kg_ha != null && <span className="block text-xs text-gray-400">estimé {fr(p.estimated_yield_kg_ha, 0)} kg/ha</span>}</td>
                    <td className="px-5 py-2">
                      {p.capacity_kg ? (
                        <div className="w-40"><div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className={`h-full rounded-full ${p.status === 'depassement' ? 'bg-red-600' : p.status === 'a_surveiller' ? 'bg-amber-500' : 'bg-primary-600'}`} style={{ width: `${used}%` }} /></div>
                          <p className="mt-0.5 text-xs text-gray-500">{fr(p.net_kg, 0)} / {fr(p.capacity_kg, 0)} kg {p.capacity_source === 'registre' ? 'estimés (registre)' : 'possibles (surface)'}</p></div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${VOLUME_STATUS[p.status].tone}`}>{VOLUME_STATUS[p.status].label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
