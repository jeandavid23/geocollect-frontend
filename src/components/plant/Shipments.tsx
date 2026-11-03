import { useCallback, useEffect, useState } from 'react'
import { FileSpreadsheet, FileText, Pencil, Send, Ship } from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { promptDialog } from '../ui/dialog'
import { plantOpsApi, SHIPMENT_STATUS, type Shipment, type ShipmentStatus } from '../../api/trace'
import { useAppStore } from '../../store/appStore'
import { exportExcel } from '../../utils/featureExport'
import { date, fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'
import { shipmentPdf } from '../../utils/traceSheets'
import ShipmentForm, { DOC_FIELDS } from './ShipmentForm'

const STATUS_TONE: Record<ShipmentStatus, string> = { preparee: 'bg-info-bg text-info-text', expediee: 'bg-success-bg text-success-text' }

function excelRows(list: Shipment[]) {
  return list.flatMap((s) => s.items.map((i) => ({
    expedition: s.number, date: s.ship_date, statut: SHIPMENT_STATUS[s.status], client: s.client, pays: s.destination_country,
    conteneur: s.container, plomb: s.seal, connaissement: s.bill_of_lading, navire: s.vessel, reference_dds: s.dds_reference,
    verification_dds: s.dds_verification, produit: i.product_label, lot_usinage: i.batch_code, sacs: i.bags, poids_kg: i.weight_kg,
  })))
}

/**
 * Expéditions sortantes de l'usine (vers un acheteur ou à l'export). Une expédition ne part qu'avec la référence de sa
 * déclaration de diligence raisonnée (DDS) ; son certificat remonte jusqu'aux parcelles d'origine.
 */
export default function Shipments({ plant, canEdit = true }: { plant?: string; canEdit?: boolean }) {
  const { addNotification } = useAppStore()
  const [list, setList] = useState<Shipment[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState('')
  const load = useCallback(() => plantOpsApi.shipments(plant).then(({ data }) => setList(data)).catch(() => setList([])), [plant])
  useEffect(() => { load() }, [load])

  const fail = (title: string) => (err: unknown) => addNotification({ type: 'error', title, message: apiErrorMessage(err) })
  const certificate = async (s: Shipment) => {
    setBusy(s.id)
    try { const { data } = await plantOpsApi.shipmentTrace(s.id); await shipmentPdf(s, data) }
    catch (err) { fail('Certificat indisponible')(err) } finally { setBusy('') }
  }
  const editDocs = async (s: Shipment) => {
    const dds = await promptDialog({ title: `Référence DDS de ${s.number}`, label: 'Référence de la déclaration de diligence raisonnée (TRACES)',
      defaultValue: s.dds_reference, confirmLabel: 'Enregistrer', validate: (x) => (x.trim().length >= 6 ? null : 'Référence trop courte.') })
    if (!dds) return
    await plantOpsApi.updateShipment(s.id, { dds_reference: dds.trim() }).then(load).catch(fail('Enregistrement impossible'))
  }
  const ship = async (s: Shipment) => {
    try {
      await plantOpsApi.updateShipment(s.id, { status: 'expediee' })
      addNotification({ type: 'success', title: `${s.number} expédiée`, message: 'Elle ne peut plus être modifiée.' })
      load()
    } catch (err) { fail('Expédition impossible')(err) }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 font-semibold text-gray-900"><Ship className="h-5 w-5 text-primary-700" /> Expéditions</p>
        <span className="flex-1" />
        {list && list.length > 0 && <Button size="sm" variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />}
          onClick={() => exportExcel([{ name: 'Expéditions', rows: excelRows(list) }], `expeditions_${new Date().toISOString().slice(0, 10)}.xlsx`)}>Excel</Button>}
        {canEdit && !adding && <Button size="sm" onClick={() => setAdding(true)}>Nouvelle expédition</Button>}
      </div>
      {adding && <ShipmentForm plant={plant} onSaved={(s) => { setAdding(false); load(); addNotification({ type: 'success', title: `Expédition ${s.number} créée`, message: s.dds_reference ? '' : 'Ajoutez la référence DDS avant le départ.' }) }} />}
      {list === null ? <p className="text-sm text-gray-500">Chargement…</p> : list.length === 0 ? (
        !adding && <EmptyState icon={<Ship className="h-7 w-7" />} title="Aucune expédition"
          text="Une expédition regroupe les produits finis qui partent vers un acheteur ou à l'export : conteneur, connaissement et référence de la déclaration de diligence raisonnée (DDS) exigée par le règlement européen." />
      ) : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['N°', 'Date', 'Client', 'Produits', 'Poids', 'Conteneur', 'DDS', 'Statut', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{s.number}</td><td className="whitespace-nowrap px-3 py-2">{date(s.ship_date)}</td>
                <td className="px-3 py-2">{s.client}{s.destination_country && <span className="block text-xs text-gray-400">{s.destination_country}</span>}</td>
                <td className="px-3 py-2 text-xs">{s.items.map((i) => `${i.product_label} (${i.batch_code})`).join(', ')}</td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fr(s.total_kg)} kg</td><td className="px-3 py-2 font-mono text-xs">{s.container || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.dds_reference || <span className="font-sans font-semibold text-warning-text">à renseigner</span>}</td>
                <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[s.status]}`}>{SHIPMENT_STATUS[s.status]}</span></td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Button size="icon" variant="ghost" label="Certificat d'expédition (PDF)" icon={<FileText className="h-4 w-4" />} loading={busy === s.id} onClick={() => certificate(s)} />
                  {canEdit && s.status === 'preparee' && <>
                    <Button size="icon" variant="ghost" label="Référence DDS" icon={<Pencil className="h-4 w-4" />} onClick={() => editDocs(s)} />
                    <Button size="icon" variant="ghost" label="Marquer comme expédiée" icon={<Send className="h-4 w-4" />}
                      disabledReason={s.dds_reference ? undefined : 'Référence DDS obligatoire'} onClick={() => ship(s)} />
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <p className="text-xs text-gray-400">Documents enregistrés : {DOC_FIELDS.map(([, label]) => label.replace(' *', '').toLowerCase()).join(', ')}.</p>
    </section>
  )
}
