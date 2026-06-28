import { FileText, FileSpreadsheet, Map, Download, CheckCircle2, Loader2, Globe, Users, ShieldCheck, AlertTriangle, Wrench, X } from 'lucide-react'
import { useState } from 'react'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import {
  toGeoJSON, toKML, toShapefileZip, producersToExcel, parcelsToExcel, downloadBlob,
} from '../../utils/geoExport'
import { analyzePolygon, correctPolygon, type PolygonAnalysis } from '../../utils/polygonCorrector'
import { haversineDistance } from '../../utils/gpsUtils'
import { parcelsApi } from '../../api/parcels'

interface Report {
  id: string
  title: string
  description: string
  format: string
  icon: React.ReactNode
  color: string
  action: () => void | Promise<void>
}

interface AnalysisRow extends PolygonAnalysis {
  parcelId: string
}

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user)
  const { parcels, producers, updateParcel, addNotification, isLive } = useAppStore()
  const coopId = user?.cooperativeId ?? 'coop-001'
  const [loading, setLoading] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([])
  const [correcting, setCorrecting] = useState(false)

  const coopParcels = parcels.filter((p) => p.cooperativeId === coopId)
  const coopProducers = producers.filter((p) => p.cooperativeId === coopId)

  // ─── Polygon Validator EUDR by JDK — run analysis on all parcels ──────────
  const runAnalysis = () => {
    const rows: AnalysisRow[] = coopParcels.map((p) => ({
      parcelId: p.id,
      ...analyzePolygon(p.geometry, p.fieldId),
    }))
    setAnalyses(rows)
    setShowAnalysis(true)
  }

  const withIssues = analyses.filter((a) => a.issues.length > 0)
  const fixableRows = analyses.filter((a) => a.issues.some((i) => i.fixable))

  // Perimeter (m) of a closed ring
  const ringPerimeter = (ring: number[][]) => {
    let total = 0
    for (let i = 0; i < ring.length - 1; i++) {
      total += haversineDistance(ring[i][1], ring[i][0], ring[i + 1][1], ring[i + 1][0])
    }
    return Math.round(total)
  }

  const handleCorrectAll = async () => {
    setCorrecting(true)
    let fixedCount = 0
    for (const row of fixableRows) {
      const parcel = coopParcels.find((p) => p.id === row.parcelId)
      if (!parcel) continue
      const result = correctPolygon(parcel.geometry)
      if (!result.changed) continue
      fixedCount++
      const ring = result.corrected.coordinates[0]
      const patch = {
        geometry: result.corrected,
        areaHectares: Math.round(result.areaAfterHa * 100) / 100,
        perimeterMeters: ringPerimeter(ring),
        vertexCount: ring.length - 1,
        updatedAt: new Date().toISOString(),
      }
      updateParcel(parcel.id, patch)
      // Persiste la correction dans la base (carte interactive + exports à jour partout)
      if (isLive) {
        try {
          await parcelsApi.update(parcel.id, {
            geometry: result.corrected,
            area_hectares: patch.areaHectares,
            perimeter_meters: patch.perimeterMeters,
            vertex_count: patch.vertexCount,
          } as never)
        } catch { /* garde la correction locale si l'API échoue */ }
      }
    }
    addNotification({
      type: 'success',
      title: 'Géométries corrigées',
      message: `${fixedCount} polygone(s) réparé(s)${isLive ? ' et enregistré(s) en base' : ''}. Carte et exports à jour.`,
    })
    // Re-run analysis to refresh the panel
    setTimeout(() => {
      const refreshed: AnalysisRow[] = useAppStore.getState().parcels
        .filter((p) => p.cooperativeId === coopId)
        .map((p) => ({ parcelId: p.id, ...analyzePolygon(p.geometry, p.fieldId) }))
      setAnalyses(refreshed)
      setCorrecting(false)
    }, 400)
  }

  // Run an export action with loading + done feedback
  const runExport = async (id: string, fn: () => void | Promise<void>) => {
    setLoading(id)
    try {
      await fn()
      setDone((d) => [...d, id])
      setTimeout(() => setDone((d) => d.filter((x) => x !== id)), 3000)
    } catch {
      // swallow — UI returns to idle
    } finally {
      setLoading(null)
    }
  }

  const reports: Report[] = [
    {
      id: 'geojson',
      title: 'Polygones — GeoJSON',
      description: 'Toutes les parcelles au format GeoJSON (QGIS, ArcGIS, Leaflet, web).',
      format: 'GeoJSON',
      icon: <Globe className="w-6 h-6" />,
      color: 'bg-blue-50 text-blue-600',
      action: () => downloadBlob(toGeoJSON(coopParcels, coopProducers), 'parcelles_eudr.geojson', 'application/geo+json'),
    },
    {
      id: 'kml',
      title: 'Polygones — KML',
      description: 'Parcelles au format KML, ouvrables directement dans Google Earth.',
      format: 'KML',
      icon: <Map className="w-6 h-6" />,
      color: 'bg-emerald-50 text-emerald-600',
      action: () => downloadBlob(toKML(coopParcels, coopProducers), 'parcelles_eudr.kml', 'application/vnd.google-earth.kml+xml'),
    },
    {
      id: 'shp',
      title: 'Polygones — Shapefile',
      description: 'Archive .zip (.shp/.shx/.dbf/.prj) pour les SIG professionnels.',
      format: 'Shapefile (.zip)',
      icon: <Map className="w-6 h-6" />,
      color: 'bg-purple-50 text-purple-600',
      action: async () => {
        const blob = await toShapefileZip(coopParcels, coopProducers)
        downloadBlob(blob, 'parcelles_eudr_shp.zip', 'application/zip')
      },
    },
    {
      id: 'producers',
      title: 'Liste des producteurs',
      description: 'Producteurs avec nb de parcelles, superficie totale et conformité EUDR.',
      format: 'Excel (.xlsx)',
      icon: <Users className="w-6 h-6" />,
      color: 'bg-orange-50 text-orange-600',
      action: () => downloadBlob(producersToExcel(coopProducers, coopParcels), 'liste_producteurs.xlsx'),
    },
    {
      id: 'parcels',
      title: 'Liste des parcelles',
      description: 'Détail de chaque parcelle : superficie, périmètre, score EUDR, statut.',
      format: 'Excel (.xlsx)',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      color: 'bg-green-50 text-green-600',
      action: () => downloadBlob(parcelsToExcel(coopParcels, coopProducers), 'liste_parcelles.xlsx'),
    },
    {
      id: 'eudr',
      title: 'Rapport de conformité EUDR',
      description: 'Synthèse texte de la conformité EUDR de chaque parcelle.',
      format: 'TXT',
      icon: <FileText className="w-6 h-6" />,
      color: 'bg-red-50 text-red-600',
      action: () => {
        const content = coopParcels.map((p) => {
          const prod = coopProducers.find((pr) => pr.id === p.producerId)
          return `FIELD ID: ${p.fieldId}\nProducteur: ${prod?.fullName ?? '—'}\nVillage: ${p.village} (${p.section})\nCulture: ${p.culture}\nSuperficie: ${p.areaHectares.toFixed(2)} ha\nScore EUDR: ${p.eudrScore ?? '—'}%\nStatut: ${p.eudrStatus}\n---`
        }).join('\n')
        downloadBlob(content, 'rapport_eudr_conformite.txt', 'text/plain')
      },
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <Header title="Rapports & Exports" subtitle="Polygones (GeoJSON, KML, SHP) et listes producteurs/parcelles" />

      {/* Polygon Validator EUDR by JDK — analysis banner */}
      <div className="bg-gradient-to-r from-primary-700 to-green-800 text-white rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <p className="font-bold">Polygon Validator EUDR by JDK</p>
            <p className="text-sm text-primary-100">Analysez et corrigez les auto-intersections avant l'export</p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={coopParcels.length === 0}
          className="bg-white text-primary-700 hover:bg-primary-50 disabled:opacity-50 font-semibold px-5 py-2.5 rounded-xl text-sm transition"
        >
          Analyser les polygones
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Parcelles', value: coopParcels.length, color: 'text-primary-600' },
          { label: 'Producteurs', value: coopProducers.length, color: 'text-blue-600' },
          { label: 'Conformes EUDR', value: coopParcels.filter(p => p.eudrStatus === 'compliant').length, color: 'text-green-600' },
          { label: 'Superficie totale', value: `${coopParcels.reduce((s, p) => s + p.areaHectares, 0).toFixed(1)} ha`, color: 'text-orange-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${r.color}`}>
                {r.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{r.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{r.format}</span>
              <button
                onClick={() => runExport(r.id, r.action)}
                disabled={loading === r.id || coopParcels.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  done.includes(r.id)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary-600 hover:bg-primary-700 text-white disabled:bg-gray-300'
                }`}
              >
                {loading === r.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</>
                ) : done.includes(r.id) ? (
                  <><CheckCircle2 className="w-4 h-4" /> Téléchargé</>
                ) : (
                  <><Download className="w-4 h-4" /> Télécharger</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Analysis & correction modal ──────────────────────────────────── */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Analyse des géométries</h3>
                <p className="text-xs text-gray-500">Polygon Validator EUDR by JDK · {analyses.length} parcelle(s) analysée(s)</p>
              </div>
              <button onClick={() => setShowAnalysis(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Summary line */}
            <div className="px-6 py-3 border-b border-gray-50 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-green-600">
                <CheckCircle2 className="w-4 h-4" /> {analyses.length - withIssues.length} valide(s)
              </span>
              <span className="flex items-center gap-1.5 text-orange-600">
                <AlertTriangle className="w-4 h-4" /> {withIssues.length} avec problème(s)
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {withIssues.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                  <p className="font-semibold text-gray-800 mt-3">Toutes les géométries sont valides ✅</p>
                  <p className="text-sm text-gray-500">Aucune auto-intersection ni anomalie détectée. Vous pouvez exporter.</p>
                </div>
              ) : (
                withIssues.map((a) => (
                  <div key={a.parcelId} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-mono text-sm font-semibold text-gray-800">{a.fieldId}</p>
                      <span className="text-xs text-gray-400">{a.vertexCount} sommets · {a.areaHa.toFixed(2)} ha</span>
                    </div>
                    <div className="space-y-1.5">
                      {a.issues.map((iss, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${iss.severity === 'error' ? 'text-red-500' : 'text-yellow-500'}`} />
                          <span className="text-gray-700"><strong>{iss.label}</strong> — {iss.detail}</span>
                          {iss.fixable && <span className="ml-auto text-green-600 font-medium whitespace-nowrap">✓ corrigeable</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowAnalysis(false)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition"
              >
                Fermer
              </button>
              <button
                onClick={handleCorrectAll}
                disabled={fixableRows.length === 0 || correcting}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition"
              >
                {correcting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                {correcting ? 'Correction...' : `Corriger ${fixableRows.length} polygone(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
