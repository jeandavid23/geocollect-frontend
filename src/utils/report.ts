import api from '../api/client'
import { gzipJson } from './gzip'
import { exportExcel, exportGeoJSON, exportKML, exportShapefile, type OutFeature } from './featureExport'
import { downloadBlob } from './geoExport'

// ─── Rapport commun à tous les traitements et imports ─────────────────────────
// Même contenu, tous les formats : PDF, Excel, CSV, GeoJSON, KML, Shapefile.

export type ReportKind = 'deforestation' | 'validator' | 'selfintersection' | 'gmr' | 'import_registry' | 'import_polygons'

export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  deforestation: 'Analyse déforestation',
  validator: 'Polygon Validator (chevauchements)',
  selfintersection: 'Self-intersection (nettoyage)',
  gmr: 'Polygon & GMR (registre × polygones)',
  import_registry: 'Import du registre',
  import_polygons: 'Import de polygones',
}

export type Cell = string | number | boolean | null
export interface ReportTable { name: string; rows: Record<string, Cell>[] }

export interface Report {
  kind: ReportKind
  title: string
  source: string                              // fichier ou source des données
  summary: [string, Cell][]                   // synthèse (première page du PDF, feuille « Synthèse »)
  tables: ReportTable[]                       // tableaux détaillés (1re table = table principale du CSV)
  features?: OutFeature[]                     // polygones avec leurs attributs (formats géographiques)
  nameField?: string                          // attribut affiché comme nom (KML)
  meta?: { cooperative?: string; author?: string; date?: string }
}

export interface SavedReportMeta {
  id: string
  cooperative: string
  cooperative_name: string
  kind: ReportKind
  kind_label: string
  title: string
  source: string
  summary: [string, Cell][]
  feature_count: number
  size_bytes: number
  created_by_name: string
  created_at: string
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase()
const stamp = (d = new Date()) => d.toISOString().slice(0, 10)
export const reportFileBase = (r: Report) => `${slug(REPORT_KIND_LABEL[r.kind] ?? r.kind)}_${stamp(r.meta?.date ? new Date(r.meta.date) : undefined)}`

// ─── Formats ─────────────────────────────────────────────────────────────────

export function reportExcel(r: Report) {
  exportExcel([
    { name: 'Synthèse', rows: [[r.title], ['Source', r.source], ['Coopérative', r.meta?.cooperative ?? ''],
      ['Date', new Date(r.meta?.date ?? Date.now()).toLocaleString('fr-FR')], ['Auteur', r.meta?.author ?? ''], [], ...r.summary] },
    ...r.tables.map((t) => ({ name: t.name, rows: t.rows.length ? t.rows : [{ '': 'Aucune ligne' }] })),
  ], `${reportFileBase(r)}.xlsx`)
}

export function reportCSV(r: Report, tableIndex = 0) {
  const t = r.tables[tableIndex]
  if (!t) return
  const cols = [...new Set(t.rows.flatMap((row) => Object.keys(row)))]
  const esc = (v: Cell) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  // séparateur « ; » et BOM UTF-8 : s'ouvre directement dans Excel en français, accents compris
  const csv = '﻿' + [cols.join(';'), ...t.rows.map((row) => cols.map((c) => esc(row[c])).join(';'))].join('\r\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${reportFileBase(r)}_${slug(t.name)}.csv`)
}

// Police standard des PDF (WinAnsi) : les symboles hors de ce jeu (≤, ≥, →…) s'afficheraient brouillés
const PDF_SUBST: Record<string, string> = { '≤': '<=', '≥': '>=', '→': '->', '←': '<-', '×': 'x', '≈': '~', '✓': 'OK', '✗': 'X', '\u00a0': ' ', '\u202f': ' ' }
const WINANSI_EXTRA = new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'])
const pdfText = (v: unknown): string => [...String(v ?? '')]
  .map((ch) => PDF_SUBST[ch] ?? (ch.charCodeAt(0) <= 255 || WINANSI_EXTRA.has(ch) ? ch : '?')).join('')

const PDF_MAX_ROWS = 1500        // table principale ; les tables suivantes : 500 lignes (le détail complet est dans Excel / CSV)
const PDF_MAX_COLS = 9

export async function reportPDF(r: Report) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const green: [number, number, number] = [22, 101, 52]

  // En-tête
  doc.setFillColor(...green); doc.rect(0, 0, W, 22, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text(pdfText(r.title), 12, 10)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text(pdfText(`GeoCollect EUDR · ${r.meta?.cooperative ?? ''} · ${new Date(r.meta?.date ?? Date.now()).toLocaleString('fr-FR')}${r.meta?.author ? ' · ' + r.meta.author : ''}`), 12, 17)
  doc.setTextColor(30, 30, 30)

  // Synthèse
  autoTable(doc, {
    startY: 28, head: [['Synthèse', '']], body: [['Source', r.source], ...r.summary.filter((s) => s[0] !== '').map(([k, v]) => [k, v ?? ''])].map((row) => row.map(pdfText)),
    theme: 'grid', headStyles: { fillColor: green }, styles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold' } },
    margin: { left: 12, right: 12 }, tableWidth: 180,
  })

  // Tableaux détaillés (colonnes principales, lignes plafonnées pour garder un PDF lisible)
  for (const [ti, t] of r.tables.entries()) {
    if (!t.rows.length) continue
    const maxRows = ti === 0 ? PDF_MAX_ROWS : 500
    const cols = [...new Set(t.rows.slice(0, 200).flatMap((row) => Object.keys(row)))].slice(0, PDF_MAX_COLS)
    doc.addPage()
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(pdfText(`${t.name} (${t.rows.length.toLocaleString('fr-FR')})`), 12, 14)
    autoTable(doc, {
      startY: 18, head: [cols.map(pdfText)], body: t.rows.slice(0, maxRows).map((row) => cols.map((c) => pdfText(row[c]))),
      theme: 'striped', headStyles: { fillColor: green, fontSize: 8 }, styles: { fontSize: 7, cellPadding: 1.2, overflow: 'ellipsize' },
      margin: { left: 12, right: 12 },
    })
    if (t.rows.length > maxRows) {
      doc.setFontSize(8); doc.setTextColor(120, 120, 120)
      doc.text(pdfText(`… ${t.rows.length - maxRows} ligne(s) de plus : voir l'export Excel ou CSV.`), 12, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6)
      doc.setTextColor(30, 30, 30)
    }
  }

  // Pied de page
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140, 140, 140)
    doc.text(`GeoCollect EUDR — GeoLab Service · page ${i}/${n}`, 12, doc.internal.pageSize.getHeight() - 6)
  }
  doc.save(`${reportFileBase(r)}.pdf`)
}

export const reportGeoJSON = (r: Report) => r.features?.length && exportGeoJSON(r.features, `${reportFileBase(r)}.geojson`)
export const reportKML = (r: Report) => r.features?.length && exportKML(r.features, `${reportFileBase(r)}.kml`, r.nameField)
export const reportShapefile = (r: Report) => r.features?.length && exportShapefile(r.features, `${reportFileBase(r)}_shp.zip`, slug(r.kind).slice(0, 20) || 'polygones')

// ─── Enregistrement sur le serveur (page « Rapports ») ─────────────────────────

export const reportsApi = {
  list: (params?: { kind?: ReportKind; cooperative?: string }) => api.get<SavedReportMeta[]>('/reports/', { params }),
  get: (id: string) => api.get<Pick<Report, 'summary' | 'tables' | 'features' | 'meta'>>(`/reports/${id}/`, { timeout: 120000 }),
  remove: (id: string) => api.delete(`/reports/${id}/`),
  save: async (r: Report, cooperative?: string) => {
    const { body, gzip } = await gzipJson({
      kind: r.kind, title: r.title, source: r.source, summary: r.summary, tables: r.tables,
      features: r.features ?? [], meta: { ...(r.meta ?? {}), nameField: r.nameField }, cooperative,
    })
    return api.post<SavedReportMeta>('/reports/', body, {
      headers: { 'Content-Type': 'application/json', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) }, timeout: 180000,
    })
  },
}

/** Rapport enregistré → objet Report complet (pour le retélécharger dans n'importe quel format). */
export async function loadSavedReport(m: SavedReportMeta): Promise<Report> {
  const { data } = await reportsApi.get(m.id)
  return {
    kind: m.kind, title: m.title, source: m.source, summary: data.summary ?? m.summary, tables: data.tables ?? [],
    features: data.features ?? [], meta: { cooperative: m.cooperative_name, author: m.created_by_name, date: m.created_at, ...(data.meta ?? {}) },
    nameField: (data.meta as { nameField?: string } | undefined)?.nameField,
  }
}

/** Rapport d'import (registre, producteurs, polygones) : enregistré dans « Rapports », sans bloquer l'import. */
export function saveImportReport(r: Omit<Report, 'meta'> & { meta?: Report['meta'] }, cooperative?: string) {
  const auth = JSON.parse(localStorage.getItem('geocollect-auth') || '{}')?.state?.user
  reportsApi.save({ ...r, meta: { author: auth?.fullName ?? auth?.username ?? '', date: new Date().toISOString(), ...r.meta } }, cooperative)
    .catch(() => { /* hors ligne ou super admin sans coopérative ciblée : pas de rapport */ })
}

/** Rapport d'import d'un classeur : une table par feuille (entêtes détectées), pour Excel / CSV / PDF. */
export function registryImportReport(fileName: string, sheets: { name: string; data: Cell[][] }[], mode: 'replace' | 'merge'): Omit<Report, 'meta'> {
  const tables: ReportTable[] = sheets.filter((s) => s.data.length).map((s) => {
    let h = 0, best = -1
    s.data.slice(0, 15).forEach((row, i) => { const n = row.filter((c) => typeof c === 'string' && c.trim() && isNaN(Number(c))).length; if (n > best) { best = n; h = i } })
    const width = Math.max(0, ...s.data.slice(h, h + 50).map((r) => r.length))
    const heads = Array.from({ length: width }, (_, c) => String(s.data[h]?.[c] ?? '').trim() || `Colonne ${c + 1}`)
      .map((x, i, all) => (all.indexOf(x) !== i ? `${x} (${i + 1})` : x))
    const rows = s.data.slice(h + 1).filter((r) => r.some((c) => c !== null && c !== ''))
      .map((r) => Object.fromEntries(heads.map((x, c) => [x, r[c] ?? null])))
    return { name: s.name.slice(0, 31), rows }
  })
  return {
    kind: 'import_registry', title: `Rapport d'import du registre — ${fileName}`, source: fileName,
    summary: [['Mode', mode === 'replace' ? 'Remplacement du registre' : 'Ajout / mise à jour des feuilles'], ['Feuilles', tables.length],
      ...tables.map((t) => [`Lignes — ${t.name}`, t.rows.length] as [string, Cell])],
    tables,
  }
}
