import { ChevronRight, Factory, MapPin, Package, Scale, Truck, Users } from 'lucide-react'
import { OPERATION_LABEL, type Trace } from '../../api/trace'
import { fr } from '../../utils/lotSheet'

type Step = { icon: React.ReactNode; title: string; value: string; detail: string; tone?: string }

/** Chaîne de traçabilité, de l'origine (producteurs, parcelles) jusqu'à l'usine. */
export default function TraceChain({ trace: tr }: { trace: Trace }) {
  const received = tr.transport.filter((s) => s.received_weight_kg != null)
  const delivered = tr.deliveries.reduce((s, d) => s + d.net_kg, 0)
  const steps: Step[] = [
    { icon: <MapPin className="h-5 w-5" />, title: 'Parcelles', value: `${tr.eudr.parcels}`, detail: `${fr(tr.eudr.area_ha, 2)} ha · ${tr.eudr.non_compliant_parcels ? `${tr.eudr.non_compliant_parcels} non conforme(s)` : 'conformes EUDR'}`,
      tone: tr.eudr.non_compliant_parcels ? 'border-red-300 bg-red-50' : undefined },
    { icon: <Users className="h-5 w-5" />, title: 'Producteurs', value: `${tr.producers.length}`, detail: tr.producers.slice(0, 2).map((p) => p.name).join(', ') + (tr.producers.length > 2 ? '…' : '') },
    { icon: <Scale className="h-5 w-5" />, title: 'Pesées', value: `${tr.deliveries.length}`, detail: `${fr(delivered, 0)} kg net` },
    { icon: <Package className="h-5 w-5" />, title: 'Lots coopérative', value: `${tr.lots.length}`, detail: tr.lots.map((l) => l.code).join(', ') },
    { icon: <Truck className="h-5 w-5" />, title: 'Transport', value: `${tr.transport.length}`, detail: `${received.length} réception(s) pesée(s)` },
    { icon: <Factory className="h-5 w-5" />, title: 'Usine', value: `${tr.batches.length}`, detail: [...tr.batches].reverse().map((b) => `${OPERATION_LABEL[b.operation]} ${b.code}`).join(' → ') },
  ]
  return (
    <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
      <div>
        <p className="font-semibold text-gray-900">Chaîne de traçabilité</p>
        <p className="text-sm text-gray-500">De la parcelle à l'usine : chaque étape est reliée à la précédente par un document (fiche de pesée, fiche de lot, fiche d'accompagnement, lot d'usinage).</p>
      </div>
      <ol className="flex flex-wrap items-stretch gap-1">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-1">
            <div className={`w-40 rounded-xl border p-3 ${s.tone ?? 'border-gray-200 bg-gray-50'}`}>
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600">{s.icon}{s.title}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{s.value}</p>
              <p className="truncate text-xs text-gray-500" title={s.detail}>{s.detail}</p>
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden />}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="max-h-80 overflow-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500"><tr>{['Producteur', 'Village', 'Lots', 'Poids livré'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {tr.producers.map((p) => (
                <tr key={p.producer}><td className="px-3 py-1.5">{p.name}<span className="block text-xs text-gray-400">{p.code}</span></td>
                  <td className="px-3 py-1.5">{p.village}</td><td className="px-3 py-1.5 font-mono text-xs">{[...new Set(p.lots)].join(', ')}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fr(p.weight_kg)} kg</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="max-h-80 overflow-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500"><tr>{['Parcelle', 'Village', 'Surface', 'EUDR'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {tr.parcels.map((p) => (
                <tr key={p.field_id}><td className="px-3 py-1.5 font-mono text-xs">{p.field_id}</td><td className="px-3 py-1.5">{p.village}</td>
                  <td className="px-3 py-1.5 tabular-nums">{fr(p.area_hectares || 0, 2)} ha</td>
                  <td className="px-3 py-1.5"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${p.eudr_status === 'compliant' ? 'bg-primary-50 text-primary-800' : p.eudr_status === 'non_compliant' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                    {p.eudr_status === 'compliant' ? 'Conforme' : p.eudr_status === 'non_compliant' ? 'Non conforme' : 'En attente'}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
