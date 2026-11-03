import { useEffect, useState } from 'react'
import { FileSpreadsheet, Package, Truck, Warehouse } from 'lucide-react'
import Button from '../ui/Button'
import { OPERATION_LABEL, OUTPUT_PRODUCTS, plantOpsApi, type PlantStock as Data } from '../../api/trace'
import { exportExcel } from '../../utils/featureExport'
import { date, fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'
import { Kpi, Panel, tonnes } from '../analytics/charts'

const OLD_DAYS = 30            // au-delà, le stock vieillit en magasin (risque de dégradation)

const age = (days: number | null) => (days == null ? '—' : (
  <span className={days > OLD_DAYS ? 'font-semibold text-warning-text' : ''}>{days} j</span>))

/** Stock de l'usine : camions en route, cacao reçu non usiné, produits finis non expédiés, avec l'ancienneté. */
export default function PlantStock({ plant }: { plant?: string }) {
  const [s, setS] = useState<Data | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { plantOpsApi.stock(plant).then(({ data }) => setS(data)).catch((e) => setError(apiErrorMessage(e))) }, [plant])

  if (error) return <p role="alert" className="text-sm text-danger-text">{error}</p>
  if (!s) return <p className="text-sm text-gray-500">Chargement du stock…</p>
  const excel = () => exportExcel([
    { name: 'En route', rows: s.on_the_way.map((r) => ({ fiche: r.slip, lot: r.lot, cooperative: r.cooperative, emise_le: r.issued_at.slice(0, 10), camion: r.vehicle_plate, poids_kg: r.weight_kg })) },
    { name: 'Cacao reçu', rows: s.raw.map((r) => ({ lot: r.lot, cooperative: r.cooperative, fiche: r.slip, recu_le: r.received_at?.slice(0, 10), jours: r.days, disponible_kg: r.available_kg })) },
    { name: 'Produits finis', rows: s.finished.map((r) => ({ lot_usinage: r.batch, operation: OPERATION_LABEL[r.operation], date: r.process_date, jours: r.days, produits: r.products.map((p) => OUTPUT_PRODUCTS[p]).join(', '), disponible_kg: r.available_kg })) },
  ], `stock_usine_${new Date().toISOString().slice(0, 10)}.xlsx`)
  const th = 'px-3 py-2 text-left font-medium'
  const td = 'px-3 py-2'
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="En route" value={tonnes(s.totals.on_the_way_kg)} hint={`${s.on_the_way.length} camion(s) annoncé(s)`} />
        <Kpi label="Cacao reçu à usiner" value={tonnes(s.totals.raw_kg)} hint={`${s.raw.length} lot(s)`}
          tone={s.raw.some((r) => (r.days ?? 0) > OLD_DAYS) ? 'warning' : undefined} />
        <Kpi label="Produits finis à expédier" value={tonnes(s.totals.finished_kg)} hint={`${s.finished.length} lot(s) d'usinage`} />
      </div>
      <div className="flex justify-end"><Button size="sm" variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={excel}>Exporter le stock (Excel)</Button></div>
      <Panel title="Cacao reçu, en attente d'usinage" subtitle={`Ancienneté depuis la réception ; au-delà de ${OLD_DAYS} jours, elle est signalée`}
        action={<Warehouse className="h-5 w-5 text-gray-400" />}>
        {s.raw.length === 0 ? <p className="text-sm text-gray-500">Aucun cacao en attente.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Lot', 'Coopérative', 'Fiche', 'Reçu le', 'Ancienneté', 'Disponible'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{s.raw.map((r) => (
              <tr key={r.lot_id}><td className={`${td} font-mono text-xs`}>{r.lot}</td><td className={td}>{r.cooperative}</td>
                <td className={`${td} font-mono text-xs`}>{r.slip}</td><td className={td}>{r.received_at ? date(r.received_at) : '—'}</td>
                <td className={`${td} tabular-nums`}>{age(r.days)}</td><td className={`${td} tabular-nums`}>{fr(r.available_kg)} kg</td></tr>))}
            </tbody></table></div>)}
      </Panel>
      <Panel title="Produits finis, en attente d'expédition" action={<Package className="h-5 w-5 text-gray-400" />}>
        {s.finished.length === 0 ? <p className="text-sm text-gray-500">Aucun produit en stock.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr>{["Lot d'usinage", 'Opération', 'Produits', 'Date', 'Ancienneté', 'Disponible'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{s.finished.map((r) => (
              <tr key={r.batch_id}><td className={`${td} font-mono text-xs`}>{r.batch}</td><td className={td}>{OPERATION_LABEL[r.operation]}</td>
                <td className={td}>{r.products.map((p) => OUTPUT_PRODUCTS[p]).join(', ')}</td><td className={td}>{date(r.process_date)}</td>
                <td className={`${td} tabular-nums`}>{age(r.days)}</td><td className={`${td} tabular-nums`}>{fr(r.available_kg)} kg</td></tr>))}
            </tbody></table></div>)}
      </Panel>
      <Panel title="Camions en route" action={<Truck className="h-5 w-5 text-gray-400" />}>
        {s.on_the_way.length === 0 ? <p className="text-sm text-gray-500">Aucun camion annoncé.</p> : (
          <ul className="divide-y divide-gray-100 text-sm">{s.on_the_way.map((r) => (
            <li key={r.slip} className="flex flex-wrap justify-between gap-2 py-2">
              <span><span className="font-mono text-xs">{r.slip}</span> · {r.cooperative} · lot {r.lot} · {r.vehicle_plate}</span>
              <span className="tabular-nums text-gray-700">{fr(r.weight_kg)} kg · parti le {date(r.issued_at)}</span></li>))}
          </ul>)}
      </Panel>
    </div>
  )
}
