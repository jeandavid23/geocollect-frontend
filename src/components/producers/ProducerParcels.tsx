import { useEffect, useState } from 'react'
import { producersApi, type ProducerParcels as Data } from '../../api/producers'
import { fr } from '../../utils/lotSheet'

const EUDR: Record<string, string> = { compliant: 'conforme', non_compliant: 'non conforme', pending: 'en attente' }

/** Parcelles du registre d'un producteur (code parcelle) et polygones rattachés à chacune. */
export default function ProducerParcels({ producerId }: { producerId: string }) {
  const [d, setD] = useState<Data | null>(null)
  useEffect(() => { producersApi.parcels(producerId).then(({ data }) => setD(data)).catch(() => setD(null)) }, [producerId])
  if (!d) return null
  const empty = !d.registry_parcels.length && !d.unassigned_polygons.length && !d.mapped_parcels.length
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase text-gray-500">Parcelles du registre et polygones</p>
      {empty && <p className="text-sm text-gray-500">Aucune parcelle au registre et aucun polygone.</p>}
      {d.registry_parcels.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500"><tr>{['Code parcelle', 'Surface', 'Prod. estimée', 'Polygone'].map((h) => <th key={h} className="py-1 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {d.registry_parcels.map((p) => (
              <tr key={p.id}>
                <td className="py-1.5 font-mono text-xs">{p.parcel_code}</td>
                <td className="py-1.5 tabular-nums">{p.area_ha != null ? `${fr(p.area_ha, 2)} ha` : '—'}</td>
                <td className="py-1.5 tabular-nums">{p.estimated_production_kg != null ? `${fr(p.estimated_production_kg, 0)} kg` : '—'}</td>
                <td className="py-1.5">{p.polygons
                  ? <span className="rounded bg-success-bg px-1.5 py-0.5 text-xs font-semibold text-success-text">{p.polygons} · {fr(p.polygon_area_ha, 2)} ha</span>
                  : <span className="rounded bg-warning-bg px-1.5 py-0.5 text-xs font-semibold text-warning-text">aucun</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.unassigned_polygons.length > 0 && (
        <p className="mt-2 text-xs text-gray-600">{d.unassigned_polygons.length} polygone(s) rattaché(s) au producteur sans code parcelle du registre :{' '}
          {d.unassigned_polygons.slice(0, 6).map((p) => p.parcel_code || p.code || '—').join(', ')}{d.unassigned_polygons.length > 6 ? '…' : ''}</p>
      )}
      {d.mapped_parcels.length > 0 && (
        <p className="mt-2 text-xs text-gray-600">Cartographiées par les agents : {d.mapped_parcels.map((m) => `${m.field_id} (${EUDR[m.eudr_status] ?? m.eudr_status})`).join(', ')}</p>
      )}
    </div>
  )
}
