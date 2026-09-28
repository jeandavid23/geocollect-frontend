import { useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import * as XLSX from 'xlsx'
import { TreePine, Play, Square, Download, FileSpreadsheet, RotateCcw, Search, AlertTriangle, Loader2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import PolygonSourcePicker, { type PickedSource } from '../../components/map/PolygonSourcePicker'
import ResultsLayer, { escapeHtml, type ResultItem } from '../../components/map/ResultsLayer'
import FitToData from '../../components/map/FitToData'
import {
  deforestationApi, type DeforestationResult, type DeforestationOptions, type DefStatus, type Standard,
} from '../../api/deforestation'
import { withRetry, apiErrorMessage } from '../../utils/retry'
import { downloadBlob } from '../../utils/geoExport'

const { BaseLayer } = LayersControl

const STATUS_STYLE: Record<DefStatus, { color: string; label: string; badge: string }> = {
  'Conforme': { color: '#16a34a', label: 'Conforme', badge: 'bg-green-100 text-green-700' },
  'A risque': { color: '#f59e0b', label: 'À risque', badge: 'bg-amber-100 text-amber-800' },
  'Non conforme': { color: '#dc2626', label: 'Non conforme', badge: 'bg-red-100 text-red-700' },
  'Indetermine': { color: '#6b7280', label: 'Indéterminé', badge: 'bg-gray-100 text-gray-600' },
}
const RISK_LABEL: Record<string, string> = { Faible: 'Faible', Modere: 'Modéré', Eleve: 'Élevé', 'Tres eleve': 'Très élevé' }
const RISK_COLOR: Record<string, string> = { Faible: '#1B7F4B', Modere: '#F5A623', Eleve: '#EF6C00', 'Tres eleve': '#C62828' }
const STANDARDS: { value: Standard; label: string }[] = [
  { value: 'EUDR', label: 'EUDR — perte après le 31/12/2020' },
  { value: 'RA', label: 'Rainforest Alliance — perte après 2013' },
  { value: 'EUDR+RA', label: 'EUDR + RA — le plus strict (après 2013)' },
]

const CHUNK = 400        // parcelles par appel
const PARALLEL = 3       // appels simultanés
const PAGE = 100

// Latitude approximative (tri nord → sud : chaque lot lit une bande étroite des tuiles Hansen)
function latOf(g: GeoJSON.Geometry): number {
  const first = (c: unknown): number[] => (typeof (c as number[])[0] === 'number' ? (c as number[]) : first((c as unknown[])[0]))
  try { return first((g as GeoJSON.Polygon).coordinates)[1] } catch { return 0 }
}

export default function DeforestationPage() {
  const [picked, setPicked] = useState<PickedSource | null>(null)
  const [opts, setOpts] = useState<DeforestationOptions>({ standard: 'EUDR', tolerance_ha: 0.01, alert_pct: 1, treecover_min: 10 })
  const [results, setResults] = useState<(DeforestationResult | undefined)[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0, retry: '' })
  const [failed, setFailed] = useState<number[]>([])
  const [error, setError] = useState('')
  const [meta, setMeta] = useState<{ cutoff: number; source: string } | null>(null)
  const [filter, setFilter] = useState<DefStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [version, setVersion] = useState(0)
  const cancelRef = useRef(false)

  const features = picked?.features ?? []

  const choose = (s: PickedSource | null) => {
    setPicked(s); setResults([]); setFailed([]); setError(''); setMeta(null); setPage(0)
  }

  const run = async (only?: number[]) => {
    if (!features.length) return
    cancelRef.current = false
    setRunning(true); setError('')
    const acc: (DeforestationResult | undefined)[] = only ? results.slice() : new Array(features.length)
    const indices = (only ?? features.map((_, i) => i)).slice().sort((a, b) => latOf(features[b].geometry) - latOf(features[a].geometry))
    const chunks: number[][] = []
    for (let k = 0; k < indices.length; k += CHUNK) chunks.push(indices.slice(k, k + CHUNK))
    const failedNow: number[] = []
    let done = 0
    let next = 0
    let lastError = ''
    setProgress({ done: 0, total: indices.length, retry: '' })

    const worker = async () => {
      while (next < chunks.length && !cancelRef.current) {
        const chunk = chunks[next++]
        try {
          const { data } = await withRetry(
            () => deforestationApi.analyze(chunk.map((i) => ({ geometry: features[i].geometry, area_ha: features[i].area_ha })), opts),
            4,
            (n) => setProgress((p) => ({ ...p, retry: `nouvelle tentative ${n}/3 d'un lot` })),
          )
          chunk.forEach((i, k) => { acc[i] = data.results[k] })
          setMeta({ cutoff: data.cutoff_year, source: data.source })
        } catch (err) {
          lastError = apiErrorMessage(err)
          chunk.forEach((i) => { acc[i] = { status: 'Indetermine', error: lastError } })
          failedNow.push(...chunk)
        }
        done += chunk.length
        setProgress({ done, total: indices.length, retry: '' })
        setResults(acc.slice())
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, worker))

    setFailed(failedNow)
    setVersion((v) => v + 1)
    setRunning(false)
    if (cancelRef.current) setError(`Analyse interrompue : ${done} parcelle(s) traitée(s).`)
    else if (failedNow.length) setError(`${failedNow.length} parcelle(s) non analysée(s) : ${lastError} Cliquez sur « Relancer les échecs ».`)
  }

  // ─── Synthèse ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { total: 0, byStatus: {} as Record<string, number>, byRisk: {} as Record<string, number>, area: 0, defor: 0 }
    for (const r of results) {
      if (!r) continue
      s.total++
      s.byStatus[r.status] = (s.byStatus[r.status] ?? 0) + 1
      if (r.risk_level) s.byRisk[r.risk_level] = (s.byRisk[r.risk_level] ?? 0) + 1
      s.area += r.area_ha ?? 0
      s.defor += r.defor_ha ?? 0
    }
    return s
  }, [results])
  const analysed = stats.total - (stats.byStatus['Indetermine'] ?? 0)
  const rate = analysed ? Math.round(((stats.byStatus['Conforme'] ?? 0) / analysed) * 1000) / 10 : 0

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return features.map((f, i) => ({ f, i, r: results[i] }))
      .filter(({ f, r }) => r && (filter === 'all' || r.status === filter) && (!q || f.id.toLowerCase().includes(q)))
  }, [features, results, filter, search])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pageCount - 1)

  const mapItems = useMemo<ResultItem[]>(() => features.flatMap((f, i) => {
    const r = results[i]
    if (!r) return []
    return [{
      key: String(i), geometry: f.geometry, color: STATUS_STYLE[r.status]?.color ?? '#6b7280',
      popup: () => `<div style="font-size:12px;min-width:180px"><b>${escapeHtml(f.id)}</b><br/>
        <span style="color:${STATUS_STYLE[r.status]?.color}">${STATUS_STYLE[r.status]?.label}</span>
        ${r.risk_level ? ` · risque ${RISK_LABEL[r.risk_level]}` : ''}<br/>
        ${r.area_ha ?? '—'} ha · perte ${r.defor_ha ?? 0} ha (${r.defor_pct ?? 0} %)<br/>
        ${r.years ? `Années de perte : ${escapeHtml(r.years)}<br/>` : ''}
        Forêt 2000 : ${r.forest2000_pct ?? '—'} % · ${r.cover2020 ?? ''}
        ${r.error ? `<br/><span style="color:#dc2626">${escapeHtml(r.error)}</span>` : ''}</div>`,
    }]
  }), [features, results])

  // ─── Exports ─────────────────────────────────────────────────────────────
  const resultProps = (r?: DeforestationResult) => ({
    statut: r ? STATUS_STYLE[r.status]?.label : '', niveau_risque: r?.risk_level ? RISK_LABEL[r.risk_level] : '',
    surface_ha: r?.area_ha ?? '', perte_ha: r?.defor_ha ?? '', perte_pct: r?.defor_pct ?? '', annees_perte: r?.years ?? '',
    foret_2000_pct: r?.forest2000_pct ?? '', foret_coupure_pct: r?.forest2020_pct ?? '', usage_coupure: r?.cover2020 ?? '',
    methode: r?.method ?? '', erreur: r?.error ?? '',
  })

  const exportExcel = () => {
    const synth = [
      ['Analyse déforestation — GeoCollect (règles du plugin Deforestation check)'],
      ['Source', picked?.label ?? ''], ['Norme', opts.standard], ['Perte comptée après', meta?.cutoff ?? ''],
      ['Données', meta?.source ?? ''], ['Tolérance (ha)', opts.tolerance_ha], ['Seuil « À risque » (%)', opts.alert_pct],
      ['Couvert forestier minimal (%)', opts.treecover_min], [],
      ['Parcelles analysées', stats.total], ['Conformes', stats.byStatus['Conforme'] ?? 0],
      ['À risque', stats.byStatus['A risque'] ?? 0], ['Non conformes', stats.byStatus['Non conforme'] ?? 0],
      ['Indéterminées', stats.byStatus['Indetermine'] ?? 0], ['Taux de conformité (%)', rate],
      ['Surface totale (ha)', Math.round(stats.area * 100) / 100], ['Surface déforestée (ha)', Math.round(stats.defor * 1000) / 1000],
    ]
    const detail = features.map((f, i) => ({ identifiant: f.id, ...resultProps(results[i]), ...f.properties }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(synth), 'Synthèse')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Parcelles')
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'analyse_deforestation.xlsx')
  }

  const exportGeoJSON = () => {
    const fc = {
      type: 'FeatureCollection',
      features: features.map((f, i) => ({ type: 'Feature', geometry: f.geometry, properties: { identifiant: f.id, ...f.properties, ...resultProps(results[i]) } })),
    }
    downloadBlob(new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }), 'analyse_deforestation.geojson')
  }

  const input = 'w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="p-6 space-y-5">
      <Header title="Analyse déforestation" subtitle="Règles du plugin Deforestation check · Hansen Global Forest Change 2024" />

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">1. Parcelles à analyser</p>
        <PolygonSourcePicker allowPoints picked={picked} onPicked={choose} />
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">2. Paramètres</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-xs text-gray-600 md:col-span-2">Norme
            <select value={opts.standard} onChange={(e) => setOpts({ ...opts, standard: e.target.value as Standard })} className={input}>
              {STANDARDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Perte négligée jusqu'à (ha)
            <input type="number" step="0.01" min="0" value={opts.tolerance_ha} onChange={(e) => setOpts({ ...opts, tolerance_ha: Number(e.target.value) })} className={input} />
          </label>
          <label className="text-xs text-gray-600">« À risque » jusqu'à (% de la parcelle)
            <input type="number" step="0.1" min="0" value={opts.alert_pct} onChange={(e) => setOpts({ ...opts, alert_pct: Number(e.target.value) })} className={input} />
          </label>
          <label className="text-xs text-gray-600">Forêt si couvert 2000 ≥ (%)
            <input type="number" min="0" max="100" value={opts.treecover_min} onChange={(e) => setOpts({ ...opts, treecover_min: Number(e.target.value) })} className={input} />
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Perte ≤ tolérance : Conforme · perte ≤ seuil : À risque (à vérifier) · au-delà : Non conforme.
          Seule la perte sur une zone boisée en 2000 (couvert ≥ seuil FAO) est comptée comme déforestation.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {!running ? (
            <button onClick={() => run()} disabled={!features.length}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              <Play className="w-4 h-4" /> Analyser {features.length ? `${features.length.toLocaleString('fr-FR')} parcelle(s)` : ''}
            </button>
          ) : (
            <button onClick={() => { cancelRef.current = true }} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              <Square className="w-4 h-4" /> Arrêter
            </button>
          )}
          {failed.length > 0 && !running && (
            <button onClick={() => run(failed)} className="flex items-center gap-2 border border-amber-400 text-amber-800 px-4 py-2.5 rounded-xl text-sm font-medium">
              <RotateCcw className="w-4 h-4" /> Relancer les {failed.length} échec(s)
            </button>
          )}
        </div>
        {running && (
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {progress.done.toLocaleString('fr-FR')} / {progress.total.toLocaleString('fr-FR')} parcelles {progress.retry && `· ${progress.retry}`}</span>
              <span>{pct} %</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        {error && <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3"><AlertTriangle className="w-4 h-4 mt-0.5" /> {error}</p>}
      </section>

      {stats.total > 0 && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Analysées', value: stats.total.toLocaleString('fr-FR'), color: 'text-gray-900' },
              { label: 'Conformes', value: (stats.byStatus['Conforme'] ?? 0).toLocaleString('fr-FR'), color: 'text-green-700' },
              { label: 'À risque', value: (stats.byStatus['A risque'] ?? 0).toLocaleString('fr-FR'), color: 'text-amber-700' },
              { label: 'Non conformes', value: (stats.byStatus['Non conforme'] ?? 0).toLocaleString('fr-FR'), color: 'text-red-700' },
              { label: 'Taux de conformité', value: `${rate} %`, color: 'text-primary-700' },
              { label: 'Déforesté', value: `${stats.defor.toFixed(2)} ha`, color: 'text-red-700' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-6 text-xs">
            <div className="flex-1 min-w-[260px]">
              <p className="font-semibold text-gray-700 mb-2">Niveau de risque</p>
              {['Faible', 'Modere', 'Eleve', 'Tres eleve'].map((k) => {
                const n = stats.byRisk[k] ?? 0
                return (
                  <div key={k} className="flex items-center gap-2 mb-1">
                    <span className="w-20 text-gray-600">{RISK_LABEL[k]}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded"><div className="h-3 rounded" style={{ width: `${analysed ? (n / analysed) * 100 : 0}%`, background: RISK_COLOR[k] }} /></div>
                    <span className="w-14 text-right text-gray-700">{n.toLocaleString('fr-FR')}</span>
                  </div>
                )
              })}
            </div>
            <div className="text-gray-500 max-w-sm">
              <p>Surface analysée : <b className="text-gray-800">{stats.area.toFixed(2)} ha</b></p>
              <p>Perte comptée après : <b className="text-gray-800">{meta?.cutoff ?? '—'}</b></p>
              <p className="mt-1">{meta?.source}</p>
            </div>
            <div className="flex items-start gap-2 ml-auto">
              <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white font-medium"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
              <button onClick={exportGeoJSON} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium"><Download className="w-4 h-4" /> GeoJSON</button>
            </div>
          </section>

          <section className="h-[460px] rounded-2xl overflow-hidden border border-gray-100">
            <MapContainer center={[7.54, -5.55]} zoom={7} className="h-full w-full" preferCanvas>
              <LayersControl position="topright">
                <BaseLayer checked name="Satellite Google"><TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" /></BaseLayer>
                <BaseLayer name="OpenStreetMap"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" /></BaseLayer>
              </LayersControl>
              <FitToData geometries={features.map((f) => f.geometry)} />
              {!running && <ResultsLayer items={mapItems} version={`d${version}-${mapItems.length}`} />}
            </MapContainer>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-50">
              {(['all', 'Conforme', 'A risque', 'Non conforme', 'Indetermine'] as const).map((s) => (
                <button key={s} onClick={() => { setFilter(s); setPage(0) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium ${filter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {s === 'all' ? 'Toutes' : STATUS_STYLE[s].label} {s !== 'all' && `(${(stats.byStatus[s] ?? 0).toLocaleString('fr-FR')})`}
                </button>
              ))}
              <div className="relative ml-auto">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Identifiant…"
                  className="pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>{['Identifiant', 'Statut', 'Risque', 'Surface (ha)', 'Perte (ha)', 'Perte (%)', 'Années', 'Forêt 2000'].map((h) => <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.slice(current * PAGE, (current + 1) * PAGE).map(({ f, i, r }) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-mono text-xs">{f.id}</td>
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[r!.status]?.badge}`}>{STATUS_STYLE[r!.status]?.label}</span>
                        {r!.error && <span className="block text-[11px] text-red-600">{r!.error}</span>}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: r!.risk_level ? RISK_COLOR[r!.risk_level] : undefined }}>{r!.risk_level ? RISK_LABEL[r!.risk_level] : '—'}</td>
                      <td className="px-4 py-2">{r!.area_ha ?? '—'}</td>
                      <td className="px-4 py-2">{r!.defor_ha ?? '—'}</td>
                      <td className="px-4 py-2">{r!.defor_pct ?? '—'}</td>
                      <td className="px-4 py-2 text-xs">{r!.years || '—'}</td>
                      <td className="px-4 py-2 text-xs">{r!.forest2000_pct != null ? `${r!.forest2000_pct} %` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 border-t border-gray-50">
              <span>{rows.length.toLocaleString('fr-FR')} parcelle(s)</span>
              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  <button disabled={current === 0} onClick={() => setPage(current - 1)} className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40">‹ Précédent</button>
                  <span>Page {current + 1} / {pageCount}</span>
                  <button disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)} className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40">Suivant ›</button>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {!picked && (
        <p className="flex items-center gap-2 text-sm text-gray-500"><TreePine className="w-4 h-4 text-green-600" />
          Choisissez un fichier ou une source de la coopérative pour lancer l'analyse.</p>
      )}
    </div>
  )
}
