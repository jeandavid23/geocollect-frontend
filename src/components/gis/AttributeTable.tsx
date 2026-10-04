import { useMemo, useState } from 'react'
import { Search, X, ZoomIn, Plus, Download } from 'lucide-react'
import type { GFeature } from './GisEngine'

export interface Column { key: string; label: string; editable: boolean; numeric?: boolean }

interface Props {
  title: string
  features: GFeature[]
  columns: Column[]
  selected: Set<string>
  editMode: boolean
  canAddField: boolean
  onRowClick: (key: string, multi: boolean) => void
  onZoom: (key: string) => void
  onEdit: (key: string, field: string, value: string) => void
  onAddField: (name: string) => void
  onExportCsv: (rows: GFeature[]) => void
  onClose: () => void
}

const PAGE = 200

/** Table attributaire (comme dans QGIS) : tri, filtre, sélection synchronisée avec la carte, édition des valeurs. */
export default function AttributeTable(props: Props) {
  const [onlySelected, setOnlySelected] = useState(false)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    let list = props.features.filter((f) => (!onlySelected || props.selected.has(f.key))
      && (!s || props.columns.some((c) => String(f.props[c.key] ?? '').toLowerCase().includes(s))))
    if (sort) {
      list = [...list].sort((a, b) => {
        const x = a.props[sort.key], y = b.props[sort.key]
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir
        return String(x ?? '').localeCompare(String(y ?? ''), 'fr', { numeric: true }) * sort.dir
      })
    }
    return list
  }, [props.features, props.columns, props.selected, onlySelected, q, sort])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const cur = Math.min(page, pages - 1)

  const addField = () => {
    const name = window.prompt('Nom du nouveau champ :')?.trim()
    if (name) props.onAddField(name)
  }

  return (
    <div className="h-full flex flex-col bg-white border-t border-gray-200">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 text-xs">
        <p className="font-semibold text-gray-800">Table attributaire — {props.title}</p>
        <span className="text-gray-500">{props.features.length.toLocaleString('fr-FR')} entité(s) · {props.features.filter((f) => props.selected.has(f.key)).length} sélectionnée(s)</span>
        <label className="flex items-center gap-1 ml-2"><input type="checkbox" checked={onlySelected} onChange={(e) => { setOnlySelected(e.target.checked); setPage(0) }} /> Sélection seulement</label>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Filtrer…" className="pl-7 pr-2 py-1 border border-gray-200 rounded-lg w-44" />
        </div>
        {props.editMode && props.canAddField && <button onClick={addField} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-50 text-primary-700"><Plus className="w-3.5 h-3.5" /> Champ</button>}
        <button onClick={() => props.onExportCsv(rows)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-gray-700"><Download className="w-3.5 h-3.5" /> CSV</button>
        {props.editMode && <span className="text-amber-700">Mode édition : cliquez une cellule pour la modifier</span>}
        <button onClick={props.onClose} className="ml-auto p-1 rounded hover:bg-gray-100" title="Fermer"><X className="w-4 h-4 text-gray-500" /></button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead className="sticky top-0 bg-gray-100 text-gray-600 z-10">
            <tr>
              <th className="px-2 py-1.5 border-b border-r border-gray-200 w-8">#</th>
              {props.columns.map((c) => (
                <th key={c.key} onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}
                  className="px-2 py-1.5 border-b border-r border-gray-200 text-left font-medium whitespace-nowrap cursor-pointer hover:bg-gray-200">
                  {c.label}{sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}{!c.editable && <span className="text-gray-400"> 🔒</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(cur * PAGE, (cur + 1) * PAGE).map((f, i) => {
              const sel = props.selected.has(f.key)
              return (
                <tr key={f.key} onClick={(e) => props.onRowClick(f.key, e.shiftKey || e.ctrlKey || e.metaKey)} onDoubleClick={() => props.onZoom(f.key)}
                  className={`cursor-pointer ${sel ? 'bg-yellow-100' : i % 2 ? 'bg-gray-50/60' : ''} hover:bg-primary-50`}>
                  <td className="px-2 py-1 border-b border-r border-gray-100 text-gray-400 whitespace-nowrap">
                    <button onClick={(e) => { e.stopPropagation(); props.onZoom(f.key) }} title="Zoomer"><ZoomIn className="w-3 h-3 inline" /></button>
                    {f.state !== 'clean' && <span className={`ml-1 ${f.state === 'new' ? 'text-blue-600' : 'text-amber-600'}`}>●</span>}
                  </td>
                  {props.columns.map((c) => (
                    <td key={c.key} className="px-2 py-1 border-b border-r border-gray-100 whitespace-nowrap max-w-[260px] overflow-hidden text-ellipsis">
                      {props.editMode && c.editable ? (
                        <input defaultValue={String(f.props[c.key] ?? '')} key={`${f.key}:${c.key}:${String(f.props[c.key] ?? '')}`}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => { if (e.target.value !== String(f.props[c.key] ?? '')) props.onEdit(f.key, c.key, e.target.value) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          className="w-full min-w-[80px] bg-transparent border border-transparent hover:border-gray-200 focus:border-primary-400 focus:bg-white rounded px-1 outline-none" />
                      ) : (
                        <span className={c.numeric ? 'tabular-nums' : ''}>{String(f.props[c.key] ?? '')}</span>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-center text-xs text-gray-400 py-6">Aucune entité.</p>}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-gray-100 text-xs text-gray-500">
          <button disabled={cur === 0} onClick={() => setPage(cur - 1)} className="px-2 py-0.5 rounded border border-gray-200 disabled:opacity-40">‹</button>
          <span>Page {cur + 1} / {pages}</span>
          <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="px-2 py-0.5 rounded border border-gray-200 disabled:opacity-40">›</button>
        </div>
      )}
    </div>
  )
}
