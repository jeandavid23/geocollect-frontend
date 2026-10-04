import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertTriangle, Archive } from 'lucide-react'
import { reportCSV, reportExcel, reportGeoJSON, reportKML, reportPDF, reportShapefile, reportsApi, type Report } from '../../utils/report'
import { apiErrorMessage } from '../../utils/retry'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'

/**
 * Téléchargement du rapport d'un traitement dans tous les formats + enregistrement automatique
 * dans « Rapports » (retéléchargeable plus tard par la coopérative et son super admin).
 */
export default function ReportExportBar({ report, autoSave = true }: { report: Report | null; autoSave?: boolean }) {
  const user = useAuthStore((s) => s.user)
  const cooperatives = useAppStore((s) => s.cooperatives)
  const [busy, setBusy] = useState('')
  const [saved, setSaved] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const savedFor = useRef<Report | null>(null)

  // nom de la coopérative et auteur dans l'en-tête des rapports
  const full: Report | null = report && {
    ...report,
    meta: {
      cooperative: cooperatives.find((c) => c.id === user?.cooperativeId)?.name ?? user?.fullName ?? '',
      author: user?.fullName ?? user?.username ?? '', date: new Date().toISOString(), ...report.meta,
    },
  }

  useEffect(() => {
    if (!full || !autoSave || savedFor.current === report || !user?.cooperativeId) return
    savedFor.current = report
    setSaved('saving'); setSaveError('')
    reportsApi.save(full).then(() => setSaved('ok')).catch((err) => { setSaved('error'); setSaveError(apiErrorMessage(err)) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, autoSave])

  if (!full) return null
  const geo = Boolean(full.features?.length)
  const run = async (key: string, fn: () => unknown) => {
    setBusy(key)
    try { await fn() } finally { setBusy('') }
  }
  const btn = 'flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 disabled:opacity-40'
  const icon = (k: string, i: React.ReactNode) => (busy === k ? <Loader2 className="w-4 h-4 animate-spin" /> : i)

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-2">
      <p className="text-xs font-semibold text-gray-700 mr-1 flex items-center gap-1.5"><Archive className="w-4 h-4 text-primary-600" /> Rapport :</p>
      <button onClick={() => run('pdf', () => reportPDF(full))} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-medium disabled:opacity-60">{icon('pdf', <FileText className="w-4 h-4" />)} PDF</button>
      <button onClick={() => run('xlsx', () => reportExcel(full))} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-medium disabled:opacity-60">{icon('xlsx', <FileSpreadsheet className="w-4 h-4" />)} Excel</button>
      <button onClick={() => run('csv', () => reportCSV(full))} disabled={!!busy} className={btn}>{icon('csv', <Download className="w-4 h-4" />)} CSV</button>
      <button onClick={() => run('geojson', () => reportGeoJSON(full))} disabled={!!busy || !geo} className={btn}>{icon('geojson', <Download className="w-4 h-4" />)} GeoJSON</button>
      <button onClick={() => run('kml', () => reportKML(full))} disabled={!!busy || !geo} className={btn}>{icon('kml', <Download className="w-4 h-4" />)} KML</button>
      <button onClick={() => run('shp', () => reportShapefile(full))} disabled={!!busy || !geo} className={btn}>{icon('shp', <Download className="w-4 h-4" />)} Shapefile</button>
      <span className="ml-auto text-xs">
        {saved === 'saving' && <span className="flex items-center gap-1 text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement dans Rapports…</span>}
        {saved === 'ok' && <Link to={user?.role === 'agent' ? '#' : '/coop/reports'} className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Enregistré dans « Rapports »</Link>}
        {saved === 'error' && <span className="flex items-center gap-1 text-amber-700" title={saveError}><AlertTriangle className="w-3.5 h-3.5" /> Non enregistré : {saveError}</span>}
      </span>
    </section>
  )
}
