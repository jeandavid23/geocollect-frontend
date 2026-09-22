import { useState, useRef } from 'react'
import {
  TreePine, Upload, Loader2, AlertTriangle, Download, FileSpreadsheet,
  Map as MapIcon, ShieldCheck, ShieldAlert, ShieldX, HelpCircle, X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseGeoFile, type ImportedFeature } from '../../utils/geoImport'
import { deforestationApi, type DeforestationResult, type RiskLevel } from '../../api/deforestation'
import { downloadBlob } from '../../utils/geoExport'

const RISK_STYLES: Record<RiskLevel, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', icon: <ShieldX className="w-4 h-4" />, label: 'Élevé' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <ShieldAlert className="w-4 h-4" />, label: 'Moyen' },
  low: { bg: 'bg-green-100', text: 'text-green-700', icon: <ShieldCheck className="w-4 h-4" />, label: 'Faible' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-600', icon: <HelpCircle className="w-4 h-4" />, label: 'Indéterminé' },
}

function RiskBadge({ risk, label }: { risk: RiskLevel; label: string }) {
  const s = RISK_STYLES[risk] ?? RISK_STYLES.unknown
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.icon}
      {label || s.label}
    </span>
  )
}

const YEARS = [2020, 2021, 2022, 2023]

export default function DeforestationPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [features, setFeatures] = useState<ImportedFeature[]>([])
  const [fileName, setFileName] = useState('')
  const [cutoffYear, setCutoffYear] = useState(2020)
  const [results, setResults] = useState<DeforestationResult[]>([])
  const [summary, setSummary] = useState<Record<RiskLevel, number> | null>(null)
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setError('')
    setResults([])
    setSummary(null)
    setParsing(true)
    try {
      const parsed = await parseGeoFile(file)
      if (parsed.length === 0) {
        setError("Aucune géométrie exploitable trouvée dans le fichier. Vérifiez le format (points lat/lng pour Excel, géométries pour KML/GeoJSON/SHP).")
        setFeatures([])
      } else {
        setFeatures(parsed)
        setFileName(file.name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fichier illisible.')
      setFeatures([])
    } finally {
      setParsing(false)
    }
  }

  const runAnalysis = async () => {
    setError('')
    setLoading(true)
    try {
      const { data } = await deforestationApi.analyze(features, cutoffYear)
      setResults(data.results)
      setSummary(data.summary)
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } }
      if (err.response?.status === 503) {
        setError(err.response.data?.detail || "Le service Google Earth Engine n'est pas encore configuré sur le serveur.")
      } else {
        setError(err.response?.data?.detail || "Échec de l'analyse. Réessayez.")
      }
    } finally {
      setLoading(false)
    }
  }

  const exportExcel = () => {
    const rows = results.map((r) => ({
      'Nom': r.name,
      'Type': r.geometry_type,
      'Superficie (ha)': r.area_ha ?? '',
      'Forêt 2000 (%)': r.forest_pct ?? '',
      [`Perte après ${cutoffYear} (%)`]: r.loss_recent_pct ?? '',
      'Perte totale (%)': r.loss_total_pct ?? '',
      'Perte récente (ha)': r.loss_recent_ha ?? '',
      'Alertes GFW (ha)': r.alert_area_ha ?? '',
      'Niveau de risque': r.risk_label,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Déforestation')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'analyse_deforestation.xlsx')
  }

  const exportGeoJSON = () => {
    const fc = {
      type: 'FeatureCollection',
      features: results.map((r, i) => ({
        type: 'Feature',
        geometry: features[i]?.geometry ?? null,
        properties: {
          name: r.name,
          area_ha: r.area_ha,
          forest_pct: r.forest_pct,
          loss_recent_pct: r.loss_recent_pct,
          loss_total_pct: r.loss_total_pct,
          alert_area_ha: r.alert_area_ha,
          risk: r.risk,
          risk_label: r.risk_label,
        },
      })),
    }
    downloadBlob(JSON.stringify(fc, null, 2), 'analyse_deforestation.geojson', 'application/geo+json')
  }

  const summaryCards: { key: RiskLevel; label: string; color: string }[] = [
    { key: 'high', label: 'Risque élevé', color: 'text-red-600' },
    { key: 'medium', label: 'Risque moyen', color: 'text-amber-600' },
    { key: 'low', label: 'Risque faible', color: 'text-green-600' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <TreePine className="w-6 h-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analyse de déforestation EUDR</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Importez vos parcelles (KML, GeoJSON, Shapefile .zip ou Excel de points). L'analyse s'appuie sur
            Hansen <span className="font-medium">lossyear</span> et les alertes <span className="font-medium">Global Forest Watch</span>.
            Le niveau de risque est calculé selon la perte de couvert après le seuil EUDR.
          </p>
        </div>
      </div>

      {/* Import */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <input
          ref={inputRef}
          type="file"
          accept=".geojson,.json,.kml,.zip,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/40 transition"
        >
          {parsing ? (
            <Loader2 className="w-8 h-8 text-green-600 mx-auto animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-gray-400 mx-auto" />
          )}
          <p className="mt-3 font-medium text-gray-700">
            {parsing ? 'Lecture du fichier…' : 'Cliquez pour importer un fichier'}
          </p>
          <p className="text-xs text-gray-400 mt-1">KML · GeoJSON · Shapefile (.zip) · Excel de points (.xlsx)</p>
        </div>

        {features.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
              <MapIcon className="w-4 h-4" />
              {features.length} entité(s) — {fileName}
            </span>
            <label className="text-sm text-gray-600 flex items-center gap-2">
              Seuil EUDR :
              <select
                value={cutoffYear}
                onChange={(e) => setCutoffYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TreePine className="w-4 h-4" />}
              {loading ? 'Analyse en cours…' : "Lancer l'analyse"}
            </button>
          </div>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="flex-1">{error}</p>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Résumé */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {summaryCards.map((c) => (
            <div key={c.key} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className={`text-3xl font-bold ${c.color}`}>{summary[c.key] ?? 0}</p>
              <p className="text-sm text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Résultats */}
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Rapport d'analyse ({results.length})</h2>
            <div className="flex gap-2">
              <button onClick={exportExcel} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
              </button>
              <button onClick={exportGeoJSON} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
                <Download className="w-4 h-4 text-blue-600" /> GeoJSON
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Nom</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-right px-4 py-2.5 font-medium">Superficie (ha)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Forêt 2000</th>
                  <th className="text-right px-4 py-2.5 font-medium">Perte &gt; {cutoffYear}</th>
                  <th className="text-right px-4 py-2.5 font-medium">Perte totale</th>
                  <th className="text-right px-4 py-2.5 font-medium">Alertes GFW</th>
                  <th className="text-center px-4 py-2.5 font-medium">Risque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.geometry_type}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.area_ha?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.forest_pct != null ? `${r.forest_pct}%` : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${(r.loss_recent_pct ?? 0) > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {r.loss_recent_pct != null ? `${r.loss_recent_pct}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.loss_total_pct != null ? `${r.loss_total_pct}%` : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{r.alert_area_ha != null ? r.alert_area_ha : '—'}</td>
                    <td className="px-4 py-2.5 text-center"><RiskBadge risk={r.risk} label={r.risk_label} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
