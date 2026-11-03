import { useEffect, useState } from 'react'
import { Plus, Ship, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import { plantOpsApi, type Shipment, type ShipmentDocs, type Shippable } from '../../api/trace'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'

const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
export const DOC_FIELDS: [keyof ShipmentDocs, string, string][] = [
  ['client', 'Client / acheteur *', 'Exportateur, chocolatier…'], ['destination_country', 'Pays de destination', 'Pays-Bas'],
  ['container', 'N° de conteneur', 'MSKU1234567'], ['seal', 'N° de plomb', ''], ['bill_of_lading', 'N° de connaissement', ''],
  ['vessel', 'Navire', ''], ['dds_reference', 'Référence DDS (TRACES)', 'Obligatoire pour expédier'],
  ['dds_verification', 'N° de vérification DDS', ''],
]

type Line = { key: string; source: string; weight: string; bags: string }
const lineKey = (s: Shippable) => `${s.batch}|${s.product}`
const blank = (): Line => ({ key: crypto.randomUUID(), source: '', weight: '', bags: '' })

/** Nouvelle expédition : produits finis pris sur les lots d'usinage (dans la limite du stock), et documents. */
export default function ShipmentForm({ plant, onSaved }: { plant?: string; onSaved: (s: Shipment) => void }) {
  const [stock, setStock] = useState<Shippable[] | null>(null)
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [shipDate, setShipDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<Line[]>([blank()])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { plantOpsApi.shippable(plant).then(({ data }) => setStock(data)).catch(() => setStock([])) }, [plant])

  const byKey = Object.fromEntries((stock ?? []).map((s) => [lineKey(s), s]))
  const setLine = (key: string, patch: Partial<Line>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const parsed = lines.filter((l) => l.source).map((l) => ({ ...l, kg: Number(l.weight.replace(',', '.')), item: byKey[l.source] }))
  const over = parsed.find((l) => l.kg > l.item.available_kg)
  const total = parsed.reduce((s, l) => s + (l.kg || 0), 0)
  const missing = !docs.client?.trim() ? 'Indiquez le client' : !parsed.length || parsed.some((l) => !(l.kg > 0)) ? 'Choisissez les produits et leur poids'
    : over ? `${over.item.batch_code} : ${fr(over.item.available_kg)} kg disponibles au plus` : undefined

  const save = async () => {
    setBusy(true); setError('')
    try {
      const { data } = await plantOpsApi.createShipment({
        ...Object.fromEntries(DOC_FIELDS.map(([k]) => [k, (docs[k] ?? '').trim()])), client: docs.client.trim(), ship_date: shipDate,
        items: parsed.map((l) => ({ batch: l.item.batch, product: l.item.product, weight_kg: l.kg, bags: Number(l.bags) || 0 })),
        ...(plant ? { plant } : {}) } as Parameters<typeof plantOpsApi.createShipment>[0])
      onSaved(data)
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }

  if (stock === null) return <p className="text-sm text-gray-500">Chargement des produits disponibles…</p>
  if (stock.length === 0) return <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">Aucun produit fini en stock : enregistrez d'abord un usinage.</p>
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 p-4">
      <p className="font-semibold text-gray-900">Nouvelle expédition</p>
      <div className="space-y-2">
        {lines.map((l) => {
          const item = byKey[l.source]
          return (
            <div key={l.key} className="grid grid-cols-12 items-end gap-2">
              <label className="col-span-12 text-xs text-gray-600 sm:col-span-6">Produit et lot d'usinage
                <select value={l.source} onChange={(e) => setLine(l.key, { source: e.target.value })} className={input}>
                  <option value="">Choisir…</option>
                  {stock.map((s) => <option key={lineKey(s)} value={lineKey(s)}>{s.product_label} — {s.batch_code} ({fr(s.available_kg)} kg{s.compliant_share_pct != null ? ` · ${fr(s.compliant_share_pct, 0)} % vérifié` : ''})</option>)}
                </select>
              </label>
              <label className="col-span-5 text-xs text-gray-600 sm:col-span-3">Poids (kg){item && <span className="text-gray-400"> · max {fr(item.available_kg)}</span>}
                <input inputMode="decimal" value={l.weight} onChange={(e) => setLine(l.key, { weight: e.target.value })} className={input} /></label>
              <label className="col-span-4 text-xs text-gray-600 sm:col-span-2">Sacs
                <input inputMode="numeric" value={l.bags} onChange={(e) => setLine(l.key, { bags: e.target.value })} className={input} /></label>
              <div className="col-span-3 sm:col-span-1">
                <Button size="icon" variant="ghost" label="Retirer la ligne" icon={<Trash2 className="h-4 w-4" />}
                  disabled={lines.length === 1} onClick={() => setLines(lines.filter((x) => x.key !== l.key))} />
              </div>
            </div>
          )
        })}
        <div className="flex items-center justify-between">
          <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setLines([...lines, blank()])}>Ajouter un produit</Button>
          <span className="text-sm tabular-nums text-gray-700">Total {fr(total)} kg</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <label className="text-xs text-gray-600">Date d'expédition *<input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className={input} /></label>
        {DOC_FIELDS.map(([k, label, ph]) => (
          <label key={k} className="text-xs text-gray-600">{label}<input value={docs[k] ?? ''} placeholder={ph} onChange={(e) => setDocs({ ...docs, [k]: e.target.value })} className={input} /></label>
        ))}
      </div>
      <p className="text-xs text-gray-500">La référence DDS peut être ajoutée plus tard ; elle est exigée pour marquer l'expédition comme partie.</p>
      {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
      <Button icon={<Ship className="h-4 w-4" />} loading={busy} disabledReason={missing} onClick={save}>Créer l'expédition</Button>
    </div>
  )
}
