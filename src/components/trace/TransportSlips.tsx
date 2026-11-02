import { useCallback, useEffect, useState } from 'react'
import { PackageCheck, Printer, Truck, XCircle } from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { promptDialog } from '../ui/dialog'
import { useAppStore } from '../../store/appStore'
import { lotsApi, type Lot } from '../../api/lots'
import { plantsApi, SLIP_STATUS, traceApi, type Plant, type TransportPayload, type TransportSlip } from '../../api/trace'
import { useAuthStore } from '../../store/authStore'
import { transportPdf } from '../../utils/traceSheets'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'

const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
const STATUS_TONE = { emise: 'bg-blue-50 text-blue-800', livree: 'bg-primary-50 text-primary-800', annulee: 'bg-gray-100 text-gray-500' }
const FIELDS: [keyof TransportPayload, string, string][] = [
  ['destination', 'Destination', 'Usine, port de San Pedro…'], ['consignee', 'Destinataire', 'Acheteur / exportateur'],
  ['origin', 'Lieu de départ', 'Magasin de la coopérative'], ['carrier', 'Transporteur', ''],
  ['vehicle_plate', 'Immatriculation du camion', ''], ['trailer_plate', 'Remorque', ''],
  ['driver_name', 'Chauffeur', ''], ['driver_phone', 'Téléphone du chauffeur', ''], ['driver_licence', 'N° de permis', ''],
  ['seals', 'N° de plombs / scellés', 'S-001, S-002'],
]

function SlipForm({ lot, onSaved }: { lot: Lot; onSaved: (s: TransportSlip) => void }) {
  const [f, setF] = useState<Record<string, string>>({ destination: lot.destination, consignee: lot.buyer, origin: lot.warehouse,
    bags: String(lot.bags || ''), gross: String(lot.gross_weight_kg ?? lot.checks?.net_weight_kg ?? '') })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [plants, setPlants] = useState<Plant[]>([])
  const [plant, setPlant] = useState('')
  useEffect(() => { plantsApi.list().then(({ data }) => setPlants(data)).catch(() => setPlants([])) }, [])
  const save = async () => {
    setBusy(true); setError('')
    try {
      const body = { ...Object.fromEntries(FIELDS.map(([k]) => [k, (f[k] ?? '').trim()])), lot: lot.id, notes: f.notes ?? '',
        bags: Number(f.bags) || 0, gross_weight_kg: Number((f.gross ?? '').replace(',', '.')), plant: plant || null } as TransportPayload
      const { data } = await traceApi.createSlip(body)
      onSaved(data)
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">Nouvelle fiche d'accompagnement</p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        {plants.length > 0 && (
          <label className="text-xs text-gray-600 md:col-span-3">Usine destinataire (elle reçoit la fiche et enregistre la réception dans GeoCollect)
            <select value={plant} onChange={(e) => setPlant(e.target.value)} className={input}>
              <option value="">Autre destination (saisie libre)</option>{plants.map((p) => <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ''}</option>)}
            </select>
          </label>
        )}
        {FIELDS.filter(([k]) => !(plant && k === 'destination')).map(([k, label, ph]) => (
          <label key={k} className="text-xs text-gray-600">{label}<input value={f[k] ?? ''} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input} /></label>
        ))}
        <label className="text-xs text-gray-600">Nombre de sacs<input inputMode="numeric" value={f.bags} onChange={(e) => setF({ ...f, bags: e.target.value })} className={input} /></label>
        <label className="text-xs text-gray-600">Poids au départ (kg)<input inputMode="decimal" value={f.gross} onChange={(e) => setF({ ...f, gross: e.target.value })} className={input} /></label>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <Button className="mt-3" icon={<Truck className="h-4 w-4" />} loading={busy} onClick={save}
        disabledReason={(!f.destination && !plant) || !f.vehicle_plate || !f.driver_name || !f.gross ? 'Destination, camion, chauffeur et poids obligatoires' : undefined}>
        Émettre la fiche</Button>
    </div>
  )
}

/**
 * Fiches d'accompagnement : celles d'un lot (avec émission) si `lot` est fourni, sinon toutes celles de la coopérative.
 * Le lot doit être validé (contrôles EUDR levés) ; la première fiche le fait passer « expédié ».
 */
export default function TransportSlips({ lot, onLotChanged }: { lot?: Lot; onLotChanged?: () => void }) {
  const { addNotification } = useAppStore()
  const isPlant = useAuthStore((s) => s.user?.role === 'usine')     // compte usine : réception seulement
  const [slips, setSlips] = useState<TransportSlip[] | null>(null)
  const [adding, setAdding] = useState(false)
  const load = useCallback(() => traceApi.slips(lot?.id).then(({ data }) => setSlips(data)).catch(() => setSlips([])), [lot?.id])
  useEffect(() => { load() }, [load])

  const print = async (s: TransportSlip) => {
    const full = lot ?? (isPlant ? null : await lotsApi.get(s.lot).then(({ data }) => data).catch(() => null))
    await transportPdf(s, full)
  }
  const receive = async (s: TransportSlip) => {
    const v = await promptDialog({ title: `Réception de ${s.number}`, label: "Poids pesé à l'arrivée (kg)", defaultValue: s.gross_weight_kg,
      confirmLabel: 'Enregistrer la réception', validate: (x) => (Number(x.replace(',', '.')) > 0 ? null : 'Poids attendu en kg.') })
    if (!v) return
    try {
      const { data } = await traceApi.receiveSlip(s.id, { received_weight_kg: Number(v.replace(',', '.')) })
      addNotification({ type: Math.abs(data.weight_gap_kg ?? 0) > 0.005 * Number(s.gross_weight_kg) ? 'warning' : 'success',
        title: `Livraison ${s.number} reçue`, message: `Écart : ${fr(data.weight_gap_kg ?? 0)} kg par rapport au départ.` })
      load()
    } catch (err) { addNotification({ type: 'error', title: 'Réception impossible', message: apiErrorMessage(err) }) }
  }
  const cancel = async (s: TransportSlip) => {
    const reason = await promptDialog({ title: `Annuler ${s.number} ?`, label: 'Motif', confirmLabel: 'Annuler la fiche', validate: (x) => (x.trim() ? null : 'Indiquez le motif.') })
    if (!reason) return
    await traceApi.cancelSlip(s.id, reason).catch((err) => addNotification({ type: 'error', title: 'Annulation impossible', message: apiErrorMessage(err) }))
    load()
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 font-semibold text-gray-900"><Truck className="h-5 w-5 text-primary-700" /> Fiches d'accompagnement</p>
        <span className="flex-1" />
        {lot && (lot.status === 'valide' || lot.status === 'expedie') && !adding && <Button size="sm" onClick={() => setAdding(true)}>Émettre une fiche</Button>}
        {lot && lot.status === 'brouillon' && <span className="text-xs text-gray-500">Validez le lot pour émettre une fiche d'accompagnement.</span>}
      </div>
      {adding && lot && <div className="mt-4"><SlipForm lot={lot} onSaved={(s) => { setAdding(false); load(); onLotChanged?.(); print(s) }} /></div>}
      {slips === null ? <p className="mt-3 text-sm text-gray-500">Chargement…</p> : slips.length === 0 ? (
        !adding && <EmptyState icon={<Truck className="h-7 w-7" />} title="Aucune fiche d'accompagnement"
          text="La fiche d'accompagnement suit le lot dans le camion jusqu'à l'usine ou l'exportateur : chauffeur, plombs, poids au départ, puis poids reçu à l'arrivée." />
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['N°', 'Lot', 'Émise', 'Camion · chauffeur', 'Destination', 'Départ', 'Arrivée', 'Statut', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {slips.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 font-mono text-xs">{s.number}</td><td className="px-3 py-2 font-mono text-xs">{s.lot_code}</td>
                <td className="px-3 py-2">{new Date(s.issued_at).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2">{s.vehicle_plate}<span className="block text-xs text-gray-400">{s.driver_name}</span></td>
                <td className="px-3 py-2">{s.destination}{isPlant && <span className="block text-xs text-gray-400">{s.cooperative_name}</span>}</td>
                <td className="px-3 py-2 tabular-nums">{fr(Number(s.gross_weight_kg))} kg</td>
                <td className="px-3 py-2 tabular-nums">{s.received_weight_kg ? <>{fr(Number(s.received_weight_kg))} kg<span className={`block text-xs ${Math.abs(s.weight_gap_kg ?? 0) > 0.005 * Number(s.gross_weight_kg) ? 'text-red-700' : 'text-gray-400'}`}>écart {fr(s.weight_gap_kg ?? 0)} kg</span></> : '—'}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[s.status]}`}>{SLIP_STATUS[s.status]}</span></td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Button size="icon" variant="ghost" label="Imprimer la fiche" icon={<Printer className="h-4 w-4" />} onClick={() => print(s)} />
                  {s.status === 'emise' && <>
                    <Button size="icon" variant="ghost" label="Enregistrer la réception" icon={<PackageCheck className="h-4 w-4" />} onClick={() => receive(s)} />
                    {!isPlant && <Button size="icon" variant="ghost" label="Annuler la fiche" icon={<XCircle className="h-4 w-4" />} onClick={() => cancel(s)} />}
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
