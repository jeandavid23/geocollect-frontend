import { useEffect, useMemo, useState } from 'react'
import { Plus, Package, Trash2, FileText, FileCheck2, FileSpreadsheet, AlertTriangle, CheckCircle2, Search, ArrowLeft, Loader2, Truck } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAppStore } from '../../store/appStore'
import { lotsApi, PRODUCT_LABEL, STATUS_LABEL, type Lot, type LotLine, type LotPayload } from '../../api/lots'
import { lotPdf, lotTraces } from '../../utils/lotSheet'
import { exportExcel } from '../../utils/featureExport'
import { apiErrorMessage } from '../../utils/retry'

const STATUS_STYLE = { brouillon: 'bg-gray-100 text-gray-700', valide: 'bg-primary-50 text-primary-800', expedie: 'bg-blue-50 text-blue-800' }
const thisCampaign = () => { const d = new Date(); const y = d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${y + 1}` }
const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
const kg = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kg`

function Editor({ lot, onSaved, onCancel }: { lot: Lot | null; onSaved: (l: Lot) => void; onCancel: () => void }) {
  const { producers, isLoading } = useAppStore()
  const [f, setF] = useState<LotPayload>(lot ?? { campaign: thisCampaign(), product: 'cacao', lot_date: new Date().toISOString().slice(0, 10), bags: 0, gross_weight_kg: null, quality: '', warehouse: '', buyer: '', destination: '', transport: '', notes: '' })
  const [lines, setLines] = useState<LotLine[]>(lot?.lines ?? [])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const byId = useMemo(() => new Map(producers.map((p) => [p.id, p])), [producers])
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase(); if (s.length < 2) return []
    const used = new Set(lines.map((l) => l.producer))
    return producers.filter((p) => !used.has(p.id) && (p.fullName.toLowerCase().includes(s) || p.fieldIdBase.toLowerCase().includes(s) || (p.village ?? '').toLowerCase().includes(s))).slice(0, 8)
  }, [q, producers, lines])
  const net = lines.reduce((s, l) => s + (Number(l.weight_kg) || 0), 0)
  const bags = lines.reduce((s, l) => s + (Number(l.bags) || 0), 0)
  const set = (k: keyof LotPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const setLine = (i: number, k: keyof LotLine, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: k === 'weight_kg' || k === 'bags' ? Number(v) : v } : l)))

  const save = async () => {
    setBusy(true); setError('')
    try {
      const body: LotPayload = { ...f, bags: Number(f.bags) || bags, gross_weight_kg: f.gross_weight_kg ? Number(f.gross_weight_kg) : null,
        lines: lines.map((l) => ({ producer: l.producer, weight_kg: Number(l.weight_kg), bags: Number(l.bags) || 0, receipt: l.receipt ?? '', delivery_date: l.delivery_date || null })) }
      const { data } = lot ? await lotsApi.update(lot.id, body) : await lotsApi.create(body)
      onSaved(data)
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="font-semibold text-gray-900">{lot ? `Modifier ${lot.code}` : 'Nouveau lot'}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="text-xs text-gray-600">Produit<select value={f.product} onChange={set('product')} className={input}>{Object.entries(PRODUCT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-xs text-gray-600">Campagne<input value={f.campaign} onChange={set('campaign')} className={input} placeholder="2026-2027" /></label>
          <label className="text-xs text-gray-600">Date de constitution<input type="date" value={f.lot_date} onChange={set('lot_date')} className={input} /></label>
          <label className="text-xs text-gray-600">Qualité / grade<input value={f.quality} onChange={set('quality')} className={input} placeholder="Grade 1, FAQ…" /></label>
          <label className="text-xs text-gray-600">Nombre de sacs<input type="number" min="0" value={f.bags || ''} onChange={set('bags')} className={input} placeholder={String(bags || '')} /></label>
          <label className="text-xs text-gray-600">Poids brut pesé (kg)<input type="number" min="0" step="0.1" value={f.gross_weight_kg ?? ''} onChange={set('gross_weight_kg')} className={input} /></label>
          <label className="text-xs text-gray-600">Magasin<input value={f.warehouse} onChange={set('warehouse')} className={input} /></label>
          <label className="text-xs text-gray-600">Acheteur / exportateur<input value={f.buyer} onChange={set('buyer')} className={input} /></label>
          <label className="text-xs text-gray-600 md:col-span-2">Destination<input value={f.destination} onChange={set('destination')} className={input} placeholder="Port de San Pedro, usine…" /></label>
          <label className="text-xs text-gray-600 md:col-span-2">Transport<input value={f.transport} onChange={set('transport')} className={input} placeholder="Camion, immatriculation, chauffeur" /></label>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-gray-900">Livraisons des producteurs <span className="font-normal text-gray-500">· {lines.length} producteur(s) · {kg(net)} · {bags} sac(s)</span></p>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter un producteur (nom, code, village)…" className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm" />
            {q.trim().length >= 2 && matches.length === 0 && (
              <p className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
                {isLoading ? 'Chargement des producteurs…' : 'Aucun producteur trouvé.'}
              </p>
            )}
            {matches.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                {matches.map((p) => (
                  <button key={p.id} onClick={() => { setLines([...lines, { producer: p.id, producer_name: p.fullName, producer_code: p.fieldIdBase, village: p.village, weight_kg: 0, bags: 0 }]); setQ('') }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">{p.fullName} <span className="text-gray-500">· {p.fieldIdBase} · {p.village}</span></button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Producteur', 'Code', 'Bon / reçu', 'Date', 'Sacs', 'Poids (kg)', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((l, i) => {
                const p = byId.get(l.producer)
                return (
                  <tr key={l.producer}>
                    <td className="px-3 py-1.5">{l.producer_name ?? p?.fullName}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{l.producer_code ?? p?.fieldIdBase}</td>
                    <td className="px-3 py-1.5"><input value={l.receipt ?? ''} onChange={(e) => setLine(i, 'receipt', e.target.value)} className="w-28 rounded border border-gray-200 px-2 py-1" /></td>
                    <td className="px-3 py-1.5"><input type="date" value={l.delivery_date ?? ''} onChange={(e) => setLine(i, 'delivery_date', e.target.value)} className="rounded border border-gray-200 px-2 py-1" /></td>
                    <td className="px-3 py-1.5"><input type="number" min="0" value={l.bags || ''} onChange={(e) => setLine(i, 'bags', e.target.value)} className="w-20 rounded border border-gray-200 px-2 py-1" /></td>
                    <td className="px-3 py-1.5"><input type="number" min="0" step="0.1" value={l.weight_kg || ''} onChange={(e) => setLine(i, 'weight_kg', e.target.value)} className="w-28 rounded border border-gray-200 px-2 py-1" /></td>
                    <td className="px-3 py-1.5"><button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600" aria-label="Retirer"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                )
              })}
              {lines.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Recherchez un producteur pour ajouter sa livraison.</td></tr>}
            </tbody>
          </table>
        </div>
        <label className="mt-4 block text-xs text-gray-600">Notes<textarea rows={2} value={f.notes} onChange={set('notes')} className={input} /></label>
      </section>

      {error && <p role="alert" className="rounded-md border-l-4 border-red-500 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>}
      <div className="flex gap-3">
        <button onClick={save} disabled={busy || !lines.length} className="flex items-center gap-2 rounded-md bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer et contrôler</button>
        <button onClick={onCancel} className="rounded-md border border-gray-300 px-5 py-2.5 text-sm">Annuler</button>
      </div>
    </div>
  )
}

function Detail({ lot, onBack, onEdit, onChanged }: { lot: Lot; onBack: () => void; onEdit: () => void; onChanged: (l: Lot | null) => void }) {
  const { addNotification } = useAppStore()
  const [busy, setBusy] = useState('')
  const c = lot.checks
  const setStatus = async (status: Lot['status']) => {
    setBusy(status)
    try { const { data } = await lotsApi.update(lot.id, { status }); onChanged(data); addNotification({ type: 'success', title: `Lot ${STATUS_LABEL[status].toLowerCase()}`, message: lot.code }) }
    catch (err) {
      const d = (err as { response?: { data?: Lot & { detail?: string } } })?.response?.data
      if (d?.checks) onChanged(d)
      addNotification({ type: 'error', title: 'Changement refusé', message: apiErrorMessage(err) })
    } finally { setBusy('') }
  }
  const remove = async () => {
    if (!window.confirm(`Supprimer le lot ${lot.code} ?`)) return
    await lotsApi.remove(lot.id); onChanged(null)
  }
  const excel = () => exportExcel([
    { name: 'Lot', rows: [['Fiche de lot', lot.code], ['Coopérative', lot.cooperative_name], ['Produit', PRODUCT_LABEL[lot.product]], ['Campagne', lot.campaign], ['Date', lot.lot_date], ['Sacs', lot.bags], ['Poids brut (kg)', lot.gross_weight_kg ?? ''], ['Poids net livré (kg)', c?.net_weight_kg ?? ''], ['Acheteur', lot.buyer], ['Destination', lot.destination], ['Transport', lot.transport], ['Statut', STATUS_LABEL[lot.status]]] },
    { name: 'Livraisons', rows: lot.lines.map((l) => ({ producteur: l.producer_name, code: l.producer_code, village: l.village, bon: l.receipt, date: l.delivery_date, sacs: l.bags, poids_kg: Number(l.weight_kg) })) },
    { name: 'Contrôles', rows: (c?.issues ?? []).map((i) => ({ niveau: i.level, producteur: i.producer, message: i.message })) },
    { name: 'Parcelles', rows: (c?.parcels ?? []).map((p) => ({ field_id: p.field_id, village: p.village, surface_ha: p.area_hectares, statut_eudr: p.eudr_status, score: p.eudr_score })) },
  ], `fiche_lot_${lot.code}.xlsx`)

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Tous les lots</button>
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-sm text-gray-500">{lot.code}</p>
            <p className="font-serif text-2xl font-semibold text-gray-900">{PRODUCT_LABEL[lot.product]} · {kg(c?.net_weight_kg ?? lot.net_weight_kg)}</p>
            <p className="mt-1 text-sm text-gray-600">{lot.bags} sac(s) · campagne {lot.campaign} · {new Date(lot.lot_date).toLocaleDateString('fr-FR')}{lot.buyer ? ` · ${lot.buyer}` : ''}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[lot.status]}`}>{STATUS_LABEL[lot.status]}</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={async () => { setBusy('pdf'); try { await lotPdf(lot) } finally { setBusy('') } }} className="flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800">{busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Fiche de lot (PDF)</button>
          <button onClick={() => { const r = lotTraces(lot); addNotification(r ? { type: r.excluded ? 'warning' : 'success', title: 'Fichier TRACES du lot', message: `${r.kept} parcelle(s)${r.excluded ? `, ${r.excluded} écartée(s) (géométrie invalide)` : ''}` } : { type: 'warning', title: 'Aucune parcelle', message: 'Aucune parcelle cartographiée pour ce lot.' }) }}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"><FileCheck2 className="h-4 w-4" /> TRACES (GeoJSON)</button>
          <button onClick={excel} className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          <span className="flex-1" />
          {lot.status === 'brouillon' && <>
            <button onClick={onEdit} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Modifier</button>
            <button onClick={() => setStatus('valide')} disabled={!!busy} className="rounded-md border border-primary-700 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50">Valider le lot</button>
            <button onClick={remove} className="rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">Supprimer</button>
          </>}
          {lot.status === 'valide' && <>
            <button onClick={() => setStatus('brouillon')} className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Repasser en brouillon</button>
            <button onClick={() => setStatus('expedie')} className="flex items-center gap-2 rounded-md border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Truck className="h-4 w-4" /> Marquer expédié</button>
          </>}
        </div>
      </section>

      <section className={`rounded-2xl border p-5 ${c?.blocking ? 'border-red-200 bg-red-50/40' : 'border-primary-200 bg-primary-50/40'}`}>
        <p className={`flex items-center gap-2 font-semibold ${c?.blocking ? 'text-red-800' : 'text-primary-800'}`}>
          {c?.blocking ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          {c?.blocking ? `${c.blocking} anomalie(s) bloquante(s) : le lot ne peut pas être validé` : 'Contrôles EUDR : aucune anomalie bloquante'}
        </p>
        <p className="mt-1 text-sm text-gray-600">{c?.producers.length} producteur(s) · {c?.parcels.length} parcelle(s) d'origine · {c?.total_area_ha} ha · {c?.warnings} point(s) d'attention</p>
        {!!c?.issues.length && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {c.issues.map((i, k) => (
              <li key={k} className="flex gap-2"><span className={`mt-0.5 h-fit rounded px-1.5 py-0.5 text-[11px] font-semibold ${i.level === 'bloquant' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{i.level === 'bloquant' ? 'Bloquant' : 'Attention'}</span>
                <span>{i.producer && <b>{i.producer} : </b>}{i.message}</span></li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Producteur', 'Code', 'Poids', 'Parcelles', 'Surface', 'Rendement', 'Contrôle'].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {c?.producers.map((p) => (
              <tr key={p.producer}>
                <td className="px-4 py-2">{p.name}</td><td className="px-4 py-2 font-mono text-xs text-gray-500">{p.code}</td>
                <td className="px-4 py-2 tabular-nums">{kg(p.weight_kg)}</td><td className="px-4 py-2">{p.parcels}</td>
                <td className="px-4 py-2 tabular-nums">{p.area_ha} ha</td><td className="px-4 py-2 tabular-nums">{p.yield_kg_ha ? `${p.yield_kg_ha} kg/ha` : '—'}</td>
                <td className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${p.status === 'ok' ? 'bg-primary-50 text-primary-800' : p.status === 'bloquant' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{p.status === 'ok' ? 'OK' : p.status === 'bloquant' ? 'Bloquant' : 'À vérifier'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default function LotsPage() {
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [view, setView] = useState<{ mode: 'list' } | { mode: 'edit'; lot: Lot | null } | { mode: 'detail'; lot: Lot }>({ mode: 'list' })
  const [error, setError] = useState('')
  const load = () => lotsApi.list().then(({ data }) => setLots(data)).catch((e) => { setError(apiErrorMessage(e)); setLots([]) })
  useEffect(() => { load() }, [])
  const open = async (l: Lot) => { const { data } = await lotsApi.get(l.id); setView({ mode: 'detail', lot: data }) }

  return (
    <div className="space-y-5 p-6">
      <Header title="Fiches de lot" subtitle="Lots constitués à partir des livraisons des producteurs · contrôles EUDR, fiche PDF, fichier TRACES" />
      {view.mode === 'edit' && <Editor lot={view.lot} onCancel={() => setView(view.lot ? { mode: 'detail', lot: view.lot } : { mode: 'list' })} onSaved={(l) => { load(); setView({ mode: 'detail', lot: l }) }} />}
      {view.mode === 'detail' && <Detail lot={view.lot} onBack={() => { load(); setView({ mode: 'list' }) }} onEdit={() => setView({ mode: 'edit', lot: view.lot })}
        onChanged={(l) => { if (l) setView({ mode: 'detail', lot: l }); else { load(); setView({ mode: 'list' }) } }} />}
      {view.mode === 'list' && (
        <>
          <button onClick={() => setView({ mode: 'edit', lot: null })} className="flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"><Plus className="h-4 w-4" /> Nouveau lot</button>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {lots === null ? <p className="p-6 text-sm text-gray-500">Chargement…</p> : lots.length === 0 ? (
              <div className="p-10 text-center"><Package className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-3 text-sm text-gray-500">Aucun lot pour le moment. Créez le premier à partir des livraisons de vos producteurs.</p></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Lot', 'Date', 'Produit', 'Producteurs', 'Sacs', 'Poids net', 'Acheteur', 'Statut'].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {lots.map((l) => (
                    <tr key={l.id} onClick={() => open(l)} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs">{l.code}</td><td className="px-4 py-2.5">{new Date(l.lot_date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-2.5">{PRODUCT_LABEL[l.product]}</td><td className="px-4 py-2.5">{l.lines.length}</td><td className="px-4 py-2.5">{l.bags}</td>
                      <td className="px-4 py-2.5 tabular-nums">{kg(l.net_weight_kg)}</td><td className="px-4 py-2.5">{l.buyer || '—'}</td>
                      <td className="px-4 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[l.status]}`}>{STATUS_LABEL[l.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}
