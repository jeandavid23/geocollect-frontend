import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Scissors, Play, Download, FileSpreadsheet, Search, AlertTriangle, Loader2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import PolygonSourcePicker, { type PickedSource } from '../../components/map/PolygonSourcePicker'
import ResultsLayer, { escapeHtml, type ResultItem } from '../../components/map/ResultsLayer'
import FitToData from '../../components/map/FitToData'
import {
  selfIntersectionApi, DEFAULT_SI_OPTIONS, type SelfIntersectionOptions, type SelfIntersectionResponse, type SelfIntersectionResult,
} from '../../api/selfintersection'
import { withRetry, apiErrorMessage } from '../../utils/retry'
import { exportGeoJSON, exportKML, exportShapefile, exportExcel, type OutFeature } from '../../utils/featureExport'
import ReportExportBar from '../../components/ui/ReportExportBar'
import type { Report } from '../../utils/report'

const { BaseLayer } = LayersControl
const PAGE = 100

const ERROR_LABEL: Record<string, string> = {
  self_intersection: 'Auto-intersection', ring_self_intersection: 'Anneau auto-sécant',
  duplicate_vertices: 'Sommets dupliqués', polygon_hole_error: 'Trou invalide',
  too_few_points: 'Trop peu de sommets', invalid_geometry: 'Géométrie invalide', geometry_collection_error: 'Collection de géométries',
}
const STATUS_LABEL = { kept: 'Conservé', deleted: 'Supprimé', dup_code: 'Doublon de code' }
const STATUS_COLOR = { kept: '#16a34a', deleted: '#dc2626', dup_code: '#9333ea' }
const ID_GUESS = ['field_id', 'fieldid', 'code', 'code_prod', 'id', 'matricule']

function reasonLabel(r: string) {
  if (r === 'geometrie_nulle') return 'Géométrie nulle'
  if (r === 'geometrie_irreparable') return 'Géométrie irréparable'
  if (r === 'doublon_field_id') return 'Doublon de code (plus petite surface)'
  const m = r.match(/^surface_inferieure_(.+)ha$/)
  return m ? `Surface < ${m[1].replace('.', ',')} ha` : r
}

export default function SelfIntersectionPage() {
  const [picked, setPicked] = useState<PickedSource | null>(null)
  const [opts, setOpts] = useState<SelfIntersectionOptions>(DEFAULT_SI_OPTIONS)
  const [out, setOut] = useState<SelfIntersectionResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [step, setStep] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'kept' | 'deleted' | 'dup_code' | 'corrected'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  // Champs disponibles pour le code de déduplication (Field_ID…)
  const fields = useMemo(() => {
    const keys = new Set<string>()
    for (const f of picked?.features.slice(0, 500) ?? []) Object.keys(f.properties ?? {}).forEach((k) => keys.add(k))
    return [...keys]
  }, [picked])

  const choose = (s: PickedSource | null) => {
    setPicked(s); setOut(null); setError(''); setPage(0)
    const keys = new Set<string>()
    for (const f of s?.features.slice(0, 500) ?? []) Object.keys(f.properties ?? {}).forEach((k) => keys.add(k))
    const guess = ID_GUESS.map((g) => [...keys].find((k) => k.toLowerCase() === g)).find(Boolean) ?? ''
    setOpts((o) => ({ ...o, id_field: guess }))
  }

  const run = async () => {
    if (!picked) return
    setRunning(true); setError(''); setOut(null)
    try {
      setStep(`Compression et envoi de ${picked.features.length.toLocaleString('fr-FR')} polygones…`)
      const res = await withRetry(() => selfIntersectionApi.run(
        picked.features.map((f) => ({ id: f.id, geometry: f.geometry, properties: f.properties ?? {} })), opts), 3,
        (n) => setStep(`Serveur occupé, nouvelle tentative ${n}/2…`))
      setOut(res.data); setPage(0)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setRunning(false); setStep('')
    }
  }

  const propsOf = (r: SelfIntersectionResult) => picked?.features[r.index]?.properties ?? {}
  const geomOf = (r: SelfIntersectionResult) => r.geometry ?? picked?.features[r.index]?.geometry

  const rows = useMemo(() => {
    if (!out) return []
    const q = search.trim().toLowerCase()
    return out.results.filter((r) =>
      (filter === 'all' || (filter === 'corrected' ? r.corrected : r.status === filter)) && (!q || r.id.toLowerCase().includes(q)))
  }, [out, filter, search])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pageCount - 1)

  const mapItems = useMemo<ResultItem[]>(() => (out?.results ?? []).flatMap((r) => {
    const g = geomOf(r)
    if (!g) return []
    return [{
      key: `${r.index}-${r.part}`, geometry: g, color: r.status === 'kept' && r.corrected ? '#2563eb' : STATUS_COLOR[r.status], dashed: r.status !== 'kept',
      popup: () => `<div style="font-size:12px;min-width:180px"><b>${escapeHtml(r.id)}</b>${r.part ? ` · partie ${r.part + 1}` : ''}<br/>
        <span style="color:${STATUS_COLOR[r.status]}">${STATUS_LABEL[r.status]}${r.reason ? ' : ' + escapeHtml(reasonLabel(r.reason)) : ''}</span>
        <br/>${r.area_ha} ha${r.corrected ? '<br/><span style="color:#2563eb">Géométrie réparée</span>' : ''}
        ${r.holes_filled ? `<br/>${r.holes_filled} trou(s) comblé(s)` : ''}
        ${r.errors.length ? `<br/>Erreurs d'origine : ${escapeHtml(r.errors.map((e) => ERROR_LABEL[e] ?? e).join(', '))}` : ''}</div>`,
    }]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [out])

  // Attributs de sortie : attributs d'origine + Surface_Ha (comme le plugin) + diagnostic
  const outFeatures = (status: SelfIntersectionResult['status']): OutFeature[] => (out?.results ?? [])
    .filter((r) => r.status === status && geomOf(r))
    .map((r) => ({
      geometry: geomOf(r)!,
      properties: {
        ...propsOf(r), Surface_Ha: r.area_ha,
        ...(status !== 'kept' ? { motif: reasonLabel(r.reason) } : {}),
        corrige: r.corrected ? 'OUI' : 'NON', erreurs: r.errors.map((e) => ERROR_LABEL[e] ?? e).join(', '),
      },
    }))

  const exportReport = () => {
    if (!out) return
    const s = out.summary
    const flat = (r: SelfIntersectionResult) => ({
      identifiant: r.id, partie: r.part + 1, statut: STATUS_LABEL[r.status], motif: r.reason ? reasonLabel(r.reason) : '',
      Surface_Ha: r.area_ha, corrige: r.corrected ? 'OUI' : 'NON', trous_combles: r.holes_filled,
      erreurs: r.errors.map((e) => ERROR_LABEL[e] ?? e).join(', '),
    })
    exportExcel([
      { name: 'Synthèse', rows: [
        ['Self-intersection — GeoCollect (règles du plugin Polygon validator EUDR 2)'], ['Source', picked?.label ?? ''],
        ['Surface minimale (ha)', s.min_area_ha], ['Champ code (déduplication)', s.id_field || '—'], [],
        ['Polygones en entrée', s.initial_count], ['Après éclatement', s.after_split_count], ['Conservés', s.final_count],
        ['Supprimés', s.deleted_count], ['— surfaces trop petites', s.small_removed], ['— nuls / irréparables', s.null_removed],
        ['Doublons de code retirés', s.dup_code_removed], ['Géométries réparées', s.geometries_fixed],
        ['Polygones à trous comblés', s.holes_filled], ['Polygones arrondis / dé-piqués', s.rounded_count],
        ['Surface initiale (ha)', s.initial_area_ha], ['Surface finale (ha)', s.final_area_ha], ['Temps de calcul (s)', s.processing_time],
        [], ['Erreurs topologiques d\'origine'], ...Object.entries(s.topology_errors).map(([k, v]) => [ERROR_LABEL[k] ?? k, v]),
      ] },
      { name: 'Conservés', rows: out.results.filter((r) => r.status === 'kept').map((r) => ({ ...flat(r), ...propsOf(r) })) },
      { name: 'Supprimés', rows: out.results.filter((r) => r.status === 'deleted').map((r) => ({ ...flat(r), ...propsOf(r) })) },
      { name: 'Doublons de code', rows: out.results.filter((r) => r.status === 'dup_code').map((r) => ({ ...flat(r), ...propsOf(r) })) },
    ], 'rapport_self_intersection.xlsx')
  }

  const report = useMemo<Report | null>(() => {
    if (!out) return null
    const s = out.summary
    const flat = (r: SelfIntersectionResult) => ({
      identifiant: r.id, partie: r.part + 1, statut: STATUS_LABEL[r.status], motif: r.reason ? reasonLabel(r.reason) : '',
      Surface_Ha: r.area_ha, corrige: r.corrected ? 'OUI' : 'NON', trous_combles: r.holes_filled,
      erreurs: r.errors.map((e) => ERROR_LABEL[e] ?? e).join(', '),
    })
    const rows = out.results.map((r) => ({ ...flat(r), ...propsOf(r) }) as Report['tables'][number]['rows'][number])
    return {
      kind: 'selfintersection', title: 'Rapport Self-intersection — nettoyage des polygones', source: picked?.label ?? '',
      summary: [
        ['Surface minimale (ha)', s.min_area_ha], ['Champ code (déduplication)', s.id_field || '—'],
        ['Polygones en entrée', s.initial_count], ['Après éclatement', s.after_split_count], ['Conservés', s.final_count],
        ['Supprimés', s.deleted_count], ['— surfaces trop petites', s.small_removed], ['— nuls / irréparables', s.null_removed],
        ['Doublons de code retirés', s.dup_code_removed], ['Géométries réparées', s.geometries_fixed],
        ['Polygones à trous comblés', s.holes_filled], ['Arrondis / dé-piqués', s.rounded_count],
        ['Surface initiale (ha)', s.initial_area_ha], ['Surface finale (ha)', s.final_area_ha],
        ...Object.entries(s.topology_errors).map(([k, v]) => [`Erreur d'origine : ${ERROR_LABEL[k] ?? k}`, v] as [string, number]),
      ],
      tables: [
        { name: 'Tous les polygones', rows },
        { name: 'Conservés', rows: rows.filter((_, i) => out.results[i].status === 'kept') },
        { name: 'Supprimés', rows: rows.filter((_, i) => out.results[i].status === 'deleted') },
        { name: 'Doublons de code', rows: rows.filter((_, i) => out.results[i].status === 'dup_code') },
      ],
      features: outFeatures('kept'), nameField: opts.id_field || undefined,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out])

  const input = 'w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const toggle = (key: keyof SelfIntersectionOptions, label: string) => (
    <label className="flex items-center gap-2 text-xs text-gray-700">
      <input type="checkbox" checked={Boolean(opts[key])} onChange={(e) => setOpts({ ...opts, [key]: e.target.checked })} /> {label}
    </label>
  )
  const s = out?.summary
  const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium'

  return (
    <div className="p-6 space-y-5">
      <Header title="Self-intersection" subtitle="Nettoyage du plugin Polygon validator EUDR 2 · auto-intersections, trous, pics, petites surfaces, doublons de code" />

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">1. Polygones à nettoyer</p>
        <PolygonSourcePicker picked={picked} onPicked={choose} />
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">2. Paramètres</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-xs text-gray-600">Supprimer les polygones de 0 à (ha)
            <input type="number" min="0" step="0.01" value={opts.min_area_ha} onChange={(e) => setOpts({ ...opts, min_area_ha: Number(e.target.value) })} className={input} />
          </label>
          <label className="text-xs text-gray-600">Rayon d'arrondi / dé-piquage (m)
            <input type="number" min="0" step="0.5" value={opts.round_radius_m} disabled={!opts.round_corners} onChange={(e) => setOpts({ ...opts, round_radius_m: Number(e.target.value) })} className={input} />
          </label>
          <label className="text-xs text-gray-600">Combler les trous jusqu'à (ha, 0 = tous)
            <input type="number" min="0" step="0.01" value={opts.fill_holes_max_ha} disabled={!opts.fill_holes} onChange={(e) => setOpts({ ...opts, fill_holes_max_ha: Number(e.target.value) })} className={input} />
          </label>
          <label className="text-xs text-gray-600">Champ code (Field_ID) pour les doublons
            <select value={opts.id_field} disabled={!opts.remove_dup_code} onChange={(e) => setOpts({ ...opts, id_field: e.target.value })} className={input}>
              <option value="">— aucun —</option>
              {fields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {toggle('fix_geometries', 'Réparer les géométries (auto-intersections, sommets dupliqués)')}
          {toggle('fill_holes', 'Combler les trous intérieurs')}
          {toggle('multipart_to_single', 'Éclater les multi-polygones')}
          {toggle('round_corners', 'Arrondir les bouts et retirer les pics')}
          {toggle('remove_dup_code', 'Dédupliquer par code (garde la plus grande surface)')}
        </div>
        <p className="text-xs text-gray-500">
          Ordre du plugin : réparation → trous → éclatement → arrondi / pics → Surface_Ha et petites surfaces → doublons de code.
          Les surfaces sont géodésiques (hectares réels).
        </p>
        <div className="flex items-center gap-3">
          <button onClick={run} disabled={!picked || running}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Traitement en cours…' : `Nettoyer ${picked ? picked.features.length.toLocaleString('fr-FR') + ' polygone(s)' : ''}`}
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
              { label: 'Après éclatement', value: s.after_split_count, color: 'text-gray-700' },
              { label: 'Conservés', value: s.final_count, color: 'text-green-700' },
              { label: 'Supprimés', value: s.deleted_count, color: 'text-red-700' },
              { label: 'Doublons de code', value: s.dup_code_removed, color: 'text-purple-700' },
              { label: 'Surface finale', value: `${s.final_area_ha.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ha`, color: 'text-primary-700' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-2xl font-black ${k.color}`}>{typeof k.value === 'number' ? k.value.toLocaleString('fr-FR') : k.value}</p>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-6 text-xs">
            <div className="min-w-[240px]">
              <p className="font-semibold text-gray-700 mb-1">Traitements</p>
              {[['Géométries réparées', s.geometries_fixed], ['Polygones à trous comblés', s.holes_filled],
                ['Arrondis / dé-piqués', s.rounded_count], [`Surfaces < ${s.min_area_ha} ha supprimées`, s.small_removed],
                ['Nuls / irréparables', s.null_removed]].map(([l, v]) => (
                <p key={l as string} className="flex justify-between gap-6"><span className="text-gray-600">{l}</span><b>{(v as number).toLocaleString('fr-FR')}</b></p>
              ))}
            </div>
            <div className="min-w-[220px]">
              <p className="font-semibold text-gray-700 mb-1">Erreurs topologiques d'origine</p>
              {Object.keys(s.topology_errors).length === 0 ? <p className="text-gray-400">Aucune</p> :
                Object.entries(s.topology_errors).map(([k, v]) => (
                  <p key={k} className="flex justify-between gap-6"><span className="text-gray-600">{ERROR_LABEL[k] ?? k}</span><b>{v.toLocaleString('fr-FR')}</b></p>
                ))}
              <p className="text-gray-400 mt-2">Calcul : {s.processing_time} s · surface initiale {s.initial_area_ha.toLocaleString('fr-FR')} ha</p>
            </div>
            <div className="flex flex-wrap items-start gap-2 ml-auto max-w-[520px] justify-end">
              <button onClick={exportReport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white font-medium"><FileSpreadsheet className="w-4 h-4" /> Rapport Excel</button>
              <button onClick={() => exportGeoJSON(outFeatures('kept'), 'polygones_nettoyes.geojson')} className={btn}><Download className="w-4 h-4" /> Nettoyés GeoJSON</button>
              <button onClick={() => exportKML(outFeatures('kept'), 'polygones_nettoyes.kml', opts.id_field || undefined)} className={btn}><Download className="w-4 h-4" /> KML</button>
              <button onClick={() => exportShapefile(outFeatures('kept'), 'polygones_nettoyes_shp.zip', 'polygones_nettoyes')} className={btn}><Download className="w-4 h-4" /> Shapefile</button>
              <button onClick={() => exportGeoJSON(outFeatures('deleted'), 'polygones_supprimes.geojson')} className={btn}><Download className="w-4 h-4" /> Supprimés</button>
              <button onClick={() => exportGeoJSON(outFeatures('dup_code'), 'doublons_code.geojson')} className={btn}><Download className="w-4 h-4" /> Doublons</button>
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
              <ResultsLayer items={mapItems} version={`si${mapItems.length}-${s.processing_time}`} />
            </MapContainer>
            <div className="absolute bottom-3 left-3 z-[500] bg-white/95 rounded-xl shadow px-3 py-2 text-xs space-y-0.5">
              {[['#16a34a', 'Conservé'], ['#2563eb', 'Conservé, réparé'], ['#9333ea', 'Doublon de code'], ['#dc2626', 'Supprimé']].map(([c, l]) => (
                <p key={l} className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: c }} />{l}</p>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-50">
              {([['all', 'Tous'], ['kept', 'Conservés'], ['deleted', 'Supprimés'], ['dup_code', 'Doublons de code'], ['corrected', 'Réparés']] as const).map(([k, l]) => (
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
                  <tr>{['Identifiant', 'Partie', 'Statut', 'Motif', 'Surface_Ha', 'Erreurs d\'origine'].map((h) => <th key={h} className="text-left px-4 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.slice(current * PAGE, (current + 1) * PAGE).map((r) => (
                    <tr key={`${r.index}-${r.part}`}>
                      <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                      <td className="px-4 py-2 text-xs">{r.part + 1}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === 'kept' ? 'bg-green-100 text-green-700' : r.status === 'dup_code' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>{STATUS_LABEL[r.status]}</span>
                        {r.corrected && <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">réparé</span>}
                      </td>
                      <td className="px-4 py-2 text-xs">{r.reason ? reasonLabel(r.reason) : ''}</td>
                      <td className="px-4 py-2">{r.area_ha}</td>
                      <td className="px-4 py-2 text-xs text-red-700">{r.errors.map((e) => ERROR_LABEL[e] ?? e).join(', ')}</td>
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

      {!picked && <p className="flex items-center gap-2 text-sm text-gray-500"><Scissors className="w-4 h-4 text-green-600" />Choisissez un fichier ou une source de la coopérative pour lancer le nettoyage.</p>}
    </div>
  )
}
