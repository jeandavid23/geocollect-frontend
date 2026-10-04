import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, FileText, FileSpreadsheet, Download, Trash2, Loader2, RefreshCw, Search } from 'lucide-react'
import {
  reportsApi, loadSavedReport, reportPDF, reportExcel, reportCSV, reportGeoJSON, reportKML, reportShapefile,
  REPORT_KIND_LABEL, type ReportKind, type SavedReportMeta, type Report,
} from '../../utils/report'
import { apiErrorMessage } from '../../utils/retry'
import { useAuthStore } from '../../store/authStore'

type Format = 'pdf' | 'xlsx' | 'csv' | 'geojson' | 'kml' | 'shp'
const RUN: Record<Format, (r: Report) => unknown> = {
  pdf: reportPDF, xlsx: reportExcel, csv: reportCSV, geojson: reportGeoJSON, kml: reportKML, shp: reportShapefile,
}

/** Historique des rapports enregistrés (traitements et imports), retéléchargeables dans tous les formats. */
export default function SavedReports({ showCooperative = false }: { showCooperative?: boolean }) {
  const role = useAuthStore((s) => s.user?.role)
  const [items, setItems] = useState<SavedReportMeta[] | null>(null)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<ReportKind | ''>('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  const [cache, setCache] = useState<Record<string, Report>>({})

  const load = useCallback(() => {
    setError('')
    reportsApi.list().then(({ data }) => setItems(data)).catch((err) => { setItems([]); setError(apiErrorMessage(err)) })
  }, [])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => (items ?? []).filter((r) => (!kind || r.kind === kind)
    && (!q.trim() || `${r.title} ${r.source} ${r.cooperative_name} ${r.created_by_name}`.toLowerCase().includes(q.trim().toLowerCase()))), [items, kind, q])

  const download = async (m: SavedReportMeta, f: Format) => {
    setBusy(`${m.id}:${f}`)
    try {
      const r = cache[m.id] ?? await loadSavedReport(m)
      setCache((c) => ({ ...c, [m.id]: r }))
      await RUN[f](r)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy('')
    }
  }

  const remove = async (m: SavedReportMeta) => {
    if (!window.confirm(`Supprimer le rapport « ${m.title} » ?`)) return
    try { await reportsApi.remove(m.id); setItems((l) => (l ?? []).filter((x) => x.id !== m.id)) } catch (err) { setError(apiErrorMessage(err)) }
  }

  const fmtBtn = (m: SavedReportMeta, f: Format, label: string, icon: React.ReactNode, cls: string, disabled = false) => (
    <button key={f} onClick={() => download(m, f)} disabled={!!busy || disabled}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium disabled:opacity-35 ${cls}`}>
      {busy === `${m.id}:${f}` ? <Loader2 className="w-3 h-3 animate-spin" /> : icon} {label}
    </button>
  )

  return (
    <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-gray-50">
        <p className="font-semibold text-gray-900 flex items-center gap-2 mr-auto"><Archive className="w-4 h-4 text-primary-600" /> Historique des rapports</p>
        <select value={kind} onChange={(e) => setKind(e.target.value as ReportKind | '')} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
          <option value="">Tous les types</option>
          {Object.entries(REPORT_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-8 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
        </div>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100" title="Actualiser"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
      </div>
      {error && <p className="px-5 py-2 text-xs text-red-700 bg-red-50">{error}</p>}
      {items === null ? (
        <p className="px-5 py-6 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>
      ) : shown.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">Aucun rapport pour le moment. Chaque analyse (déforestation, Polygon Validator, Self-intersection, Polygon & GMR) et chaque import (registre, producteurs, polygones) crée automatiquement son rapport ici.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {shown.map((m) => (
            <div key={m.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-[260px] flex-1">
                <p className="text-sm font-semibold text-gray-800">{m.title}</p>
                <p className="text-xs text-gray-500">
                  <span className="px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 mr-1">{m.kind_label}</span>
                  {new Date(m.created_at).toLocaleString('fr-FR')} · {m.created_by_name || '—'}{showCooperative ? ` · ${m.cooperative_name}` : ''}
                  {m.feature_count ? ` · ${m.feature_count.toLocaleString('fr-FR')} polygone(s)` : ''}
                </p>
                {m.summary.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{m.summary.slice(0, 6).map(([k, v]) => `${k} : ${v}`).join(' · ')}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {fmtBtn(m, 'pdf', 'PDF', <FileText className="w-3 h-3" />, 'bg-red-50 text-red-700')}
                {fmtBtn(m, 'xlsx', 'Excel', <FileSpreadsheet className="w-3 h-3" />, 'bg-green-50 text-green-700')}
                {fmtBtn(m, 'csv', 'CSV', <Download className="w-3 h-3" />, 'bg-gray-50 text-gray-700')}
                {fmtBtn(m, 'geojson', 'GeoJSON', <Download className="w-3 h-3" />, 'bg-gray-50 text-gray-700', !m.feature_count)}
                {fmtBtn(m, 'kml', 'KML', <Download className="w-3 h-3" />, 'bg-gray-50 text-gray-700', !m.feature_count)}
                {fmtBtn(m, 'shp', 'SHP', <Download className="w-3 h-3" />, 'bg-gray-50 text-gray-700', !m.feature_count)}
                {role !== 'agent' && (
                  <button onClick={() => remove(m)} className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
