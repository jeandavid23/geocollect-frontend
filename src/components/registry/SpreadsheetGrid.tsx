import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CellValue } from '../../api/registry'
import { colName, cellName, shiftFormula } from '../../utils/spreadsheet/refs'
import { formatComputed, isError, type WorkbookEngine } from '../../utils/spreadsheet/engine'
import { applyNumberFormat, cellStyle, fmtKey, type CellFormat } from '../../utils/spreadsheet/format'

export interface Selection { ar: number; ac: number; r1: number; c1: number; r2: number; c2: number }
export interface EditState { r: number; c: number; text: string }
export interface CellUpdate { r: number; c: number; v: CellValue }

export const ROW_H = 26
const HEAD_H = 26
const ROW_HEAD_W = 52
export const DEFAULT_COL_W = 110

export const selectCell = (r: number, c: number): Selection => ({ ar: r, ac: c, r1: r, c1: c, r2: r, c2: c })
export const normalizeSel = (ar: number, ac: number, r: number, c: number): Selection =>
  ({ ar, ac, r1: Math.min(ar, r), c1: Math.min(ac, c), r2: Math.max(ar, r), c2: Math.max(ac, c) })

/** Texte brut d'une cellule tel qu'affiché dans la barre de formule. */
export const rawText = (v: CellValue) =>
  v === null ? '' : typeof v === 'boolean' ? (v ? 'VRAI' : 'FAUX') : typeof v === 'number' ? String(v).replace('.', ',') : v

// La saisie d'une formule attend une référence après ces caractères (« mode pointage » d'Excel)
const POINT_MODE = /[=(,;+\-*/&<>:^ ]$/

interface Props {
  data: CellValue[][]
  colWidths: number[]
  sheetName: string
  engine: WorkbookEngine
  sel: Selection
  setSel: (s: Selection) => void
  edit: EditState | null
  setEdit: (e: EditState | null) => void
  commitEdit: (move: 'down' | 'up' | 'right' | 'left' | 'none') => void
  freezeTop: boolean
  onSetCells: (updates: CellUpdate[]) => void
  onColWidth: (c: number, w: number) => void
  // Ctrl+Z / Ctrl+Y / Ctrl+S sont gérés au niveau de la page
  onShortcut: (action: 'find' | 'fillDown' | 'fillRight') => void
  scrollToken: number // change quand la cellule active doit être ramenée dans la vue
  formats?: Record<string, CellFormat> // mise en forme par cellule (clé « r:c »)
}

// Presse-papiers interne : garde les formules (le presse-papiers système ne reçoit que les valeurs)
let internalClipboard: { tsv: string; cells: CellValue[][]; r: number; c: number } | null = null

export default function SpreadsheetGrid(props: Props) {
  const { data, colWidths, engine, sel, setSel, edit, setEdit, commitEdit, freezeTop, onSetCells, onColWidth, onShortcut } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [scroll, setScroll] = useState({ top: 0, height: 600 })
  const drag = useRef<null | { mode: 'select' } | { mode: 'ref'; base: string; r: number; c: number }>(null)
  const resize = useRef<null | { c: number; x: number; w: number }>(null)

  const width = (c: number) => colWidths[c] ?? DEFAULT_COL_W
  const nCols = Math.max(26, ...data.slice(0, 2000).map((r) => r.length + 3))
  const nRows = Math.max(100, data.length + 50)
  const colLeft: number[] = []
  let x = ROW_HEAD_W
  for (let c = 0; c < nCols; c++) { colLeft.push(x); x += width(c) }
  const totalW = x
  const frozenH = freezeTop ? ROW_H : 0
  const bodyStart = freezeTop ? 1 : 0
  const bodyTop = HEAD_H + frozenH

  // Lignes visibles (virtualisation verticale)
  const first = Math.max(bodyStart, bodyStart + Math.floor((scroll.top) / ROW_H) - 5)
  const last = Math.min(nRows - 1, bodyStart + Math.ceil((scroll.top + scroll.height) / ROW_H) + 5)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setScroll({ top: el.scrollTop, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Ramène la cellule active dans la vue (navigation clavier, recherche)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const { ar, ac } = sel
    if (!(freezeTop && ar === 0)) {
      const top = bodyTop + (ar - bodyStart) * ROW_H
      if (top - bodyTop < el.scrollTop) el.scrollTop = top - bodyTop
      else if (top + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_H - el.clientHeight
    }
    const left = colLeft[ac] ?? 0
    if (left - ROW_HEAD_W < el.scrollLeft) el.scrollLeft = left - ROW_HEAD_W
    else if (left + width(ac) > el.scrollLeft + el.clientWidth) el.scrollLeft = left + width(ac) - el.clientWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.scrollToken, sel.ar, sel.ac])

  useEffect(() => { if (edit) inputRef.current?.focus() }, [edit?.r, edit?.c, edit !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fin de glissement (sélection, référence, redimensionnement)
  useEffect(() => {
    const up = () => { drag.current = null; resize.current = null }
    const move = (e: MouseEvent) => {
      if (!resize.current) return
      onColWidth(resize.current.c, Math.max(40, resize.current.w + e.clientX - resize.current.x))
    }
    window.addEventListener('mouseup', up)
    window.addEventListener('mousemove', move)
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('mousemove', move) }
  }, [onColWidth])

  const raw = (r: number, c: number): CellValue => data[r]?.[c] ?? null
  const inPointMode = () => !!edit && edit.text.startsWith('=') && POINT_MODE.test(edit.text)

  const onCellMouseDown = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault()
    if (edit && inPointMode()) {
      drag.current = { mode: 'ref', base: edit.text, r, c }
      setEdit({ ...edit, text: edit.text + cellName(r, c) })
      return
    }
    if (edit) commitEdit('none')
    drag.current = { mode: 'select' }
    setSel(e.shiftKey ? normalizeSel(sel.ar, sel.ac, r, c) : selectCell(r, c))
    scrollRef.current?.focus()
  }

  const onCellMouseEnter = (r: number, c: number) => {
    const d = drag.current
    if (!d) return
    if (d.mode === 'select') setSel(normalizeSel(sel.ar, sel.ac, r, c))
    else if (edit) {
      const ref = r === d.r && c === d.c ? cellName(r, c) : `${cellName(Math.min(r, d.r), Math.min(c, d.c))}:${cellName(Math.max(r, d.r), Math.max(c, d.c))}`
      setEdit({ ...edit, text: d.base + ref })
    }
  }

  const startEdit = (r: number, c: number, text?: string) => setEdit({ r, c, text: text ?? rawText(raw(r, c)) })

  const move = (dr: number, dc: number, extend: boolean) => {
    if (extend) {
      // on déplace le coin opposé à la cellule active
      const r = (sel.r1 === sel.ar ? sel.r2 : sel.r1) + dr
      const c = (sel.c1 === sel.ac ? sel.c2 : sel.c1) + dc
      setSel(normalizeSel(sel.ar, sel.ac, Math.max(0, Math.min(nRows - 1, r)), Math.max(0, Math.min(nCols - 1, c))))
    } else {
      setSel(selectCell(Math.max(0, Math.min(nRows - 1, sel.ar + dr)), Math.max(0, Math.min(nCols - 1, sel.ac + dc))))
    }
  }

  // Ctrl + flèche : bord de la zone remplie
  const jump = (dr: number, dc: number) => {
    let r = sel.ar, c = sel.ac
    const filled = (rr: number, cc: number) => raw(rr, cc) !== null && raw(rr, cc) !== ''
    const inside = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < Math.max(data.length, 1) + 1 && cc < nCols
    const startFilled = filled(r, c) && filled(r + dr, c + dc)
    while (inside(r + dr, c + dc)) {
      r += dr; c += dc
      if (startFilled ? !filled(r + dr, c + dc) : filled(r, c)) break
    }
    setSel(selectCell(Math.max(0, r), Math.max(0, c)))
  }

  const copy = async (cut: boolean) => {
    const cells: CellValue[][] = []
    const lines: string[] = []
    for (let r = sel.r1; r <= sel.r2; r++) {
      const row: CellValue[] = []
      const txt: string[] = []
      for (let c = sel.c1; c <= sel.c2; c++) {
        row.push(raw(r, c))
        txt.push(formatComputed(engine.getValue(props.sheetName, r, c), raw(r, c)))
      }
      cells.push(row); lines.push(txt.join('\t'))
    }
    const tsv = lines.join('\n')
    internalClipboard = { tsv, cells, r: sel.r1, c: sel.c1 }
    try { await navigator.clipboard.writeText(tsv) } catch { /* presse-papiers système refusé : copie interne seulement */ }
    if (cut) clearSelection()
  }

  const paste = async () => {
    let text = ''
    try { text = await navigator.clipboard.readText() } catch { text = internalClipboard?.tsv ?? '' }
    const updates: CellUpdate[] = []
    if (internalClipboard && (text === '' || text === internalClipboard.tsv)) {
      // collage interne : formules recopiées avec décalage des références
      const { cells, r: r0, c: c0 } = internalClipboard
      cells.forEach((row, i) => row.forEach((v, j) => {
        const dr = sel.ar - r0, dc = sel.ac - c0
        updates.push({ r: sel.ar + i, c: sel.ac + j, v: typeof v === 'string' ? shiftFormula(v, dr, dc) : v })
      }))
    } else if (text) {
      // collage depuis Excel / un autre logiciel : valeurs séparées par des tabulations
      text.replace(/\r/g, '').replace(/\n$/, '').split('\n').forEach((line, i) =>
        line.split('\t').forEach((cell, j) => updates.push({ r: sel.ar + i, c: sel.ac + j, v: parseInput(cell) })))
    }
    if (updates.length) onSetCells(updates)
  }

  const clearSelection = () => {
    const updates: CellUpdate[] = []
    for (let r = sel.r1; r <= Math.min(sel.r2, data.length - 1); r++)
      for (let c = sel.c1; c <= sel.c2; c++) if (raw(r, c) !== null) updates.push({ r, c, v: null })
    if (updates.length) onSetCells(updates)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (edit) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key
    if (mod) {
      const lower = k.toLowerCase()
      if (lower === 'c') { e.preventDefault(); copy(false) }
      else if (lower === 'x') { e.preventDefault(); copy(true) }
      else if (lower === 'v') { e.preventDefault(); paste() }
      else if (lower === 'f') { e.preventDefault(); onShortcut('find') }
      else if (lower === 'd') { e.preventDefault(); onShortcut('fillDown') }
      else if (lower === 'r') { e.preventDefault(); onShortcut('fillRight') }
      else if (lower === 'a') { e.preventDefault(); setSel({ ar: 0, ac: 0, r1: 0, c1: 0, r2: Math.max(data.length - 1, 0), c2: nCols - 1 }) }
      else if (k === 'ArrowDown') { e.preventDefault(); jump(1, 0) }
      else if (k === 'ArrowUp') { e.preventDefault(); jump(-1, 0) }
      else if (k === 'ArrowRight') { e.preventDefault(); jump(0, 1) }
      else if (k === 'ArrowLeft') { e.preventDefault(); jump(0, -1) }
      return
    }
    switch (k) {
      case 'ArrowDown': e.preventDefault(); move(1, 0, e.shiftKey); break
      case 'ArrowUp': e.preventDefault(); move(-1, 0, e.shiftKey); break
      case 'ArrowRight': e.preventDefault(); move(0, 1, e.shiftKey); break
      case 'ArrowLeft': e.preventDefault(); move(0, -1, e.shiftKey); break
      case 'Enter': e.preventDefault(); move(e.shiftKey ? -1 : 1, 0, false); break
      case 'Tab': e.preventDefault(); move(0, e.shiftKey ? -1 : 1, false); break
      case 'F2': e.preventDefault(); startEdit(sel.ar, sel.ac); break
      case 'Delete': case 'Backspace': e.preventDefault(); clearSelection(); break
      case 'PageDown': e.preventDefault(); move(Math.floor(scroll.height / ROW_H), 0, e.shiftKey); break
      case 'PageUp': e.preventDefault(); move(-Math.floor(scroll.height / ROW_H), 0, e.shiftKey); break
      case 'Home': e.preventDefault(); setSel(selectCell(sel.ar, 0)); break
      default:
        if (k.length === 1) { e.preventDefault(); startEdit(sel.ar, sel.ac, k) }
    }
  }

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(e.shiftKey ? 'up' : 'down'); scrollRef.current?.focus() }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(e.shiftKey ? 'left' : 'right'); scrollRef.current?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); setEdit(null); scrollRef.current?.focus() }
  }

  const renderCell = (r: number, c: number, top: number) => {
    const v = raw(r, c)
    const computed = engine.getValue(props.sheetName, r, c)
    const inSel = r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2
    const active = r === sel.ar && c === sel.ac
    const header = freezeTop && r === 0
    const numeric = typeof computed === 'number'
    const err = isError(computed)
    // Mise en forme de la cellule (gras, couleurs, alignement, format de nombre, bordures)
    const fmt = props.formats?.[fmtKey(r, c)]
    const display = (fmt?.nf && applyNumberFormat(computed, fmt.nf)) ?? formatComputed(computed, v)
    const style = { left: colLeft[c], top, width: width(c), height: ROW_H, ...cellStyle(fmt) }
    return (
      <div
        key={c}
        data-cell={cellName(r, c)}
        onMouseDown={(e) => onCellMouseDown(e, r, c)}
        onMouseEnter={() => onCellMouseEnter(r, c)}
        onDoubleClick={() => startEdit(r, c)}
        className={`absolute border-r border-b border-gray-200 px-1.5 text-xs leading-[25px] whitespace-nowrap overflow-hidden select-none
          ${header && !fmt?.bg ? 'font-semibold bg-amber-50 text-gray-800' : ''}
          ${inSel && !active && !fmt?.bg ? 'bg-primary-50' : ''} ${numeric && !fmt?.a ? 'text-right' : ''} ${err ? 'text-red-600' : ''}
          ${active ? 'outline outline-2 -outline-offset-2 outline-primary-600 z-[1]' : ''}`}
        style={style}
        title={typeof v === 'string' && v.startsWith('=') ? v : undefined}
      >
        {display}
      </div>
    )
  }

  const rowHeader = (r: number, top: number, sticky: boolean) => {
    const on = r >= sel.r1 && r <= sel.r2
    return (
      <div
        key={`h${r}`}
        onMouseDown={(e) => {
          e.preventDefault()
          if (edit) commitEdit('none')
          setSel(e.shiftKey ? { ...normalizeSel(sel.ar, 0, r, nCols - 1), ac: sel.ac } : { ar: r, ac: 0, r1: r, c1: 0, r2: r, c2: nCols - 1 })
          scrollRef.current?.focus()
        }}
        className={`${sticky ? 'sticky' : 'absolute'} left-0 z-[2] border-r border-b border-gray-300 text-[11px] text-center leading-[25px] cursor-pointer ${on ? 'bg-primary-100 text-primary-800 font-semibold' : 'bg-gray-100 text-gray-500'}`}
        style={{ top, width: ROW_HEAD_W, height: ROW_H, ...(sticky ? {} : {}) }}
      >
        {r + 1}
      </div>
    )
  }

  const bodyRows = []
  for (let r = first; r <= last; r++) {
    const top = bodyTop + (r - bodyStart) * ROW_H
    bodyRows.push(
      <div key={r}>
        {Array.from({ length: nCols }, (_, c) => renderCell(r, c, top))}
      </div>,
    )
  }

  return (
    <div
      ref={scrollRef}
      data-grid
      tabIndex={0}
      onKeyDown={onKeyDown}
      onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}
      className="relative flex-1 overflow-auto bg-white outline-none"
    >
      <div className="relative" style={{ width: totalW, height: bodyTop + (nRows - bodyStart) * ROW_H }}>
        {/* Corps (lignes visibles) */}
        {bodyRows}
        {/* Numéros de ligne : collés à gauche */}
        <div className="sticky left-0 z-[2]" style={{ width: ROW_HEAD_W, height: 0 }}>
          {Array.from({ length: last - first + 1 }, (_, i) => {
            const r = first + i
            const top = bodyTop + (r - bodyStart) * ROW_H
            return <div key={r} className="absolute left-0">{rowHeader(r, top, false)}</div>
          })}
        </div>

        {/* Entêtes de colonnes + ligne 1 figée : collées en haut */}
        <div className="sticky top-0 z-[3]" style={{ width: totalW, height: 0 }}>
          <div className="absolute left-0 top-0 bg-gray-100" style={{ width: totalW, height: HEAD_H + frozenH }} />
          {Array.from({ length: nCols }, (_, c) => {
            const on = c >= sel.c1 && c <= sel.c2
            return (
              <div
                key={c}
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (edit) commitEdit('none')
                  const r2 = Math.max(data.length - 1, 0)
                  setSel(e.shiftKey ? { ...normalizeSel(0, sel.ac, r2, c), ar: sel.ar } : { ar: 0, ac: c, r1: 0, c1: c, r2, c2: c })
                  scrollRef.current?.focus()
                }}
                className={`absolute top-0 border-r border-b border-gray-300 text-[11px] text-center leading-[25px] cursor-pointer select-none ${on ? 'bg-primary-100 text-primary-800 font-semibold' : 'bg-gray-100 text-gray-500'}`}
                style={{ left: colLeft[c], width: width(c), height: HEAD_H }}
              >
                {colName(c)}
                <span
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); resize.current = { c, x: e.clientX, w: width(c) } }}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary-400"
                />
              </div>
            )
          })}
          {freezeTop && Array.from({ length: nCols }, (_, c) => renderCell(0, c, HEAD_H))}
          {/* coin + numéro de la ligne figée */}
          <div className="sticky left-0 z-[4]" style={{ width: ROW_HEAD_W, height: 0 }}>
            <div className="absolute left-0 top-0 bg-gray-200 border-r border-b border-gray-300" style={{ width: ROW_HEAD_W, height: HEAD_H }} />
            {freezeTop && <div className="absolute left-0">{rowHeader(0, HEAD_H, false)}</div>}
          </div>
        </div>

        {/* Éditeur posé sur la cellule */}
        {edit && (
          <input
            ref={inputRef}
            value={edit.text}
            onChange={(e) => setEdit({ ...edit, text: e.target.value })}
            onKeyDown={onEditKeyDown}
            className="absolute z-[5] px-1.5 text-xs border-2 border-primary-600 outline-none bg-white shadow"
            style={{
              left: colLeft[edit.c],
              top: freezeTop && edit.r === 0 ? HEAD_H + scroll.top : bodyTop + (edit.r - bodyStart) * ROW_H,
              width: Math.max(width(edit.c), 160),
              height: ROW_H,
            }}
          />
        )}
      </div>
    </div>
  )
}

/** Valeur saisie → valeur stockée (nombre, booléen, texte ou formule). */
export function parseInput(text: string): CellValue {
  const t = text.trim()
  if (t === '') return null
  if (t.startsWith('=')) return t
  const upper = t.toUpperCase()
  if (upper === 'VRAI' || upper === 'TRUE') return true
  if (upper === 'FAUX' || upper === 'FALSE') return false
  // 0707… (téléphones, codes) et très longs numéros restent du texte
  if (/^0\d/.test(t) || t.replace(/\D/g, '').length > 15) return t
  const n = Number(t.replace(/[\s ]/g, '').replace(',', '.'))
  if (/^[-+]?[\d\s ]*[.,]?\d+(e[-+]?\d+)?$/i.test(t) && Number.isFinite(n)) return n
  return t
}
