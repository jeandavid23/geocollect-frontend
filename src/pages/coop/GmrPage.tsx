import { useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Link2, Play, Download, FileSpreadsheet, AlertTriangle, Loader2, BookOpen, Upload, Search, Wand2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import PolygonSourcePicker, { type PickedSource } from '../../components/map/PolygonSourcePicker'
import ResultsLayer, { escapeHtml, type ResultItem } from '../../components/map/ResultsLayer'
import FitToData from '../../components/map/FitToData'
import { registryApi, type CellValue } from '../../api/registry'
import api from '../../api/client'
import { WorkbookEngine, isError } from '../../utils/spreadsheet/engine'
import { readWorkbook, detectHeaderRow, headersOf } from '../../utils/excelImport'
import { apiErrorMessage } from '../../utils/retry'
import { exportGeoJSON, exportKML, exportShapefile, exportExcel, type OutFeature } from '../../utils/featureExport'
import ReportExportBar from '../../components/ui/ReportExportBar'
import type { Report } from '../../utils/report'

const { BaseLayer } = LayersControl
const PAGE = 100

interface RegSheet { name: string; values: CellValue[][] }
interface RegSource { kind: 'registry' | 'file'; label: string; sheets: RegSheet[] }

interface GmrResult {
  matched: { index: number; key: string; row: number }[]      // polygone → ligne du registre
  noMatch: number[]                                            // polygones sans ligne du registre
  unmatchedRows: number[]                                      // lignes du registre sans polygone
  stats: { matched: number; no_match: number; excel_total: number; excel_unmatched: number; duplicates: number; empty: number }
  columns: { header: string; out: string }[]                   // colonnes du registre ajoutées
}

/** Clé de jointure normalisée, comme normalize_key du plugin Polygon & GMR. */
export function normalizeKey(v: unknown, ignoreCase: boolean): string | null {
  if (v === null || v === undefined) return null
  let s: string
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    s = Number.isInteger(v) ? String(v) : String(v)
  } else s = String(v).trim()
  if (!s || s.toUpperCase() === 'NULL') return null
  if (/^-?\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '')
  return ignoreCase ? s.toLowerCase() : s
}

// Plugin : si plus de la moitié des entêtes sont génériques (Field1, Colonne A…), les vrais titres sont sur la ligne suivante
const GENERIC = /^(field|champ|colonne|column|col)\s*_?\s*[a-z]?\d*$/i
function headerRowOf(values: CellValue[][]) {
  const first = values.findIndex((r) => r.some((c) => c !== null && c !== ''))
  if (first < 0) return 0
  const h = values[first].filter((c) => c !== null && c !== '')
  if (h.length && h.filter((c) => GENERIC.test(String(c).trim())).length > h.length / 2) return first + 1
  return Math.max(first, detectHeaderRow(values))
}

export default function GmrPage() {
  const [picked, setPicked] = useState<PickedSource | null>(null)
  const [reg, setReg] = useState<RegSource | null>(null)
  const [regBusy, setRegBusy] = useState(false)
  const [regError, setRegError] = useState('')
  const [sheetIdx, setSheetIdx] = useState(0)
  const [headerRow, setHeaderRow] = useState(0)
  const [polyField, setPolyField] = useState('')
  const [regCol, setRegCol] = useState(-1)
  const [ignoreCase, setIgnoreCase] = useState(true)
  const [addColumns, setAddColumns] = useState(true)
  const [out, setOut] = useState<GmrResult | null>(null)
  const [filter, setFilter] = useState<'matched' | 'no_match' | 'reg'>('matched')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const sheet = reg?.sheets[sheetIdx]
  const headers = useMemo(() => (sheet ? headersOf(sheet.values, headerRow) : []), [sheet, headerRow])
  const dataRows = useMemo(() => {
    if (!sheet) return [] as { row: number; cells: CellValue[] }[]
    return sheet.values.slice(headerRow + 1)
      .map((cells, i) => ({ row: headerRow + 2 + i, cells }))          // n° de ligne Excel (1 = première ligne)
      .filter((r) => r.cells.some((c) => c !== null && c !== ''))
  }, [sheet, headerRow])
  const polyFields = useMemo(() => {
    const keys = new Set<string>()
    for (const f of picked?.features.slice(0, 500) ?? []) Object.keys(f.properties ?? {}).forEach((k) => keys.add(k))
    return [...keys]
  }, [picked])

  /** Couple (champ polygone, colonne registre) qui donne le plus de correspondances. */
  const autoDetect = (features = picked?.features, hdr = headers, rows = dataRows, fields = polyFields) => {
    if (!features?.length || !rows.length) return
    const sample = features.slice(0, 3000)
    let best = { f: '', c: -1, n: 0 }
    const colSets = hdr.map((_, c) => new Set(rows.map((r) => normalizeKey(r.cells[c], true)).filter(Boolean)))
    for (const f of fields) {
      const vals = sample.map((x) => normalizeKey(x.properties?.[f], true)).filter(Boolean) as string[]
      if (!vals.length) continue
      colSets.forEach((set, c) => {
        if (!set.size) return
        let n = 0
        for (const v of vals) if (set.has(v)) n++
        if (n > best.n) best = { f, c, n }
      })
    }
    if (best.n > 0) { setPolyField(best.f); setRegCol(best.c) }
  }

  const loadSheets = (src: RegSource) => {
    setReg(src); setOut(null); setPage(0)
    const i = Math.max(0, src.sheets.findIndex((s) => s.values.length > 1))
    setSheetIdx(i)
    setHeaderRow(headerRowOf(src.sheets[i]?.values ?? []))
    setRegCol(-1)
  }

  const loadRegistry = async () => {
    setRegBusy(true); setRegError('')
    try {
      const { data } = await registryApi.list()
      if (!data.length) throw new Error('Le registre de la coopérative est vide. Importez-le d\'abord dans « Registre ».')
      // Valeurs calculées (formules évaluées comme dans le tableur)
      const sorted = [...data].sort((a, b) => a.position - b.position)
      const engine = new WorkbookEngine(sorted.map((s) => ({ name: s.name, data: s.data })))
      const sheets = sorted.map((s) => ({
        name: s.name,
        values: s.data.map((row, r) => row.map((cell, c) => {
          if (typeof cell !== 'string' || !cell.startsWith('=')) return cell
          const v = engine.getValue(s.name, r, c)
          return isError(v) ? null : (v as CellValue)
        })),
      }))
      loadSheets({ kind: 'registry', label: 'Registre de la coopérative', sheets })
    } catch (err) {
      setRegError(err instanceof Error && !('response' in err) ? err.message : apiErrorMessage(err))
    } finally {
      setRegBusy(false)
    }
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setRegBusy(true); setRegError('')
    try {
      const wb = await readWorkbook(file)
      if (!wb.sheets.some((s) => s.values.length)) throw new Error('Classeur vide.')
      loadSheets({ kind: 'file', label: file.name, sheets: wb.sheets.map((s) => ({ name: s.name, values: s.values })) })
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'Fichier illisible.')
    } finally {
      setRegBusy(false)
    }
  }

  // ─── Jointure (GmrJoiner du plugin) ─────────────────────────────────────
  const run = () => {
    if (!picked || !sheet || !polyField || regCol < 0) return
    const index = new Map<string, number>()       // clé → rang dans dataRows (1re occurrence)
    let duplicates = 0, empty = 0
    dataRows.forEach((r, i) => {
      const k = normalizeKey(r.cells[regCol], ignoreCase)
      if (k === null) { empty++; return }
      if (index.has(k)) { duplicates++; return }
      index.set(k, i)
    })
    const matched: GmrResult['matched'] = []
    const noMatch: number[] = []
    const used = new Set<number>()
    picked.features.forEach((f, i) => {
      const k = normalizeKey(f.properties?.[polyField], ignoreCase)
      const hit = k === null ? undefined : index.get(k)
      if (hit === undefined) { noMatch.push(i); return }
      matched.push({ index: i, key: k!, row: hit })
      used.add(hit)
    })
    const unmatchedRows = [...index.values()].filter((i) => !used.has(i))
    const polyKeys = new Set(polyFields)
    const columns = headers.map((h) => ({ header: h, out: polyKeys.has(h) ? `xl_${h}` : h }))
    setOut({
      matched, noMatch, unmatchedRows, columns,
      stats: { matched: matched.length, no_match: noMatch.length, excel_total: index.size, excel_unmatched: unmatchedRows.length, duplicates, empty },
    })
    setFilter('matched'); setPage(0)
    api.post('/parcels/gmr/log/', { count: picked.features.length, matched: matched.length, no_match: noMatch.length }).catch(() => {})   // suivi d'utilisation
  }

  const regRecord = (i: number) => Object.fromEntries((out?.columns ?? []).map((c, j) => [c.out, dataRows[i]?.cells[j] ?? '']))
  const matchedFeatures = (): OutFeature[] => (out?.matched ?? []).map((m) => {
    const f = picked!.features[m.index]
    return { geometry: f.geometry, properties: { ...f.properties, ...(addColumns ? regRecord(m.row) : {}) } }
  })
  const noMatchFeatures = (): OutFeature[] => (out?.noMatch ?? []).map((i) => ({ geometry: picked!.features[i].geometry, properties: picked!.features[i].properties }))
  const regOrphans = () => (out?.unmatchedRows ?? []).map((i) => ({ ligne_excel: dataRows[i].row, ...Object.fromEntries(headers.map((h, j) => [h, dataRows[i].cells[j] ?? ''])) }))

  const exportReport = () => {
    if (!out) return
    const s = out.stats
    exportExcel([
      { name: 'Synthèse', rows: [
        ['Polygon & GMR — GeoCollect (règles du plugin Polygon & GMR)'], ['Polygones', picked?.label ?? ''],
        ['Registre', `${reg?.label ?? ''} · feuille « ${sheet?.name ?? ''} »`], ['Champ polygone', polyField], ['Colonne du registre', headers[regCol] ?? ''],
        ['Casse ignorée', ignoreCase ? 'OUI' : 'NON'], [],
        ['Polygones concordants (sortie)', s.matched], ['Polygones sans registre', s.no_match],
        ['Lignes du registre (clés uniques)', s.excel_total], ['Lignes du registre sans polygone', s.excel_unmatched],
        ['Doublons de clé dans le registre (1re ligne retenue)', s.duplicates], ['Lignes du registre sans clé', s.empty],
      ] },
      { name: 'Polygones concordants', rows: matchedFeatures().map((f) => f.properties) },
      { name: 'Polygones sans registre', rows: noMatchFeatures().map((f) => f.properties) },
      { name: 'Registre sans polygone', rows: regOrphans() },
    ], 'rapport_polygon_gmr.xlsx')
  }

  const report = useMemo<Report | null>(() => {
    if (!out) return null
    const s = out.stats
    type Row = Report['tables'][number]['rows'][number]
    return {
      kind: 'gmr', title: 'Rapport Polygon & GMR — polygones ayant un registre', source: `${picked?.label ?? ''} × ${reg?.label ?? ''} (feuille « ${sheet?.name ?? ''} »)`,
      summary: [
        ['Champ polygone', polyField], ['Colonne du registre', headers[regCol] ?? ''], ['Casse ignorée', ignoreCase ? 'OUI' : 'NON'],
        ['Polygones concordants (sortie)', s.matched], ['Polygones sans registre', s.no_match],
        ['Clés uniques du registre', s.excel_total], ['Lignes du registre sans polygone', s.excel_unmatched],
        ['Doublons de clé dans le registre', s.duplicates], ['Lignes du registre sans clé', s.empty],
      ],
      tables: [
        { name: 'Polygones concordants', rows: matchedFeatures().map((f) => f.properties as Row) },
        { name: 'Polygones sans registre', rows: noMatchFeatures().map((f) => f.properties as Row) },
        { name: 'Registre sans polygone', rows: regOrphans() as Row[] },
      ],
      features: matchedFeatures(), nameField: polyField,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out])

  const mapItems = useMemo<ResultItem[]>(() => {
    if (!out || !picked) return []
    const items: ResultItem[] = out.matched.map((m) => ({
      key: `m${m.index}`, geometry: picked.features[m.index].geometry, color: '#16a34a',
      popup: () => `<div style="font-size:12px;min-width:200px"><b>${escapeHtml(picked.features[m.index].id)}</b><br/>
        <span style="color:#16a34a">Registre trouvé (ligne ${dataRows[m.row]?.row})</span><br/>${
        headers.slice(0, 8).map((h, j) => `${escapeHtml(h)} : <b>${escapeHtml(String(dataRows[m.row]?.cells[j] ?? ''))}</b>`).join('<br/>')}</div>`,
    }))
    for (const i of out.noMatch) items.push({
      key: `n${i}`, geometry: picked.features[i].geometry, color: '#9ca3af', dashed: true,
      popup: () => `<div style="font-size:12px"><b>${escapeHtml(picked.features[i].id)}</b><br/><span style="color:#dc2626">Aucune ligne du registre</span><br/>${escapeHtml(polyField)} : ${escapeHtml(String(picked.features[i].properties?.[polyField] ?? '—'))}</div>`,
    })
    return items
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out])

  const tableRows = useMemo(() => {
    if (!out || !picked) return [] as { key: string; cells: string[] }[]
    const q = search.trim().toLowerCase()
    let rows: { key: string; cells: string[] }[]
    if (filter === 'matched') rows = out.matched.map((m) => ({ key: `m${m.index}`, cells: [picked.features[m.index].id, m.key, String(dataRows[m.row].row), ...headers.slice(0, 6).map((_, j) => String(dataRows[m.row].cells[j] ?? ''))] }))
    else if (filter === 'no_match') rows = out.noMatch.map((i) => ({ key: `n${i}`, cells: [picked.features[i].id, String(picked.features[i].properties?.[polyField] ?? '')] }))
    else rows = out.unmatchedRows.map((i) => ({ key: `r${i}`, cells: [String(dataRows[i].row), String(dataRows[i].cells[regCol] ?? ''), ...headers.slice(0, 6).map((_, j) => String(dataRows[i].cells[j] ?? ''))] }))
    return q ? rows.filter((r) => r.cells.some((c) => c.toLowerCase().includes(q))) : rows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out, filter, search])
  const tableHead = filter === 'matched' ? ['Polygone', 'Clé', 'Ligne', ...headers.slice(0, 6)]
    : filter === 'no_match' ? ['Polygone', polyField] : ['Ligne', headers[regCol] ?? 'Clé', ...headers.slice(0, 6)]
  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE))
  const current = Math.min(page, pageCount - 1)

  const input = 'w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const card = (active: boolean) => `flex-1 min-w-[200px] text-left p-4 rounded-2xl border-2 transition ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white hover:border-primary-200'}`
  const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 font-medium'
  const s = out?.stats
  const ready = picked && sheet && polyField && regCol >= 0

  return (
    <div className="p-6 space-y-5">
      <Header title="Polygon & GMR" subtitle="Croisement du registre de la coopérative avec ses polygones · sortie : les polygones qui ont un registre, enrichis" />

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">1. Polygones</p>
        <PolygonSourcePicker picked={picked} onPicked={(p) => { setPicked(p); setOut(null); setPolyField('') }} />
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">2. Registre</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={loadRegistry} disabled={regBusy} className={card(reg?.kind === 'registry')}>
            <p className="flex items-center gap-2 font-semibold text-gray-900 text-sm"><BookOpen className="w-4 h-4 text-primary-600" />Registre de la coopérative</p>
            <p className="text-xs text-gray-500 mt-1">Le classeur de la page « Registre » (formules calculées)</p>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={regBusy} className={card(reg?.kind === 'file')}>
            <p className="flex items-center gap-2 font-semibold text-gray-900 text-sm"><Upload className="w-4 h-4 text-green-600" />Fichier Excel</p>
            <p className="text-xs text-gray-500 mt-1">.xlsx, .xls, .csv, .ods</p>
          </button>
        </div>
        {regBusy && <p className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Lecture du registre…</p>}
        {regError && <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3"><AlertTriangle className="w-4 h-4 mt-0.5" /> {regError}</p>}
        {reg && sheet && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600">Feuille
              <select value={sheetIdx} onChange={(e) => { const i = Number(e.target.value); setSheetIdx(i); setHeaderRow(headerRowOf(reg.sheets[i].values)); setRegCol(-1); setOut(null) }} className={input}>
                {reg.sheets.map((sh, i) => <option key={sh.name + i} value={i}>{sh.name} ({Math.max(0, sh.values.length - 1)} lignes)</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-600">Ligne des entêtes
              <input type="number" min="1" max={sheet.values.length} value={headerRow + 1} onChange={(e) => { setHeaderRow(Math.max(0, Number(e.target.value) - 1)); setRegCol(-1); setOut(null) }} className={input} />
            </label>
            <p className="text-xs text-gray-500 self-end pb-2"><b>{reg.label}</b> · {dataRows.length.toLocaleString('fr-FR')} ligne(s), {headers.length} colonne(s)</p>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-900">3. Champs de jointure</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs text-gray-600">Champ des polygones
            <select value={polyField} disabled={!picked} onChange={(e) => { setPolyField(e.target.value); setOut(null) }} className={input}>
              <option value="">— choisir —</option>
              {polyFields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Colonne du registre
            <select value={regCol} disabled={!sheet} onChange={(e) => { setRegCol(Number(e.target.value)); setOut(null) }} className={input}>
              <option value={-1}>— choisir —</option>
              {headers.map((h, i) => <option key={h + i} value={i}>{h}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button onClick={() => autoDetect()} disabled={!picked || !sheet} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary-200 text-primary-700 text-sm font-medium disabled:opacity-40">
              <Wand2 className="w-4 h-4" /> Détecter automatiquement
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={ignoreCase} onChange={(e) => { setIgnoreCase(e.target.checked); setOut(null) }} /> Ignorer la casse (« ab12 » = « AB12 »)</label>
          <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={addColumns} onChange={(e) => setAddColumns(e.target.checked)} /> Ajouter les colonnes du registre aux polygones (préfixe « xl_ » si le nom existe déjà)</label>
        </div>
        <p className="text-xs text-gray-500">Les clés sont comparées sans espaces autour ; « 12 », « 12.0 » et 12 sont identiques. Si une clé apparaît plusieurs fois dans le registre, la première ligne est retenue.</p>
        <button onClick={run} disabled={!ready}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
          <Play className="w-4 h-4" /> Croiser {picked ? `${picked.features.length.toLocaleString('fr-FR')} polygone(s)` : ''} {sheet ? `× ${dataRows.length.toLocaleString('fr-FR')} ligne(s)` : ''}
        </button>
      </section>

      {s && out && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Polygones concordants', value: s.matched, color: 'text-green-700' },
              { label: 'Polygones sans registre', value: s.no_match, color: 'text-gray-600' },
              { label: 'Clés du registre', value: s.excel_total, color: 'text-gray-900' },
              { label: 'Registre sans polygone', value: s.excel_unmatched, color: 'text-amber-700' },
              { label: 'Doublons de clé', value: s.duplicates, color: 'text-purple-700' },
              { label: 'Lignes sans clé', value: s.empty, color: 'text-red-700' },
            ].map((k) => (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-2xl font-black ${k.color}`}>{k.value.toLocaleString('fr-FR')}</p>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-2 text-xs">
            <p className="font-semibold text-gray-700 mr-2">Fichier de sortie — polygones qui ont un registre :</p>
            <button onClick={() => exportGeoJSON(matchedFeatures(), 'polygones_registre.geojson')} disabled={!s.matched} className={`${btn} disabled:opacity-40`}><Download className="w-4 h-4" /> GeoJSON</button>
            <button onClick={() => exportKML(matchedFeatures(), 'polygones_registre.kml', polyField)} disabled={!s.matched} className={`${btn} disabled:opacity-40`}><Download className="w-4 h-4" /> KML</button>
            <button onClick={() => exportShapefile(matchedFeatures(), 'polygones_registre_shp.zip', 'polygones_registre')} disabled={!s.matched} className={`${btn} disabled:opacity-40`}><Download className="w-4 h-4" /> Shapefile</button>
            <button onClick={exportReport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white font-medium"><FileSpreadsheet className="w-4 h-4" /> Rapport Excel</button>
            <span className="text-gray-300 mx-1">|</span>
            <button onClick={() => exportGeoJSON(noMatchFeatures(), 'polygones_sans_registre.geojson')} disabled={!s.no_match} className={`${btn} disabled:opacity-40`}><Download className="w-4 h-4" /> Sans registre</button>
          </section>

          <ReportExportBar report={report} />

          <section className="relative h-[460px] rounded-2xl overflow-hidden border border-gray-100">
            <MapContainer center={[7.54, -5.55]} zoom={7} className="h-full w-full" preferCanvas>
              <LayersControl position="topright">
                <BaseLayer checked name="Satellite Google"><TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" /></BaseLayer>
                <BaseLayer name="OpenStreetMap"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" /></BaseLayer>
              </LayersControl>
              <FitToData geometries={mapItems.map((m) => m.geometry)} />
              <ResultsLayer items={mapItems} version={`gmr${s.matched}-${s.no_match}-${polyField}-${regCol}`} />
            </MapContainer>
            <div className="absolute bottom-3 left-3 z-[500] bg-white/95 rounded-xl shadow px-3 py-2 text-xs space-y-0.5">
              {[['#16a34a', 'Registre trouvé'], ['#9ca3af', 'Sans registre']].map(([c, l]) => (
                <p key={l} className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: c }} />{l}</p>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-50">
              {([['matched', `Concordants (${s.matched})`], ['no_match', `Polygones sans registre (${s.no_match})`], ['reg', `Registre sans polygone (${s.excel_unmatched})`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setFilter(k); setPage(0) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium ${filter === k ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
              ))}
              {filter === 'reg' && s.excel_unmatched > 0 && (
                <button onClick={() => exportExcel([{ name: 'Registre sans polygone', rows: regOrphans() }], 'registre_sans_polygone.xlsx')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs"><Download className="w-3.5 h-3.5" /> Excel</button>
              )}
              <div className="relative ml-auto">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Rechercher…" className="pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>{tableHead.map((h, i) => <th key={h + i} className="text-left px-4 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tableRows.slice(current * PAGE, (current + 1) * PAGE).map((r) => (
                    <tr key={r.key}>{r.cells.map((c, i) => <td key={i} className={`px-4 py-2 text-xs whitespace-nowrap ${i === 0 ? 'font-mono' : ''}`}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 border-t border-gray-50">
              <span>{tableRows.length.toLocaleString('fr-FR')} ligne(s)</span>
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

      {!picked && <p className="flex items-center gap-2 text-sm text-gray-500"><Link2 className="w-4 h-4 text-green-600" />Choisissez les polygones et le registre, puis le champ commun (Field_ID, code producteur…).</p>}
    </div>
  )
}
