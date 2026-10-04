import { useMemo, useState } from 'react'
import { BookOpen, Layers, MapPin, Loader2 } from 'lucide-react'
import ReportExportBar from '../ui/ReportExportBar'
import { registryApi } from '../../api/registry'
import { WorkbookEngine, isError } from '../../utils/spreadsheet/engine'
import { registryImportReport, type Report, type Cell } from '../../utils/report'
import { useAppStore } from '../../store/appStore'
import { apiErrorMessage } from '../../utils/retry'

/** Exports, dans tous les formats, des données saisies par la coopérative : registre, anciens polygones, parcelles mappées. */
export default function CoopDataReports({ cooperativeId }: { cooperativeId?: string }) {
  const { legacyParcels, parcels, producers } = useAppStore()
  const [registry, setRegistry] = useState<Report | null>(null)
  const [regBusy, setRegBusy] = useState(false)
  const [regError, setRegError] = useState('')

  const loadRegistry = async () => {
    setRegBusy(true); setRegError('')
    try {
      const { data } = await registryApi.list()
      if (!data.length) throw new Error('Le registre est vide.')
      const sorted = [...data].sort((a, b) => a.position - b.position)
      const engine = new WorkbookEngine(sorted.map((s) => ({ name: s.name, data: s.data })))
      const sheets = sorted.map((s) => ({
        name: s.name,
        data: s.data.map((row, r) => row.map((cell, c) => {
          if (typeof cell !== 'string' || !cell.startsWith('=')) return cell
          const v = engine.getValue(s.name, r, c)
          return isError(v) ? null : (v as Cell)
        })),
      }))
      const base = registryImportReport('Registre de la coopérative', sheets, 'merge')
      setRegistry({ ...base, title: 'Registre de la coopérative', summary: base.summary.slice(1) })
    } catch (err) {
      setRegError(err instanceof Error && !('response' in err) ? err.message : apiErrorMessage(err))
    } finally {
      setRegBusy(false)
    }
  }

  const coopLegacy = useMemo(() => legacyParcels.filter((p) => !cooperativeId || p.cooperativeId === cooperativeId), [legacyParcels, cooperativeId])
  const legacyReport = useMemo<Report | null>(() => {
    if (!coopLegacy.length) return null
    const bySource = new Map<string, { n: number; ha: number }>()
    for (const p of coopLegacy) {
      const s = bySource.get(p.sourceFile) ?? { n: 0, ha: 0 }; s.n++; s.ha += p.areaHectares ?? 0; bySource.set(p.sourceFile, s)
    }
    const rows = coopLegacy.map((p) => ({ nom: p.name, fichier: p.sourceFile, surface_ha: p.areaHectares, ...(p.properties as Record<string, Cell>) }))
    return {
      kind: 'import_polygons', title: 'Anciens polygones de la coopérative', source: `${bySource.size} fichier(s) importé(s)`,
      summary: [['Polygones', coopLegacy.length], ['Surface totale (ha)', Math.round(coopLegacy.reduce((s, p) => s + (p.areaHectares ?? 0), 0) * 100) / 100],
        ...[...bySource].map(([f, s]) => [`Fichier ${f}`, `${s.n} polygone(s) · ${Math.round(s.ha * 100) / 100} ha`] as [string, Cell])],
      tables: [{ name: 'Anciens polygones', rows }],
      features: coopLegacy.map((p, i) => ({ geometry: p.geometry, properties: rows[i] })), nameField: 'nom',
    }
  }, [coopLegacy])

  const mappedReport = useMemo<Report | null>(() => {
    const list = parcels.filter((p) => (!cooperativeId || p.cooperativeId === cooperativeId) && p.geometry?.coordinates?.length)
    if (!list.length) return null
    const prod = new Map(producers.map((p) => [p.id, p]))
    const label = { compliant: 'Conforme', non_compliant: 'Non conforme', pending: 'En attente' } as const
    const rows = list.map((p) => ({
      field_id: p.fieldId, producteur: prod.get(p.producerId)?.fullName ?? '', village: p.village, section: p.section, culture: p.culture,
      surface_ha: p.areaHectares, perimetre_m: p.perimeterMeters, sommets: p.vertexCount, score_eudr: p.eudrScore ?? null,
      statut_eudr: p.eudrStatus ? label[p.eudrStatus] : '', date: p.createdAt?.slice(0, 10) ?? '',
    }))
    const n = (s: string) => list.filter((p) => p.eudrStatus === s).length
    return {
      kind: 'import_polygons', title: 'Parcelles mappées par les agents — conformité EUDR', source: 'Application de mapping',
      summary: [['Parcelles', list.length], ['Surface totale (ha)', Math.round(list.reduce((s, p) => s + (p.areaHectares || 0), 0) * 100) / 100],
        ['Conformes EUDR', n('compliant')], ['Non conformes', n('non_compliant')], ['En attente', n('pending')]],
      tables: [{ name: 'Parcelles', rows }, { name: 'Non conformes', rows: rows.filter((_, i) => list[i].eudrStatus === 'non_compliant') }],
      features: list.map((p, i) => ({ geometry: p.geometry as GeoJSON.Geometry, properties: rows[i] })), nameField: 'field_id',
    }
  }, [parcels, producers, cooperativeId])

  const card = 'bg-white rounded-2xl border border-gray-100 p-5 space-y-3'
  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-semibold text-gray-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-600" /> Parcelles mappées — rapport de conformité EUDR</p>
        {mappedReport ? <ReportExportBar report={mappedReport} autoSave={false} /> : <p className="text-sm text-gray-500">Aucune parcelle mappée pour le moment.</p>}
      </div>
      <div className={card}>
        <p className="font-semibold text-gray-900 flex items-center gap-2"><Layers className="w-4 h-4 text-purple-600" /> Anciens polygones importés</p>
        {legacyReport ? <ReportExportBar report={legacyReport} autoSave={false} /> : <p className="text-sm text-gray-500">Aucun polygone importé.</p>}
      </div>
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900 flex items-center gap-2"><BookOpen className="w-4 h-4 text-green-600" /> Registre (toutes les feuilles, formules calculées)</p>
          {!registry && (
            <button onClick={loadRegistry} disabled={regBusy} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 text-xs font-medium">
              {regBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Préparer le rapport du registre
            </button>
          )}
        </div>
        {regError && <p className="text-xs text-red-700">{regError}</p>}
        {registry && <ReportExportBar report={registry} autoSave={false} />}
      </div>
    </div>
  )
}
