import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Factory, FileSpreadsheet, FileText, Plus, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { availableForProcessing, OPERATION_LABEL, OUTPUT_PRODUCTS, processingApi, type Available, type Operation, type OutputProduct, type ProcessingBatch, type ProcessingPayload, type Trace } from '../../api/trace'
import { useAuthStore } from '../../store/authStore'
import { processingPdf } from '../../utils/traceSheets'
import { exportExcel } from '../../utils/featureExport'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'
import TraceChain from './TraceChain'

const field = 'rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
const input = `mt-1 w-full ${field}`        // champ de formulaire pleine largeur
const cell = `${field} min-w-0`             // champ d'une ligne (entrées, produits) : largeur donnée à l'appel
type InRow = { source: string; weight: string }          // source = « lot:<id> » ou « batch:<id> »
type OutRow = { product: OutputProduct; weight: string; reference: string }

function BatchForm({ stock, onSaved, onCancel }: { stock: Available; onSaved: (b: ProcessingBatch) => void; onCancel: () => void }) {
  const ownPlant = useAuthStore((s) => s.user?.plantName)        // compte usine : toujours son usine
  const [operation, setOperation] = useState<Operation>('usinage')
  const [plant, setPlant] = useState(ownPlant ?? '')
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10))
  const [ins, setIns] = useState<InRow[]>([{ source: '', weight: '' }])
  const [outs, setOuts] = useState<OutRow[]>([{ product: 'feves_usinees', weight: '', reference: '' }])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const n = (v: string) => Number(v.replace(',', '.')) || 0
  const totalIn = ins.reduce((s, r) => s + n(r.weight), 0)
  const totalOut = outs.reduce((s, r) => s + n(r.weight), 0)
  const loss = totalIn - totalOut
  const sources = [
    ...stock.lots.map((l) => ({ key: `lot:${l.id}`, label: `Lot ${l.code} (${l.cooperative}) — ${fr(l.available_kg)} kg disponibles sur ${fr(l.net_kg)}` })),
    ...stock.batches.map((b) => ({ key: `batch:${b.id}`, label: `${OPERATION_LABEL[b.operation]} ${b.code} — ${fr(b.available_kg)} kg de produits disponibles` })),
  ]
  const save = async () => {
    setBusy(true); setError('')
    const body: ProcessingPayload = { operation, plant, process_date: day, notes,
      inputs: ins.filter((r) => r.source).map((r) => { const [kind, id] = r.source.split(':'); return { [kind]: id, weight_kg: n(r.weight) } }),
      outputs: outs.map((o) => ({ product: o.product, weight_kg: n(o.weight), reference: o.reference })) }
    try { const { data } = await processingApi.create(body); onSaved(data) } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <p className="font-semibold text-gray-900">Nouveau lot d'usinage ou de transformation</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs text-gray-600">Opération<select value={operation} onChange={(e) => setOperation(e.target.value as Operation)} className={input}>
          <option value="usinage">Usinage (nettoyage, tri, calibrage, ensachage export)</option><option value="transformation">Transformation (broyage, pressage, poudre)</option></select></label>
        <label className="text-xs text-gray-600">Usine<input value={plant} onChange={(e) => setPlant(e.target.value)} disabled={!!ownPlant} className={`${input} disabled:bg-gray-50`} placeholder="Usine, ville" /></label>
        <label className="text-xs text-gray-600">Date<input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={input} /></label>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800">Entrées <span className="font-normal text-gray-500">— lots expédiés de la coopérative, ou produits d'un usinage précédent</span></p>
        {ins.map((r, i) => (
          <div key={i} className="mt-2 flex gap-2">
            <select value={r.source} onChange={(e) => setIns(ins.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))} className={`${cell} flex-1`}>
              <option value="">Choisir un lot…</option>{sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            <input inputMode="decimal" placeholder="kg" value={r.weight} onChange={(e) => setIns(ins.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} className={`${cell} w-32`} />
            <Button size="icon" variant="ghost" label="Retirer" icon={<Trash2 className="h-4 w-4" />} onClick={() => setIns(ins.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button className="mt-2" size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setIns([...ins, { source: '', weight: '' }])}>Ajouter une entrée</Button>
        {sources.length === 0 && <p className="mt-1 text-xs text-amber-700">Aucun lot disponible : un lot devient disponible quand sa fiche d'accompagnement est émise (vers cette usine pour un compte usine).</p>}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800">Produits obtenus</p>
        {outs.map((o, i) => (
          <div key={i} className="mt-2 flex gap-2">
            <select value={o.product} onChange={(e) => setOuts(outs.map((x, j) => (j === i ? { ...x, product: e.target.value as OutputProduct } : x)))} className={`${cell} flex-1`}>
              {Object.entries(OUTPUT_PRODUCTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input placeholder="Référence (grade, n° client)" value={o.reference} onChange={(e) => setOuts(outs.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} className={`${cell} w-48`} />
            <input inputMode="decimal" placeholder="kg" value={o.weight} onChange={(e) => setOuts(outs.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} className={`${cell} w-32`} />
            <Button size="icon" variant="ghost" label="Retirer" icon={<Trash2 className="h-4 w-4" />} onClick={() => setOuts(outs.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button className="mt-2" size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setOuts([...outs, { product: 'dechets', weight: '', reference: '' }])}>Ajouter un produit</Button>
      </div>
      <p className={`rounded-xl px-4 py-3 text-sm ${loss < 0 ? 'bg-red-50 text-red-800' : 'bg-primary-50 text-primary-900'}`}>
        Bilan matière : <b>{fr(totalIn)} kg</b> entrés · <b>{fr(totalOut)} kg</b> obtenus · perte <b>{fr(loss)} kg</b>{totalIn ? ` (${fr((100 * loss) / totalIn)} %)` : ''}
        {loss < 0 && ' — impossible : on ne peut pas obtenir plus que ce qui est entré.'}</p>
      <label className="block text-xs text-gray-600">Notes<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button loading={busy} onClick={save} disabledReason={!plant ? "Indiquez l'usine" : !totalIn ? 'Ajoutez une entrée' : loss < 0 ? 'Bilan matière impossible' : undefined}>Enregistrer</Button>
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
      </div>
    </section>
  )
}

function BatchDetail({ batch, onBack }: { batch: ProcessingBatch; onBack: () => void }) {
  const [trace, setTrace] = useState<Trace | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { processingApi.trace(batch.id).then(({ data }) => setTrace(data)).catch(() => setTrace(null)) }, [batch.id])
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Tous les lots d'usinage</button>
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <p className="font-mono text-sm text-gray-500">{batch.code}</p>
            <p className="font-serif text-2xl font-semibold text-gray-900">{OPERATION_LABEL[batch.operation]} · {batch.plant}</p>
            <p className="mt-1 text-sm text-gray-600">{new Date(batch.process_date).toLocaleDateString('fr-FR')} · {fr(batch.input_kg)} kg entrés · {fr(batch.output_kg)} kg obtenus · perte {fr(batch.loss_pct)} %
              {batch.compliant_share_pct != null && <> · origine vérifiée {fr(batch.compliant_share_pct)} %</>}</p>
            {batch.loss_warning && <p className="mt-1 text-sm text-warning-text">Perte au-delà du seuil d'alerte de l'usine : à justifier (humidité, tri, déchets).</p>}
          </div>
          <span className="flex-1" />
          <Button icon={<FileText className="h-4 w-4" />} loading={busy} disabledReason={!trace ? 'Chaîne en cours de chargement' : undefined}
            onClick={async () => { if (!trace) return; setBusy(true); try { await processingPdf(batch, trace) } finally { setBusy(false) } }}>Certificat de traçabilité (PDF)</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {batch.outputs.map((o, i) => <span key={i} className={`rounded-full px-3 py-1 text-xs ${o.byproduct ? 'bg-gray-100 text-gray-600' : 'bg-primary-50 font-semibold text-primary-800'}`}>{o.product_label} · {fr(o.weight_kg)} kg{o.reference ? ` · ${o.reference}` : ''}</span>)}
        </div>
      </section>
      {trace ? <TraceChain trace={trace} /> : <p className="text-sm text-gray-500">Remontée de la chaîne…</p>}
    </div>
  )
}

function excelRows(batches: ProcessingBatch[]) {
  return batches.map((b) => ({
    lot_usinage: b.code, operation: OPERATION_LABEL[b.operation], usine: b.plant, date: b.process_date, statut: b.status,
    cooperatives: b.cooperatives.join(', '), entrees: b.inputs.map((i) => `${i.lot_code ?? i.batch_code} (${i.weight_kg} kg)`).join(', '),
    produits: b.outputs.map((o) => `${o.product_label} (${o.weight_kg} kg)`).join(', '), entre_kg: b.input_kg, obtenu_kg: b.output_kg,
    perte_kg: b.loss_kg, perte_pct: b.loss_pct, origine_verifiee_pct: b.compliant_share_pct,
  }))
}

/** Lots d'usinage ; avec `plant`, consultation de ceux d'une usine (sans saisie). */
export default function ProcessingTab({ plant }: { plant?: string } = {}) {
  const [batches, setBatches] = useState<ProcessingBatch[] | null>(null)
  const [stock, setStock] = useState<Available>({ lots: [], batches: [] })
  const [mode, setMode] = useState<'list' | 'new' | ProcessingBatch>('list')
  const load = useCallback(() => {
    processingApi.list(plant).then(({ data }) => setBatches(data)).catch(() => setBatches([]))
    if (!plant) availableForProcessing().then(({ data }) => setStock(data)).catch(() => setStock({ lots: [], batches: [] }))
  }, [plant])
  useEffect(() => { load() }, [load])

  if (mode === 'new') return <BatchForm stock={stock} onCancel={() => setMode('list')} onSaved={(b) => { load(); setMode(b) }} />
  if (typeof mode === 'object') return <BatchDetail batch={mode} onBack={() => setMode('list')} />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {!plant && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setMode('new')}>Nouveau lot d'usinage / transformation</Button>}
        {batches && batches.length > 0 && <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />}
          onClick={() => exportExcel([{ name: "Lots d'usinage", rows: excelRows(batches) }], `usinage_${new Date().toISOString().slice(0, 10)}.xlsx`)}>Excel</Button>}
      </div>
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {batches === null ? <p className="p-6 text-sm text-gray-500">Chargement…</p> : batches.length === 0 ? (
          <EmptyState icon={<Factory className="h-7 w-7" />} title="Aucun lot d'usinage"
            text="À l'usine, les lots expédiés par la coopérative sont usinés (nettoyage, tri, ensachage export) puis éventuellement transformés (masse, beurre, poudre). Enregistrez chaque opération : chaque produit obtenu remonte ensuite jusqu'aux producteurs et à leurs parcelles." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['N°', 'Opération', 'Usine', 'Date', 'Entrées', 'Produits', 'Perte'].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {batches.map((b) => (
                <tr key={b.id} onClick={() => setMode(b)} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">{b.code}</td><td className="px-4 py-2.5">{OPERATION_LABEL[b.operation]}</td>
                  <td className="px-4 py-2.5">{b.plant}</td><td className="px-4 py-2.5">{new Date(b.process_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-xs">{b.inputs.map((i) => i.lot_code ?? i.batch_code).join(', ')}<span className="block text-gray-500">{fr(b.input_kg)} kg</span></td>
                  <td className="px-4 py-2.5 text-xs">{b.outputs.filter((o) => !o.byproduct).map((o) => o.product_label).join(', ')}<span className="block text-gray-500">{fr(b.output_kg)} kg</span></td>
                  <td className={`px-4 py-2.5 tabular-nums ${b.loss_warning ? 'font-semibold text-warning-text' : ''}`}>{fr(b.loss_pct)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
