import { useEffect, useMemo, useState } from 'react'
import { traceApi, type Delivery, type Product } from '../../api/trace'
import { fr } from '../../utils/lotSheet'

type Props = { lotId?: string; product: Product; selected: Set<string>; onChange: (s: Set<string>) => void }

/** Choix des pesées qui composent un lot : pesées libres du même produit, plus celles déjà dans ce lot. */
export default function DeliveryPicker({ lotId, product, selected, onChange }: Props) {
  const [rows, setRows] = useState<Delivery[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    Promise.all([traceApi.deliveries({ free: true, product, page_size: 2000 }),
      lotId ? traceApi.deliveries({ lot: lotId, page_size: 2000 }) : Promise.resolve(null)])
      .then(([free, mine]) => setRows([...(mine?.data.results ?? []), ...free.data.results]))
      .catch(() => setRows([]))
  }, [lotId, product])
  const shown = useMemo(() => (rows ?? []).filter((d) => !q.trim() || `${d.number} ${d.producer_name} ${d.producer_code} ${d.village}`.toLowerCase().includes(q.trim().toLowerCase())), [rows, q])
  const chosen = (rows ?? []).filter((d) => selected.has(d.id))
  const toggle = (id: string) => { const s = new Set(selected); if (s.has(id)) s.delete(id); else s.add(id); onChange(s) }

  if (rows === null) return <p className="text-sm text-gray-500">Chargement des pesées…</p>
  if (!rows.length) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Aucune pesée libre pour ce produit : enregistrez les livraisons dans « Traçabilité des volumes », ou passez en saisie manuelle.</p>
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer : n° de fiche, producteur, village…" className="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
        <button type="button" onClick={() => onChange(new Set([...selected, ...shown.map((d) => d.id)]))} className="text-sm text-primary-700 hover:underline">Tout cocher</button>
        <button type="button" onClick={() => onChange(new Set())} className="text-sm text-gray-500 hover:underline">Tout décocher</button>
        <span className="ml-auto text-sm text-gray-700"><b>{chosen.length}</b> pesée(s) · <b>{fr(chosen.reduce((s, d) => s + Number(d.net_kg), 0))} kg</b> · {chosen.reduce((s, d) => s + d.bags, 0)} sac(s)</span>
      </div>
      <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500"><tr>{['', 'N° de fiche', 'Date', 'Producteur', 'Village', 'Sacs', 'Poids net'].map((h, i) => <th key={i} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((d) => (
              <tr key={d.id} onClick={() => toggle(d.id)} className={`cursor-pointer ${selected.has(d.id) ? 'bg-primary-50/60' : 'hover:bg-gray-50'}`}>
                <td className="px-3 py-1.5"><input type="checkbox" readOnly checked={selected.has(d.id)} aria-label={`Inclure ${d.number}`} /></td>
                <td className="px-3 py-1.5 font-mono text-xs">{d.number}</td><td className="px-3 py-1.5">{new Date(d.delivery_date).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-1.5">{d.producer_name}<span className="block text-xs text-gray-400">{d.producer_code}</span></td>
                <td className="px-3 py-1.5">{d.village}</td><td className="px-3 py-1.5 tabular-nums">{d.bags}</td>
                <td className="px-3 py-1.5 tabular-nums">{fr(Number(d.net_kg))} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
