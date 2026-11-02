import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, Scale, Search, XCircle } from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { promptDialog } from '../ui/dialog'
import { useAppStore } from '../../store/appStore'
import { PRODUCT_LABEL } from '../../api/lots'
import { computeWeights, traceApi, type Delivery, type DeliveryPayload, type Product } from '../../api/trace'
import { deliveryPdf } from '../../utils/traceSheets'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'

const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
const savedWeigher = () => { try { return localStorage.getItem('gc-weigher') ?? '' } catch { return '' } }
const num = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))

type Props = { campaign: string }

function DeliveryForm({ campaign, onSaved }: Props & { onSaved: (d: Delivery) => void }) {
  const { producers } = useAppStore()
  const [q, setQ] = useState('')
  const [producer, setProducer] = useState<{ id: string; label: string } | null>(null)
  const [f, setF] = useState({ product: 'cacao' as Product, date: new Date().toISOString().slice(0, 10), point: '', bags: '', gross: '',
    tare: '', deduction: '', moisture: '', quality: '', price: '', weigher: savedWeigher() })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2 || producer) return []
    return producers.filter((p) => `${p.fullName} ${p.fieldIdBase} ${p.village}`.toLowerCase().includes(s)).slice(0, 8)
  }, [q, producers, producer])
  const w = computeWeights(num(f.gross) ?? 0, num(f.bags) ?? 0, num(f.tare), num(f.deduction) ?? 0, num(f.price))
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const save = async () => {
    if (!producer) { setError('Choisissez le producteur.'); return }
    setBusy(true); setError('')
    const body: DeliveryPayload = { producer: producer.id, campaign, product: f.product, delivery_date: f.date, collection_point: f.point,
      bags: num(f.bags) ?? 0, gross_kg: num(f.gross) ?? 0, tare_kg: num(f.tare), deduction_kg: num(f.deduction) ?? 0,
      moisture_pct: num(f.moisture), quality: f.quality, unit_price: num(f.price), weigher: f.weigher }
    try {
      const { data } = await traceApi.createDelivery(body)
      try { localStorage.setItem('gc-weigher', f.weigher) } catch { /* stockage indisponible */ }
      onSaved(data)
      setProducer(null); setQ(''); setF({ ...f, bags: '', gross: '', tare: '', deduction: '', moisture: '' })
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="flex items-center gap-2 font-semibold text-gray-900"><Scale className="h-5 w-5 text-primary-700" /> Nouvelle pesée</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="relative col-span-2">
          <label className="text-xs text-gray-600">Producteur
            <input value={producer ? producer.label : q} onChange={(e) => { setProducer(null); setQ(e.target.value) }} className={input} placeholder="Nom, code ou village…" />
          </label>
          {matches.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
              {matches.map((p) => (
                <button key={p.id} type="button" onClick={() => setProducer({ id: p.id, label: `${p.fullName} · ${p.fieldIdBase}` })}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">{p.fullName} <span className="text-gray-500">· {p.fieldIdBase} · {p.village}</span></button>
              ))}
            </div>
          )}
        </div>
        <label className="text-xs text-gray-600">Produit<select value={f.product} onChange={set('product')} className={input}>{Object.entries(PRODUCT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-xs text-gray-600">Date<input type="date" value={f.date} onChange={set('date')} className={input} /></label>
        <label className="text-xs text-gray-600">Nombre de sacs<input inputMode="numeric" value={f.bags} onChange={set('bags')} className={input} /></label>
        <label className="text-xs text-gray-600">Poids brut (kg)<input inputMode="decimal" value={f.gross} onChange={set('gross')} className={input} /></label>
        <label className="text-xs text-gray-600">Tare des sacs (kg)<input inputMode="decimal" value={f.tare} onChange={set('tare')} className={input} placeholder={`${w.tare} (1 kg/sac)`} /></label>
        <label className="text-xs text-gray-600">Réfaction (kg)<input inputMode="decimal" value={f.deduction} onChange={set('deduction')} className={input} placeholder="humidité, déchets" /></label>
        <label className="text-xs text-gray-600">Humidité (%)<input inputMode="decimal" value={f.moisture} onChange={set('moisture')} className={input} /></label>
        <label className="text-xs text-gray-600">Qualité / grade<input value={f.quality} onChange={set('quality')} className={input} /></label>
        <label className="text-xs text-gray-600">Prix (FCFA/kg)<input inputMode="numeric" value={f.price} onChange={set('price')} className={input} /></label>
        <label className="text-xs text-gray-600">Point de collecte<input value={f.point} onChange={set('point')} className={input} placeholder="Magasin, village…" /></label>
        <label className="text-xs text-gray-600">Peseur<input value={f.weigher} onChange={set('weigher')} className={input} /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-primary-50 px-4 py-3">
        <p className="text-sm text-primary-900">Poids net : <b className="text-lg tabular-nums">{w.net > 0 ? `${fr(w.net)} kg` : '—'}</b></p>
        <p className="text-sm text-primary-900">Montant : <b className="tabular-nums">{w.amount && w.net > 0 ? `${fr(w.amount, 0)} FCFA` : '—'}</b></p>
        <span className="flex-1" />
        <Button onClick={save} loading={busy} disabledReason={!producer ? 'Choisissez le producteur' : w.net <= 0 ? 'Poids net nul' : undefined}>Enregistrer la pesée</Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  )
}

export default function DeliveriesTab({ campaign }: Props) {
  const { addNotification } = useAppStore()
  const [rows, setRows] = useState<Delivery[] | null>(null)
  const [count, setCount] = useState(0)
  const [q, setQ] = useState('')
  const load = useCallback(() => traceApi.deliveries({ campaign, q: q.trim() || undefined })
    .then(({ data }) => { setRows(data.results); setCount(data.count) }).catch(() => setRows([])), [campaign, q])
  useEffect(() => { const h = setTimeout(load, 300); return () => clearTimeout(h) }, [load])

  const cancel = async (d: Delivery) => {
    const reason = await promptDialog({ title: `Annuler la pesée ${d.number} ?`, label: 'Motif (obligatoire, reste dans l’historique)',
      confirmLabel: 'Annuler la pesée', validate: (v) => (v.trim() ? null : 'Indiquez le motif.') })
    if (!reason) return
    try { await traceApi.cancelDelivery(d.id, reason); load() }
    catch (err) { addNotification({ type: 'error', title: 'Annulation impossible', message: apiErrorMessage(err) }) }
  }

  return (
    <div className="space-y-5">
      <DeliveryForm campaign={campaign} onSaved={(d) => { load(); addNotification({ type: 'success', title: `Pesée ${d.number} enregistrée`, message: `${fr(Number(d.net_kg))} kg net — fiche prête à imprimer.` }); deliveryPdf(d) }} />
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 p-3">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N° de fiche, producteur…" className="rounded-md border border-gray-200 py-1.5 pl-8 pr-2 text-sm" /></div>
          <span className="ml-auto text-xs text-gray-500">{count.toLocaleString('fr-FR')} pesée(s) · campagne {campaign}</span>
        </div>
        {rows === null ? <p className="p-6 text-sm text-gray-500">Chargement…</p> : rows.length === 0 ? (
          <EmptyState icon={<Scale className="h-7 w-7" />} title="Aucune pesée sur cette campagne"
            text="Chaque livraison d'un producteur est pesée et enregistrée ici. La fiche de pesée (deux exemplaires) sert de reçu ; les pesées forment ensuite les lots." />
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500"><tr>{['N° de fiche', 'Date', 'Producteur', 'Sacs', 'Brut', 'Net', 'Montant', 'Lot', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((d) => (
                  <tr key={d.id} className={d.status === 'annulee' ? 'text-gray-400 line-through' : ''}>
                    <td className="px-3 py-2 font-mono text-xs">{d.number}</td>
                    <td className="px-3 py-2">{new Date(d.delivery_date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2">{d.producer_name}<span className="block text-xs text-gray-400">{d.producer_code}</span></td>
                    <td className="px-3 py-2 tabular-nums">{d.bags}</td>
                    <td className="px-3 py-2 tabular-nums">{fr(Number(d.gross_kg))}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{fr(Number(d.net_kg))} kg</td>
                    <td className="px-3 py-2 tabular-nums">{d.amount ? `${fr(Number(d.amount), 0)} F` : '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.status === 'annulee' ? <span title={d.cancel_reason}>annulée</span> : d.lot_code ?? <span className="text-amber-700">à affecter</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Button size="icon" variant="ghost" label="Imprimer la fiche de pesée" icon={<Printer className="h-4 w-4" />} onClick={() => deliveryPdf(d)} />
                      {d.status === 'valide' && !d.lot && <Button size="icon" variant="ghost" label="Annuler la pesée (avec motif)" icon={<XCircle className="h-4 w-4" />} onClick={() => cancel(d)} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
