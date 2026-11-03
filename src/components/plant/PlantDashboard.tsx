import { useEffect, useState } from 'react'
import { plantOpsApi, TRACE_MODES, type Operation, type PlantDashboard as Data } from '../../api/trace'
import { CHART } from '../../theme/tokens'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'
import { Kpi, MonthlyBars, Panel, RankBars, tonnes } from '../analytics/charts'

const OPS: { key: Operation; label: string }[] = [{ key: 'usinage', label: 'Usinage' }, { key: 'transformation', label: 'Transformation' }]
const pct = (v: number | null | undefined, digits = 1) => (v == null ? '—' : `${fr(v, digits)} %`)

/** Tableau de bord d'une usine sur 12 mois : réceptions, qualité, écarts, rendements, expéditions. */
export default function PlantDashboard({ plant }: { plant?: string }) {
  const [d, setD] = useState<Data | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { plantOpsApi.dashboard(plant).then(({ data }) => setD(data)).catch((e) => setError(apiErrorMessage(e))) }, [plant])

  if (error) return <p role="alert" className="text-sm text-danger-text">{error}</p>
  if (!d) return <p className="text-sm text-gray-500">Chargement du tableau de bord…</p>
  const r = d.receptions
  const gapAlert = r.gap_pct != null && Math.abs(r.gap_pct) > d.plant.gap_alert_pct
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Reçu sur 12 mois" value={tonnes(r.received_kg)} hint={`${r.trucks} camion(s)`} />
        <Kpi label="Écart de transport" value={pct(r.gap_pct, 2)} tone={gapAlert ? 'danger' : undefined}
          hint={`${r.over_threshold} camion(s) au-delà de ${fr(d.plant.gap_alert_pct)} %`} />
        <Kpi label="Refus · réserves" value={`${r.refused} · ${r.with_reserves}`} tone={r.refused ? 'warning' : undefined}
          hint={`humidité moyenne ${pct(r.avg_moisture_pct)}`} />
        <Kpi label="Expéditions" value={`${d.shipments.shipped} / ${d.shipments.count}`}
          hint={`${d.shipments.with_dds} avec référence DDS`} tone={d.shipments.count > d.shipments.with_dds ? 'warning' : undefined} />
      </div>
      <Panel title="Cacao reçu et expédié par mois" subtitle="Poids à l'arrivée des camions acceptés, et produits expédiés">
        <MonthlyBars data={d.monthly} series={[{ key: 'received_kg', label: 'Reçu', color: CHART.received },
          { key: 'shipped_kg', label: 'Expédié', color: CHART.shipped }]} />
      </Panel>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Réceptions par coopérative" subtitle="12 derniers mois">
          <RankBars rows={d.by_cooperative.map((c) => ({ label: c.name, detail: `${c.trucks} camion(s)`, value: c.received_kg }))}
            empty="Aucune réception enregistrée." />
        </Panel>
        <Panel title="Rendement matière" subtitle={`Perte signalée au-delà de ${fr(d.plant.loss_alert_pct)} % · mode ${TRACE_MODES[d.plant.traceability_mode].label.toLowerCase()}`}>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500"><tr>{['Opération', 'Lots', 'Entré', 'Obtenu', 'Perte'].map((h) => <th key={h} className="py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {OPS.map(({ key, label }) => {
                const o = d.processing[key]
                return (
                  <tr key={key}>
                    <td className="py-2">{label}</td><td className="py-2 tabular-nums">{o.batches}</td>
                    <td className="py-2 tabular-nums">{tonnes(o.input_kg)}</td><td className="py-2 tabular-nums">{tonnes(o.output_kg)}</td>
                    <td className={`py-2 tabular-nums ${o.loss_pct != null && o.loss_pct > d.plant.loss_alert_pct ? 'font-semibold text-danger-text' : ''}`}>{pct(o.loss_pct)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {([['Humidité moyenne', r.avg_moisture_pct], ['Moisies', r.avg_mouldy_pct], ['Ardoisées', r.avg_slaty_pct]] as const).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 p-2"><dt className="text-xs text-gray-500">{k}</dt><dd className="font-semibold tabular-nums">{pct(v)}</dd></div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  )
}
