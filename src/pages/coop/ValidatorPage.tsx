import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import * as XLSX from 'xlsx'
import { ShieldCheck, Play, Download, FileSpreadsheet, Search, AlertTriangle, Loader2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import PolygonSourcePicker, { type PickedSource } from '../../components/map/PolygonSourcePicker'
import ResultsLayer, { escapeHtml, type ResultItem } from '../../components/map/ResultsLayer'
import FitToData from '../../components/map/FitToData'
import {
  validatorApi, DEFAULT_VALIDATOR_OPTIONS, type ValidatorOptions, type ValidatorResponse, type ValidatorResult,
} from '../../api/validator'
import { withRetry, apiErrorMessage } from '../../utils/retry'
import { downloadBlob } from '../../utils/geoExport'
import ReportExportBar from '../../components/ui/ReportExportBar'
import type { Report } from '../../utils/report'

const { BaseLayer } = LayersControl
const PAGE = 100

const REASON_LABEL: Record<string, string> = {
  geometrie_nulle: 'Géométrie nulle', geometrie_irreparable: 'Géométrie irréparable',
  surface_inferieure_seuil: 'Surface trop petite', sliver: 'Sliver (polygone filiforme)',
  doublon_exact: 'Doublon exact', inclusion_totale: 'Inclus dans un autre',
  superposition_sup_seuil: 'Superposition > seuil',
}
const ERROR_LABEL: Record<string, string> = {
  self_intersection: 'Auto-intersection', ring_self_intersection: 'Anneau auto-sécant',
  duplicate_vertices: 'Sommets dupliqués', polygon_hole_error: 'Trou invalide',
  too_few_points: 'Trop peu de sommets', invalid_geometry: 'Géométrie invalide',
  geometrie_nulle: 'Géométrie nulle', pas_de_polygone: 'Pas un polygone', sliver_polygon: 'Sliver',
}

function colorOf(r: ValidatorResult) {
  if (r.status === 'removed') return '#dc2626'
  if (r.is_ovlp === 'OUI') return '#f59e0b'
  if (r.corrected) return '#2563eb'
  return '#16a34a'
}

export default function ValidatorPage() {
  const [picked, setPicked] = useState<PickedSource | null>(null)
  const [opts, setOpts] = useState<ValidatorOptions>(DEFAULT_VALIDATOR_OPTIONS)
  const [out, setOut] = useState<ValidatorResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'kept' | 'removed' | 'overlap' | 'corrected'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const choose = (s: PickedSource | null) => { setPicked(s); setOut(null); setError(''); setPage(0) }

  const run = async () => {
    if (!picked) return
    setRunning(true); setError(''); setOut(null)
    try {
      let res
      if (picked.kind === 'file') {
        setStep(`Compression et envoi de ${picked.features.length.toLocaleString('fr-FR')} polygones…`)
        res = await withRetry(() => validatorApi.runFeatures(picked.features.map((f) => ({ id: f.id, geometry: f.geometry })), opts), 3,
          (n) => setStep(`Serveur occupé, nouvelle tentative ${n}/2…`))
      } else {
        setStep('Validation des polygones enregistrés…')
        res = await withRetry(() => validatorApi.runSource(picked.kind as 'parcels' | 'legacy', opts), 3,
          (n) => setStep(`Serveur occupé, nouvelle tentative ${n}/2…`))
      }
      setOut(res.data)
      setPage(0)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setRunning(false); setStep('')
    }
  }

  // Géométrie à afficher / exporter : corrigée si le serveur l'a renvoyée, sinon celle de la source
  const geomOf = (r: ValidatorResult) => r.geometry ?? picked?.features[r.index]?.geometry
  const propsOf = (r: ValidatorResult) => (picked?.kind === 'file' ? picked.features[r.index]?.properties ?? {} : {})

  const rows = useMemo(() => {
    if (!out) return []
    const q = search.trim().toLowerCase()
    return out.results.filter((r) =>
      (filter === 'all' || (filter === 'kept' && r.status === 'kept') || (filter === 'removed' && r.status === 'removed')
        || (filter === 'overlap' && r.is_ovlp === 'OUI') || (filter === 'corrected' && r.corrected))
      && (!q || r.id.toLowerCase().includes(q)))
  }, [out, filter, search])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pageCount - 1)

  const mapItems = useMemo<ResultItem[]>(() => (out?.results ?? []).flatMap((r) => {
    const g = geomOf(r)
    if (!g) return []
    return [{
      key: String(r.index), geometry: g, color: colorOf(r), dashed: r.status === 'removed',
      popup: () => `<div style="font-size:12px;min-width:180px"><b>${escapeHtml(r.id)}</b><br/>
        ${r.status === 'kept' ? '<span style="color:#16a34a">Conservé</span>' : `<span style="color:#dc2626">Supprimé : ${escapeHtml(REASON_LABEL[r.reason] ?? r.reason)}</span>`}
        ${r.ref_id ? `<br/>Référence : ${escapeHtml(r.ref_id)}` : ''}<br/>${r.area_ha} ha · ${r.vertices} sommets
        ${r.corrected ? '<br/><span style="color:#2563eb">Géométrie corrigée</span>' : ''}
        ${r.errors.length ? `<br/>Erreurs : ${escapeHtml(r.errors.map((e) => ERROR_LABEL[e] ?? e).join(', '))}` : ''}
        ${r.is_ovlp === 'OUI' ? `<br/><span style="color:#b45309">Superposition ${r.overlap_pct} % avec ${escapeHtml(r.overlap_ids)}</span>` : ''}</div>`,
    }]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [out])

  // ─── Exports (même structure que le rapport Excel du plugin) ──────────────
  const flat = (r: ValidatorResult) => ({
    identifiant: r.id, statut: r.status === 'kept' ? 'Conservé' : 'Supprimé', motif: REASON_LABEL[r.reason] ?? r.reason,
    reference: r.ref_id, corrige: r.corrected ? 'OUI' : 'NON', erreurs: r.errors.map((e) => ERROR_LABEL[e] ?? e).join(', '),
    surface_ha: r.area_ha, sommets: r.vertices, is_ovlp: r.is_ovlp, ovlp_pct: r.overlap_pct, ovlp_ids: r.overlap_ids,
  })

  const exportExcel = () => {
    if (!out) return
    const s = out.summary
    const synth = [
      ['Polygon Validator — GeoCollect (règles du plugin Polygon validator EUDR 2)'], ['Source', picked?.label ?? ''],
      ['Seuil de superposition (%)', s.threshold], ['Surface minimale (ha)', s.min_area_ha], [],
      ['Polygones en entrée', s.initial_count], ['Conservés', s.final_count], ['Supprimés', s.deleted_count],
      ['— superposition > seuil', s.over_threshold_removed], ['— doublons exacts', s.duplicates_removed],
      ['— inclusions totales', s.containment_removed], ['— surfaces trop petites', s.small_removed],
      ['— slivers', s.slivers_removed], ['— nuls / irréparables', s.null_removed],
      ['Géométries corrigées', s.geometries_fixed], ['Superpositions ≤ seuil (annotées)', s.overlaps_detected],
      ['Surface initiale (ha)', s.initial_area_ha], ['Surface finale (ha)', s.final_area_ha],
      ['Temps de calcul (s)', s.processing_time], [], ['Erreurs topologiques d\'origine'],
      ...Object.entries(s.topology_errors).map(([k, v]) => [ERROR_LABEL[k] ?? k, v]),
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(synth), 'Synthèse')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out.results.filter((r) => r.errors.length || r.corrected).map(flat)), 'Erreurs')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out.results.filter((r) => r.status === 'kept').map((r) => ({ ...flat(r), ...propsOf(r) }))), 'Conservés')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out.results.filter((r) => r.status === 'removed').map((r) => ({ ...flat(r), ...propsOf(r) }))), 'Supprimés')
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'rapport_polygon_validator.xlsx')
  }

  const exportGeoJSON = (status: 'kept' | 'removed') => {
    if (!out) return
    const fc = {
      type: 'FeatureCollection',
      features: out.results.filter((r) => r.status === status && geomOf(r))
        .map((r) => ({ type: 'Feature', geometry: geomOf(r), properties: { ...propsOf(r), ...flat(r) } })),
    }
    downloadBlob(new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }), status === 'kept' ? 'polygones_conserves.geojson' : 'polygones_supprimes.geojson')
  }

  // Rapport complet (PDF, Excel, CSV, GeoJSON, KML, Shapefile) — enregistré dans « Rapports »
  const report = useMemo<Report | null>(() => {
    if (!out) return null
    const s = out.summary
    const rows = out.results.map((r) => ({ ...flat(r), ...propsOf(r) }) as Report['tables'][number]['rows'][number])
    return {
      kind: 'validator', title: 'Rapport Polygon Validator — chevauchements et géométries', source: picked?.label ?? '',
      summary: [
        ['Seuil de superposition (%)', s.threshold], ['Surface minimale (ha)', s.min_area_ha],
        ['Polygones en entrée', s.initial_count], ['Conservés', s.final_count], ['Supprimés', s.deleted_count],
        ['— superposition > seuil', s.over_threshold_removed], ['— doublons exacts', s.duplicates_removed],
        ['— inclusions totales', s.containment_removed], ['— surfaces trop petites', s.small_removed],
        ['— slivers', s.slivers_removed], ['— nuls / irréparables', s.null_removed],
        ['Géométries corrigées', s.geometries_fixed], ['Superpositions ≤ seuil (annotées)', s.overlaps_detected],
        ['Surface initiale (ha)', s.initial_area_ha], ['Surface finale (ha)', s.final_area_ha],
        ...Object.entries(s.topology_errors).map(([k, v]) => [`Erreur d'origine : ${ERROR_LABEL[k] ?? k}`, v] as [string, number]),
      ],
      tables: [
        { name: 'Tous les polygones', rows },
        { name: 'Conservés', rows: rows.filter((_, i) => out.results[i].status === 'kept') },
        { name: 'Supprimés', rows: rows.filter((_, i) => out.results[i].status === 'removed') },
        { name: 'Superpositions', rows: rows.filter((_, i) => out.results[i].is_ovlp === 'OUI') },
      ],
      // couche géographique : les polygones conservés (corrigés), prêts à l'emploi
      features: out.results.filter((r) => r.status === 'kept' && geomOf(r)).map((r) => ({ geometry: geomOf(r)!, properties: { ...propsOf(r), ...flat(r) } })),
      nameField: 'identifiant',
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out])

  const input = 'w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const toggle = (key: keyof ValidatorOptions, label: string) => (
    <label className="flex items-center gap-2 text-xs text-gray-700">
      <input type="checkbox" checked={Boolean(opts[key])} onChange={(e) => setOpts({ ...opts, [key]: e.target.checked })} /> {label}
    </label>
  )
  const s = out?.summary

  return (
    <div className="p-6 space-y-5">
      <Header title="Polygon Validator" subtitle="Règles du plugin Polygon validator EUDR 2 · superpositions, doublons, auto-intersections" />

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">1. Polygones à valider</p>
        <PolygonSourcePicker picked={picked} onPicked={choose} />
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">2. Paramètres</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-xs text-gray-600">Superposition supprimée au-delà de (%)
            <input type="number" min="0" max="100" step="0.5" value={opts.threshold} onChange={(e) => setOpts({ ...opts, threshold: Number(e.target.value) })} className={input} />
          </label>
          <label className="text-xs text-gray-600">Surface minimale (ha)
            <input type="number" min="0" step="0.01" value={opts.min_area_ha} onChange={(e) => setOpts({ ...opts, min_area_ha: Number(e.target.value) })} className={input} />
          </label>
          <div className="md:col-span-2 grid grid-cols-2 gap-1.5 pt-4">
            {toggle('fix_geometries', 'Corriger les géométries invalides')}
            {toggle('remove_exact_duplicates', 'Supprimer les doublons exacts')}
            {toggle('remove_full_containment', 'Supprimer les polygones inclus')}
            {toggle('remove_over_threshold', 'Supprimer les superpositions > seuil')}
            {toggle('remove_small', 'Supprimer les petites surfaces')}
            {toggle('remove_slivers', 'Supprimer les slivers')}
            {toggle('detect_overlaps', 'Signaler les superpositions ≤ seuil')}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Taux de superposition = surface commune / plus petite des deux parcelles. En cas de conflit, le polygone conservé est
          le plus valide, puis le plus grand, puis le plus ancien ; l'autre est supprimé.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={run} disabled={!picked || running}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Validation en cours…' : `Valider ${picked ? picked.features.length.toLocaleString('fr-FR') + ' polygone(s)' : ''}`}
          </button>
          {step && <span className="text-xs text-gray-500">{step}</span>}
        </div>
        {error && <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3"><AlertTriangle className="w-4 h-4 mt-0.5" /> {error}</p>}
      </section>

      {s && out && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'En entrée', value: s.initial_count, color: 'text-gray-900' },
              { label: 'Conservés', value: s.final_count, color: 'text-green-700' },
              { label: 'Supprimés', value: s.deleted_count, color: 'text-red-700' },
              { label: 'Corrigés', value: s.geometries_fixed, color: 'text-blue-700' },
              { label: 'Superpositions ≤ seuil', value: s.overlaps_detected, color: 'text-amber-700' },
              { label: 'Surface finale', value: `${s.final_area_ha.toFixed(2)} ha`, color: 'text-primary-700' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-2xl font-black ${k.color}`}>{typeof k.value === 'number' ? k.value.toLocaleString('fr-FR') : k.value}</p>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-6 text-xs">
            <div className="min-w-[240px]">
              <p className="font-semibold text-gray-700 mb-1">Suppressions</p>
              {[['Superposition > seuil', s.over_threshold_removed], ['Doublons exacts', s.duplicates_removed],
                ['Inclusions totales', s.containment_removed], ['Surfaces trop petites', s.small_removed],
                ['Slivers', s.slivers_removed], ['Nuls / irréparables', s.null_removed]].map(([l, v]) => (
                <p key={l as string} className="flex justify-between gap-6"><span className="text-gray-600">{l}</span><b>{(v as number).toLocaleString('fr-FR')}</b></p>
              ))}
            </div>
            <div className="min-w-[220px]">
              <p className="font-semibold text-gray-700 mb-1">Erreurs topologiques d'origine</p>
              {Object.keys(s.topology_errors).length === 0 ? <p className="text-gray-400">Aucune</p> :
                Object.entries(s.topology_errors).map(([k, v]) => (
                  <p key={k} className="flex justify-between gap-6"><span className="text-gray-600">{ERROR_LABEL[k] ?? k}</span><b>{v}</b></p>
                ))}
              <p className="text-gray-400 mt-2">Calcul : {s.processing_time} s</p>
            </div>
            <div className="flex flex-wrap items-start gap-2 ml-auto">
              <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white font-medium"><FileSpreadsheet className="w-4 h-4" /> Rapport Excel</button>
              <button onClick={() => exportGeoJSON('kept')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium"><Download className="w-4 h-4" /> Conservés</button>
              <button onClick={() => exportGeoJSON('removed')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium"><Download className="w-4 h-4" /> Supprimés</button>
            </div>
          </section>

          <ReportExportBar report={report} />

          <section className="relative h-[460px] rounded-2xl overflow-hidden border border-gray-100">
            <MapContainer center={[7.54, -5.55]} zoom={7} className="h-full w-full" preferCanvas>
              <LayersControl position="topright">
                <BaseLayer checked name="Satellite Google"><TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" /></BaseLayer>
                <BaseLayer name="OpenStreetMap"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" /></BaseLayer>
              </LayersControl>
              <FitToData geometries={mapItems.map((m) => m.geometry)} />
              <ResultsLayer items={mapItems} version={`v${mapItems.length}-${s.processing_time}`} />
            </MapContainer>
            <div className="absolute bottom-3 left-3 z-[500] bg-white/95 rounded-xl shadow px-3 py-2 text-xs space-y-0.5">
              {[['#16a34a', 'Conservé'], ['#2563eb', 'Conservé, corrigé'], ['#f59e0b', 'Superposition ≤ seuil'], ['#dc2626', 'Supprimé']].map(([c, l]) => (
                <p key={l} className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: c }} />{l}</p>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-50">
              {([['all', 'Tous'], ['kept', 'Conservés'], ['removed', 'Supprimés'], ['overlap', 'Superpositions'], ['corrected', 'Corrigés']] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setFilter(k); setPage(0) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium ${filter === k ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
              ))}
              <div className="relative ml-auto">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Identifiant…" className="pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>{['Identifiant', 'Statut', 'Motif / référence', 'Surface (ha)', 'Erreurs', 'Superposition'].map((h) => <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.slice(current * PAGE, (current + 1) * PAGE).map((r) => (
                    <tr key={r.index}>
                      <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                      <td className="px-4 py-2">{r.status === 'kept'
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Conservé</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Supprimé</span>}
                        {r.corrected && <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">corrigé</span>}</td>
                      <td className="px-4 py-2 text-xs">{REASON_LABEL[r.reason] ?? ''}{r.ref_id && <span className="text-gray-500"> · {r.ref_id}</span>}</td>
                      <td className="px-4 py-2">{r.area_ha}</td>
                      <td className="px-4 py-2 text-xs text-red-700">{r.errors.map((e) => ERROR_LABEL[e] ?? e).join(', ')}</td>
                      <td className="px-4 py-2 text-xs text-amber-700">{r.is_ovlp === 'OUI' ? `${r.overlap_pct} % · ${r.overlap_ids}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 border-t border-gray-50">
              <span>{rows.length.toLocaleString('fr-FR')} polygone(s)</span>
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

      {!picked && <p className="flex items-center gap-2 text-sm text-gray-500"><ShieldCheck className="w-4 h-4 text-green-600" />Choisissez un fichier ou une source de la coopérative pour lancer la validation.</p>}
    </div>
  )
}
