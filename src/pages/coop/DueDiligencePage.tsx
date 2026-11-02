import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ShieldCheck, Play, FileText, FileSpreadsheet, Map as MapIcon, FileCheck2, Upload, Download, Settings2, Loader2, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import Header from '../../components/layout/Header'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { alertDialog } from '../../components/ui/dialog'
import ResultsLayer, { escapeHtml, type ResultItem } from '../../components/map/ResultsLayer'
import FitToData from '../../components/map/FitToData'
import VerificationSheet from '../../components/dd/VerificationSheet'
import ExplainPanel from '../../components/dd/ExplainPanel'
import { ddApi, type DDAnalysis, type DDCatalog, type DDResult, type Risk, type ReportMeta, RISK_COLOR, RISK_LABEL, FOREST_LABEL, SOURCE_LABEL, CONCORDANCE_LABEL, WHISP_STATUS_LABEL } from '../../api/dd'
import { lotsApi } from '../../api/lots'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { useHasModule } from '../../utils/modules'
import { useStickyState, useSort, SortTh } from '../../components/ui/table'
import { ddExcel, ddGeoJSON, ddManifest, ddPdf, ddTraces, lastDecision } from '../../utils/ddReport'
import { downloadBlob } from '../../utils/geoExport'
import { apiErrorMessage } from '../../utils/retry'

const { BaseLayer } = LayersControl
const THRESHOLD_LABELS: Record<string, string> = {
  min_forest_share: 'Part minimale de forêt pour qu’une source vote (%)', min_votes: 'Votes nécessaires pour « forêt 2020 »',
  hansen_treecover_min: 'Couvert arboré Hansen 2000 (%)', min_loss_ha: 'Perte minimale signalée (ha)', min_loss_pct: 'ou part minimale de la parcelle (%)',
  align_whisp: 'Logique WHISP (cultures pérennes)', commodity_share_low: 'Culture en 2020 → risque faible au-delà de (%)',
  predisturbance_share_low: 'Perturbation avant 2020 → risque faible au-delà de (%)', protected_high_pct: 'Aire protégée → risque élevé au-delà de (%)',
}

/** Diligence raisonnée EUDR : convergence de preuves, vérification, décisions et rapport (art. 9 à 12). */
export default function DueDiligencePage() {
  const coopId = useAuthStore((s) => s.user?.cooperativeId) ?? undefined
  const userName = useAuthStore((s) => s.user?.fullName) ?? ''
  const { parcels, legacyParcels, producers, cooperatives } = useAppStore()
  const hasLots = useHasModule('lots')
  const [catalog, setCatalog] = useState<DDCatalog | null>(null)
  const [history, setHistory] = useState<DDAnalysis[] | null>(null)
  const [current, setCurrent] = useState<DDAnalysis | null>(null)
  const [lots, setLots] = useState<{ id: string; code: string }[]>([])
  const [source, setSource] = useStickyState('dd:source', 'both')
  const [lot, setLot] = useState('')
  const [meta, setMeta] = useStickyState<ReportMeta>('dd:meta', { product: 'cacao', country: 'CI', responsible: userName })
  const [thresholds, setThresholds] = useState<Record<string, number | boolean>>({})
  const [defaults, setDefaults] = useState<Record<string, number | boolean>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [starting, setStarting] = useState(false)
  const [filter, setFilter] = useStickyState<'all' | Risk | 'rejected'>('dd:filter', 'all')
  const [q, setQ] = useState('')
  const [sheet, setSheet] = useState<DDResult | null>(null)
  const [busy, setBusy] = useState('')
  const poll = useRef<number>(0)
  const csvRef = useRef<HTMLInputElement>(null)

  const loadHistory = useCallback(() => ddApi.list(coopId).then(({ data }) => setHistory(data)).catch(() => setHistory([])), [coopId])
  useEffect(() => {
    ddApi.catalog().then(({ data }) => setCatalog(data)).catch(() => {})
    ddApi.settings(coopId).then(({ data }) => { setThresholds(data.thresholds); setDefaults(data.defaults) }).catch(() => {})
    if (hasLots) lotsApi.list().then(({ data }) => setLots(data.map((l) => ({ id: l.id, code: l.code })))).catch(() => {})
    loadHistory()
    return () => window.clearInterval(poll.current)
  }, [coopId, hasLots, loadHistory])

  const open = useCallback(async (id: string) => {
    window.clearInterval(poll.current)
    const { data } = await ddApi.get(id)
    setCurrent(data)
    if (data.status === 'pending' || data.status === 'running') {
      poll.current = window.setInterval(async () => {
        try {
          const { data: st } = await ddApi.status(id)
          setCurrent((c) => (c && c.id === id ? { ...c, ...st } : c))
          if (st.status === 'done' || st.status === 'error') {
            window.clearInterval(poll.current)
            const { data: full } = await ddApi.get(id)
            setCurrent(full); loadHistory()
          }
        } catch { /* nouvel essai au prochain tour */ }
      }, 3000)
    }
  }, [loadHistory])

  const start = async () => {
    setStarting(true)
    try {
      const { data } = await ddApi.start({ source, lot: lot || null, thresholds, report_meta: { ...meta, operator: meta.operator || cooperatives.find((c) => c.id === coopId)?.name }, cooperative: coopId })
      await loadHistory(); open(data.id)
    } catch (err) { await alertDialog({ tone: 'danger', title: 'Analyse impossible', message: apiErrorMessage(err) }) } finally { setStarting(false) }
  }

  const geomOf = useMemo(() => {
    const m = new Map<string, GeoJSON.Geometry>()
    for (const p of parcels) m.set(`parcel:${p.id}`, p.geometry as unknown as GeoJSON.Geometry)
    for (const l of legacyParcels) m.set(`legacy:${l.id}`, l.geometry as GeoJSON.Geometry)
    return (id: string) => m.get(id) ?? null
  }, [parcels, legacyParcels])

  const legal = useMemo(() => {
    const mine = producers.filter((p) => !coopId || p.cooperativeId === coopId)
    const withId = mine.filter((p) => p.nationalId).length
    return { land: `${withId} producteur(s) sur ${mine.length} avec pièce d'identité enregistrée ; titres ou attestations fonciers : à fournir` }
  }, [producers, coopId])

  const rows = useMemo(() => (current?.results ?? []).filter((r) => {
    if (filter === 'rejected' ? !r.rejected : filter !== 'all' && r.classification?.risk !== filter) return false
    const t = q.trim().toLowerCase()
    return !t || `${r.properties?.label} ${r.properties?.producer} ${r.properties?.producer_code} ${r.properties?.village}`.toLowerCase().includes(t)
  }), [current, filter, q])
  const ORDER = { faible: 0, a_verifier: 1, eleve: 2 }
  const { sorted, sort, toggle } = useSort(rows, {
    label: (r) => r.properties?.label, producer: (r) => r.properties?.producer, area: (r) => r.evidence?.area_ha ?? 0,
    forest: (r) => r.classification?.forest2020_votes ?? -1, loss: (r) => r.evidence?.loss_post2020_ha ?? 0,
    risk: (r) => (r.classification ? ORDER[r.classification.risk] : -1), score: (r) => r.classification?.score ?? -1,
  }, 'dd')

  const mapItems = useMemo<ResultItem[]>(() => (current?.results ?? []).filter((r) => r.classification && geomOf(r.id)).map((r) => ({
    key: r.id, geometry: geomOf(r.id)!, color: RISK_COLOR[r.classification!.risk],
    popup: () => `<b>${escapeHtml(r.properties.label)}</b> — ${escapeHtml(RISK_LABEL[r.classification!.risk])} (${r.classification!.score}/100)<br>${escapeHtml(r.classification!.justification.fr)}`,
  })), [current, geomOf])

  const doReport = async (kind: 'pdf' | 'xlsx' | 'geojson' | 'traces' | 'manifest') => {
    if (!current) return
    setBusy(kind)
    try {
      if (kind === 'pdf') await ddPdf(current, catalog, geomOf, legal)
      else if (kind === 'xlsx') await ddExcel(current, catalog)
      else if (kind === 'geojson') ddGeoJSON(current, geomOf)
      else if (kind === 'traces') {
        const r = ddTraces(current, geomOf, meta.country || 'CI')
        await alertDialog({ tone: r.kept ? 'success' : 'info', title: 'Fichier TRACES', message: `${r.kept} parcelle(s) retenue(s) (risque faible, ou risque levé par une décision documentée) ; ${r.excluded} écartée(s) par les contrôles TRACES.` })
      } else ddManifest(current)
    } catch (err) { await alertDialog({ tone: 'danger', title: 'Rapport impossible', message: apiErrorMessage(err) }) } finally { setBusy('') }
  }
  const whispExport = async () => {
    if (!current) return
    const { data } = await ddApi.whispExport(current.id)
    downloadBlob(data, `whisp_${current.created_at.slice(0, 10)}.geojson`)
  }
  const whispImport = async (f: File | undefined) => {
    if (!f || !current) return
    try {
      const { data } = await ddApi.whispImport(current.id, await f.text())
      await alertDialog({ tone: 'success', title: 'Résultats WHISP importés', message: `${data.matched} parcelle(s) rapprochée(s) sur ${data.rows} ligne(s) ; concordance ${data.summary.whisp_concordance_rate ?? '—'} %.` })
      open(current.id)
    } catch (err) { await alertDialog({ tone: 'danger', title: 'Import impossible', message: apiErrorMessage(err) }) }
  }

  const s = current?.summary as DDAnalysis['summary'] & { counts?: Record<Risk, number>; area_ha?: Record<Risk, number> }
  const input = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Diligence raisonnée" subtitle="Convergence de preuves (JRC, TMF, WorldCover, Hansen, aires protégées, domaine forestier) et rapport EUDR" />

      <ExplainPanel explain={catalog?.explain} thresholds={current?.thresholds ?? thresholds} />

      {/* Lancement */}
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-600">Parcelles
            <select value={source} onChange={(e) => setSource(e.target.value)} className={input}>
              <option value="both">Parcelles mappées + anciens polygones</option><option value="parcels">Parcelles mappées</option><option value="legacy">Anciens polygones</option>
            </select>
          </label>
          {hasLots && (
            <label className="text-xs text-gray-600">Périmètre
              <select value={lot} onChange={(e) => setLot(e.target.value)} className={input}>
                <option value="">Toute la coopérative</option>{lots.map((l) => <option key={l.id} value={l.id}>Lot {l.code}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs text-gray-600">Produit
            <select value={meta.product} onChange={(e) => setMeta({ ...meta, product: e.target.value as 'cacao' | 'cafe', hs_code: e.target.value === 'cafe' ? '0901' : '1801' })} className={input}>
              <option value="cacao">Cacao (SH 1801)</option><option value="cafe">Café (SH 0901)</option>
            </select>
          </label>
          <label className="text-xs text-gray-600">Quantité (kg)<input type="number" value={meta.quantity_kg ?? ''} onChange={(e) => setMeta({ ...meta, quantity_kg: e.target.value ? Number(e.target.value) : null })} className={input} /></label>
          <label className="text-xs text-gray-600">Région<input value={meta.region ?? ''} onChange={(e) => setMeta({ ...meta, region: e.target.value })} className={input} /></label>
          <label className="text-xs text-gray-600">Responsable<input value={meta.responsible ?? ''} onChange={(e) => setMeta({ ...meta, responsible: e.target.value })} className={input} /></label>
          <Button variant="secondary" icon={<Settings2 className="h-4 w-4" />} onClick={() => setShowSettings(!showSettings)}>Seuils</Button>
          <Button icon={<Play className="h-4 w-4" />} loading={starting} onClick={start} className="ml-auto">Lancer l'analyse</Button>
        </div>
        {showSettings && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 md:grid-cols-3">
            {Object.entries(THRESHOLD_LABELS).map(([k, label]) => (
              <label key={k} className="text-xs text-gray-600">{label}
                {typeof defaults[k] === 'boolean'
                  ? <span className="mt-2 flex items-center gap-2"><input type="checkbox" checked={!!thresholds[k]} onChange={(e) => setThresholds({ ...thresholds, [k]: e.target.checked })} /> activée</span>
                  : <input type="number" step="any" value={String(thresholds[k] ?? '')} onChange={(e) => setThresholds({ ...thresholds, [k]: Number(e.target.value) })} className={input} />}
                <span className="text-[10px] text-gray-400">défaut : {String(defaults[k])}</span>
              </label>
            ))}
            <div className="flex items-end gap-2 md:col-span-3">
              <Button variant="secondary" onClick={() => setThresholds({ ...defaults })}>Valeurs par défaut</Button>
              <Button variant="subtle" onClick={async () => { await ddApi.saveSettings(thresholds, coopId); await alertDialog({ tone: 'success', title: 'Seuils enregistrés pour la coopérative' }) }}>Enregistrer pour la coopérative</Button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500">
          {catalog?.whisp_configured ? 'WHISP (FAO) sera exécuté après l’analyse.' : 'WHISP non configuré sur le serveur (Google Earth Engine) : vous pouvez exporter les parcelles vers whisp.earthmap.org puis réimporter son CSV.'}
          {' '}Analyse conservée 5 ans (art. 12).
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[300px_1fr]">
        {/* Historique */}
        <section className="h-fit overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <p className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Analyses</p>
          {history === null ? <p className="p-4 text-sm text-gray-500">Chargement…</p> : history.length === 0
            ? <p className="p-4 text-sm text-gray-500">Aucune analyse pour l'instant.</p>
            : (
              <ul className="max-h-[60vh] divide-y divide-gray-50 overflow-y-auto">
                {history.map((h) => {
                  const hs = h.summary as { counts?: Record<Risk, number>; conclusion?: string }
                  return (
                    <li key={h.id}>
                      <button onClick={() => open(h.id)} className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 ${current?.id === h.id ? 'bg-primary-50' : ''}`}>
                        <p className="font-medium text-gray-900">{h.scope.label}</p>
                        <p className="text-xs text-gray-500">{new Date(h.created_at).toLocaleString('fr-FR')} · {h.status === 'done' ? `${(hs.counts?.eleve ?? 0)} élevé · ${(hs.counts?.a_verifier ?? 0)} à vérifier` : h.status === 'error' ? 'erreur' : 'en cours…'}</p>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
        </section>

        {/* Analyse ouverte */}
        <section className="min-w-0 space-y-4">
          {!current && <div className="rounded-2xl border border-gray-100 bg-white"><EmptyState icon={<ShieldCheck className="h-7 w-7" />} title="Lancez une analyse ou ouvrez-en une"
            text="Chaque parcelle est classée en risque faible, à vérifier ou élevé, avec ses preuves (forêt 2020, pertes après 2020, aires protégées, domaine forestier) ; le rapport de diligence raisonnée se génère ensuite en PDF, Excel et GeoJSON." /></div>}
          {current && (current.status === 'pending' || current.status === 'running') && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <p className="flex items-center gap-2 text-sm font-medium text-gray-900"><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours — {current.progress.toLocaleString('fr-FR')} / {current.total.toLocaleString('fr-FR')} parcelles</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${current.total ? (100 * current.progress) / current.total : 3}%` }} /></div>
              <p className="mt-2 text-xs text-gray-500">Vous pouvez quitter la page : l'analyse continue sur le serveur.</p>
            </div>
          )}
          {current?.status === 'error' && <p className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{current.error}</p>}
          {current?.status === 'done' && s?.counts && (
            <>
              <div className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 ${s.conclusion === 'negligeable' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}>
                {s.conclusion === 'negligeable' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                <p className="font-semibold">{s.conclusion === 'negligeable' ? 'Risque négligeable' : 'Risque non négligeable : mesures d’atténuation requises'}</p>
                <p className="text-sm opacity-80">{current.scope.label} · {new Date(current.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                {([['Analysées', s.analysed, 'all'], ['Faible', s.counts.faible, 'faible'], ['À vérifier', s.counts.a_verifier, 'a_verifier'], ['Élevé', s.counts.eleve, 'eleve'], ['Rejetées', s.rejected, 'rejected']] as const).map(([l, v, f]) => (
                  <button key={l} onClick={() => setFilter(f)} className={`rounded-xl border bg-white p-3 text-left ${filter === f ? 'ring-1 ring-primary-600' : ''}`}
                    style={f in RISK_COLOR ? { borderColor: RISK_COLOR[f as Risk] } : undefined}>
                    <p className="text-xs text-gray-500">{l}</p><p className="text-xl font-semibold tabular-nums">{v.toLocaleString('fr-FR')}</p>
                  </button>
                ))}
                <div className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">Concordance WHISP</p><p className="text-xl font-semibold">{s.whisp_concordance_rate != null ? `${s.whisp_concordance_rate} %` : '—'}</p><p className="text-[10px] text-gray-400">{WHISP_STATUS_LABEL[current.whisp_status]}</p></div>
              </div>
              {!!s.layers_unavailable?.length && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Sources indisponibles pendant l'analyse : {s.layers_unavailable.join(', ')} — le rapport le signale.</p>}

              <div className="flex flex-wrap gap-2">
                <Button icon={<FileText className="h-4 w-4" />} loading={busy === 'pdf'} onClick={() => doReport('pdf')}>Rapport PDF</Button>
                <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} loading={busy === 'xlsx'} onClick={() => doReport('xlsx')}>Excel</Button>
                <Button variant="secondary" icon={<MapIcon className="h-4 w-4" />} onClick={() => doReport('geojson')}>GeoJSON</Button>
                <Button variant="secondary" icon={<FileCheck2 className="h-4 w-4" />} onClick={() => doReport('traces')}>Export TRACES</Button>
                <Button variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => doReport('manifest')}>manifest.json</Button>
                <span className="mx-1 w-px bg-gray-200" />
                <Button variant="ghost" icon={<Download className="h-4 w-4" />} onClick={whispExport} label="GeoJSON pour whisp.earthmap.org">Export WHISP</Button>
                <Button variant="ghost" icon={<Upload className="h-4 w-4" />} onClick={() => csvRef.current?.click()} label="CSV de résultats de whisp.earthmap.org">Import WHISP</Button>
                <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { whispImport(e.target.files?.[0]); e.target.value = '' }} />
              </div>

              <div className="h-[360px] overflow-hidden rounded-2xl border border-gray-100">
                <MapContainer center={[7.5, -5.5]} zoom={8} className="h-full w-full" preferCanvas>
                  <LayersControl position="topright">
                    <BaseLayer checked name="Satellite Google"><TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" /></BaseLayer>
                    <BaseLayer name="OpenStreetMap"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" /></BaseLayer>
                  </LayersControl>
                  <FitToData geometries={mapItems.slice(0, 3000).map((m) => m.geometry)} />
                  <ResultsLayer items={mapItems} version={`${current.id}-${mapItems.length}`} />
                </MapContainer>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-100 p-3">
                  <div className="relative"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Parcelle, producteur, village…" className="rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-xs" /></div>
                  <span className="ml-auto text-xs text-gray-500">{sorted.length.toLocaleString('fr-FR')} parcelle(s) · cliquez une ligne pour la fiche de vérification</span>
                </div>
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500"><tr>
                      <SortTh label="Parcelle" k="label" sort={sort} onSort={toggle} /><SortTh label="Producteur" k="producer" sort={sort} onSort={toggle} />
                      <SortTh label="ha" k="area" sort={sort} onSort={toggle} /><SortTh label="Forêt 2020" k="forest" sort={sort} onSort={toggle} />
                      <SortTh label="Perte après 2020" k="loss" sort={sort} onSort={toggle} /><th className="px-5 py-3 text-left font-medium">Contexte</th>
                      <SortTh label="Risque" k="risk" sort={sort} onSort={toggle} /><SortTh label="Score" k="score" sort={sort} onSort={toggle} />
                      <th className="px-5 py-3 text-left font-medium">Décision</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {sorted.slice(0, 1500).map((r) => {
                        const c = r.classification, d = lastDecision(current.decisions, r.id)
                        return (
                          <tr key={r.id} onClick={() => !r.rejected && setSheet(r)} className={`${r.rejected ? 'bg-gray-50 text-gray-400' : 'cursor-pointer hover:bg-gray-50'}`}>
                            <td className="px-5 py-2 font-mono text-xs">{r.properties?.label}</td>
                            <td className="px-5 py-2 text-xs">{r.properties?.producer}<span className="block text-gray-400">{r.properties?.producer_code}</span></td>
                            <td className="px-5 py-2 tabular-nums text-xs">{(r.evidence?.area_ha ?? r.geometry_report?.area_ha ?? 0).toFixed(2)}</td>
                            <td className="px-5 py-2 text-xs">{c ? <>{FOREST_LABEL[c.forest2020]} <span className="text-gray-400">({c.forest2020_votes}/{c.forest2020_available.length})</span></> : (r.reasons ?? []).join(' ; ')}</td>
                            <td className="px-5 py-2 text-xs">{c && c.loss_sources.length ? <>{r.evidence!.loss_post2020_ha.toFixed(2)} ha <span className="block text-gray-400">{c.loss_sources.map((x) => SOURCE_LABEL[x] ?? x).join(', ')}</span></> : '—'}</td>
                            <td className="px-5 py-2 text-xs">{[...(r.context?.protected ?? []).map((p) => p.name), r.context?.rdue?.legalite === 'Non conforme' ? r.context.rdue.zone : ''].filter(Boolean).join(', ') || '—'}</td>
                            <td className="px-5 py-2">{c && <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: RISK_COLOR[c.risk] }}>{RISK_LABEL[c.risk]}</span>}
                              {r.whisp_risk && <span className="block text-[10px] text-gray-400">{CONCORDANCE_LABEL[r.whisp_concordance]}</span>}</td>
                            <td className="px-5 py-2 tabular-nums text-xs">{c?.score ?? '—'}</td>
                            <td className="px-5 py-2 text-xs">{d ? d.decision_label : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {sorted.length > 1500 && <p className="p-3 text-center text-xs text-gray-500">1 500 premières lignes affichées : filtrez ou utilisez l'export Excel pour le tableau complet.</p>}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {sheet && current && (
        <VerificationSheet analysis={current} result={sheet} geometry={geomOf(sheet.id)} explain={catalog?.explain} onClose={() => setSheet(null)}
          onDecided={(d) => setCurrent((c) => (c ? { ...c, decisions: [...(c.decisions ?? []), d] } : c))} />
      )}
    </div>
  )
}
