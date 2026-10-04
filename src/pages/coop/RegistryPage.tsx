import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveImportReport, registryImportReport } from '../../utils/report'
import * as XLSX from 'xlsx'
import {
  Save, Undo2, Redo2, Upload, Download, Calculator as CalcIcon, FunctionSquare, Plus, Trash2,
  ArrowDownToLine, ArrowUpToLine, Columns3, ArrowDownAZ, ArrowUpAZ, Search, ChevronsDown, Pin, Loader2, BookOpen,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import SpreadsheetGrid, {
  selectCell, parseInput, rawText, DEFAULT_COL_W, type Selection, type EditState, type CellUpdate,
} from '../../components/registry/SpreadsheetGrid'
import Calculator from '../../components/registry/Calculator'
import FunctionsHelp from '../../components/registry/FunctionsHelp'
import { WorkbookEngine, formatComputed, numericValue, isError } from '../../utils/spreadsheet/engine'
import { type CellFormat, mergeFormat, fmtKey, XLSX_NUMFMT } from '../../utils/spreadsheet/format'
import FormatToolbar from '../../components/registry/FormatToolbar'
import {
  cellName, shiftFormula, adjustForInsert, renameSheetInFormula, normalizeFormulaInput,
} from '../../utils/spreadsheet/refs'
import { readWorkbook, type ParsedWorkbook } from '../../utils/excelImport'
import { downloadBlob } from '../../utils/geoExport'
import { registryApi, type CellValue, type RegistrySheetDTO, type TableDef } from '../../api/registry'
import { useAppStore } from '../../store/appStore'

interface SheetState { key: string; id?: string; name: string; data: CellValue[][]; colWidths: number[]; formats: Record<string, CellFormat>; tables: TableDef[] }
interface SavedState { name: string; data: CellValue[][]; colWidths: number[]; formats: Record<string, CellFormat>; tables: TableDef[]; position: number }

const newKey = () => crypto.randomUUID()
const fromDTO = (s: RegistrySheetDTO): SheetState =>
  ({ key: newKey(), id: s.id, name: s.name, data: s.data ?? [], colWidths: s.col_widths ?? [],
     formats: (s.formats as Record<string, CellFormat>) ?? {}, tables: s.tables ?? [] })
const AUTOSAVE_MS = 20000
const FORBIDDEN_SHEET_CHARS = /[:\\/?*[\]]/

// Écrit des cellules sans recopier toute la feuille (les lignes non touchées sont partagées : annulation peu coûteuse)
function writeCells(data: CellValue[][], updates: CellUpdate[]): CellValue[][] {
  const out = data.slice()
  const copied = new Set<number>()
  for (const { r, c, v } of updates) {
    while (out.length <= r) out.push([])
    if (!copied.has(r)) { out[r] = out[r].slice(); copied.add(r) }
    const row = out[r]
    while (row.length <= c) row.push(null)
    row[c] = v
  }
  return out
}

// Applique une transformation à toutes les formules du classeur
function mapFormulas(sheets: SheetState[], fn: (formula: string, sheetName: string) => string): SheetState[] {
  return sheets.map((s) => {
    let changed = false
    const data = s.data.map((row) => {
      let rowChanged = false
      const next = row.map((v) => {
        if (typeof v !== 'string' || !v.startsWith('=')) return v
        const nv = fn(v, s.name)
        if (nv !== v) rowChanged = true
        return nv
      })
      if (rowChanged) { changed = true; return next }
      return row
    })
    return changed ? { ...s, data } : s
  })
}

export default function RegistryPage() {
  const { isLive, addNotification } = useAppStore()
  const [sheets, setSheets] = useState<SheetState[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sel, setSel] = useState<Selection>(selectCell(0, 0))
  const [edit, setEdit] = useState<EditState | null>(null)
  const [freezeTop, setFreezeTop] = useState(true)
  const [panel, setPanel] = useState<'calc' | 'functions' | null>(null)
  const [search, setSearch] = useState('')
  const [scrollToken, setScrollToken] = useState(0)
  const [pendingImport, setPendingImport] = useState<ParsedWorkbook | null>(null)
  const [, forceRender] = useState(0)
  const saved = useRef(new Map<string, SavedState>())
  const deletedIds = useRef<string[]>([])
  const history = useRef<{ past: SheetState[][]; future: SheetState[][] }>({ past: [], future: [] })
  const fileRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const engine = useMemo(() => new WorkbookEngine(), [])
  // Le moteur suit toujours l'état courant (recalcul complet à chaque modification)
  useMemo(() => engine.setSheets(sheets.map((s) => ({ name: s.name, data: s.data }))), [engine, sheets])

  const sheet = sheets[active]
  const sheetName = sheet?.name ?? ''

  const markSaved = (list: SheetState[]) => {
    saved.current = new Map(list.map((s, i) => [s.key, { name: s.name, data: s.data, colWidths: s.colWidths, formats: s.formats, tables: s.tables, position: i }]))
    deletedIds.current = []
  }

  // ─── Chargement ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    let list: SheetState[] = []
    if (isLive) {
      try {
        const { data } = await registryApi.list()
        list = data.map(fromDTO)
      } catch {
        addNotification({ type: 'error', title: 'Registre', message: 'Chargement impossible. Vérifiez la connexion.' })
      }
    }
    if (!list.length) list = [{ key: newKey(), name: 'Registre', data: [], colWidths: [], formats: {}, tables: [] }]
    // la feuille vide proposée par défaut n'est enregistrée qu'à la première saisie
    markSaved(list)
    history.current = { past: [], future: [] }
    setSheets(list)
    setActive(0)
    setSel(selectCell(0, 0))
    setLoading(false)
  }, [isLive, addNotification])

  useEffect(() => { load() }, [load])

  const dirtyCount = sheets.filter((s, i) => {
    const v = saved.current.get(s.key)
    return !v || v.data !== s.data || v.name !== s.name || v.colWidths !== s.colWidths || v.formats !== s.formats || v.tables !== s.tables || v.position !== i
  }).length + deletedIds.current.length

  // ─── Modifications (avec historique d'annulation) ───────────────────────
  const apply = useCallback((fn: (ss: SheetState[]) => SheetState[]) => {
    setSheets((prev) => {
      const next = fn(prev)
      if (next !== prev) {
        history.current.past.push(prev)
        if (history.current.past.length > 100) history.current.past.shift()
        history.current.future = []
      }
      return next
    })
  }, [])

  const setCells = useCallback((updates: CellUpdate[]) => {
    apply((ss) => ss.map((s, i) => (i === active ? { ...s, data: writeCells(s.data, updates) } : s)))
  }, [apply, active])

  const undo = () => {
    const prev = history.current.past.pop()
    if (!prev) return
    history.current.future.push(sheets)
    setSheets(prev)
    setActive((a) => Math.min(a, prev.length - 1))
  }
  const redo = () => {
    const next = history.current.future.pop()
    if (!next) return
    history.current.past.push(sheets)
    setSheets(next)
    setActive((a) => Math.min(a, next.length - 1))
  }

  const raw = (r: number, c: number): CellValue => sheet?.data[r]?.[c] ?? null

  const commitEdit = (move: 'down' | 'up' | 'right' | 'left' | 'none') => {
    if (!edit) return
    let v = parseInput(edit.text)
    if (typeof v === 'string' && v.startsWith('=')) v = normalizeFormulaInput(v)
    if (v !== raw(edit.r, edit.c)) setCells([{ r: edit.r, c: edit.c, v }])
    const { r, c } = edit
    setEdit(null)
    const d = { down: [1, 0], up: [-1, 0], right: [0, 1], left: [0, -1], none: [0, 0] }[move]
    setSel(selectCell(Math.max(0, r + d[0]), Math.max(0, c + d[1])))
  }

  const onColWidth = useCallback((c: number, w: number) => {
    // pas d'historique pour le redimensionnement
    setSheets((ss) => ss.map((s, i) => {
      if (i !== active) return s
      const widths = s.colWidths.slice()
      while (widths.length <= c) widths.push(DEFAULT_COL_W)
      widths[c] = Math.round(w)
      return { ...s, colWidths: widths }
    }))
  }, [active])

  // ─── Mise en forme (gras, couleurs, alignement, format de nombre, bordures) ─
  const applyFormat = (patch: Partial<CellFormat>) => {
    apply((ss) => ss.map((s, i) => {
      if (i !== active) return s
      const formats = { ...s.formats }
      for (let r = sel.r1; r <= sel.r2; r++)
        for (let c = sel.c1; c <= sel.c2; c++) {
          const merged = mergeFormat(formats[fmtKey(r, c)], patch)
          if (merged) formats[fmtKey(r, c)] = merged
          else delete formats[fmtKey(r, c)]
        }
      return { ...s, formats }
    }))
  }
  const clearFormat = () => {
    apply((ss) => ss.map((s, i) => {
      if (i !== active) return s
      const formats = { ...s.formats }
      for (let r = sel.r1; r <= sel.r2; r++)
        for (let c = sel.c1; c <= sel.c2; c++) delete formats[fmtKey(r, c)]
      return { ...s, formats }
    }))
  }
  // Format actuel de la cellule active (pour l'état des boutons de la barre d'outils)
  const activeFormat: CellFormat = sheet?.formats[fmtKey(sel.ar, sel.ac)] ?? {}

  // « Mettre sous forme de tableau » : entête en gras sur fond, lignes alternées, sur la sélection
  const makeTable = () => {
    if (!sheet) return
    const r1 = sel.r1, c1 = sel.c1, r2 = Math.max(sel.r2, sel.r1 + 1), c2 = sel.c2
    apply((ss) => ss.map((s, i) => {
      if (i !== active) return s
      const formats = { ...s.formats }
      for (let c = c1; c <= c2; c++)
        formats[fmtKey(r1, c)] = mergeFormat(formats[fmtKey(r1, c)], { b: true, bg: '#16a34a', c: '#ffffff' })!
      for (let r = r1 + 1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          formats[fmtKey(r, c)] = mergeFormat(formats[fmtKey(r, c)], { bg: (r - r1) % 2 === 0 ? '#f0fdf4' : '' })!
      const name = `Tableau${s.tables.length + 1}`
      return { ...s, formats, tables: [...s.tables, { name, r1, c1, r2, c2, style: 'green' }] }
    }))
    addNotification({ type: 'success', title: 'Tableau créé', message: 'Entête et lignes alternées appliquées. Utilisez Trier/Filtrer sur l\'entête.' })
  }

  // ─── Lignes / colonnes ───────────────────────────────────────────────────
  const insertRows = (below: boolean) => {
    const at = below ? sel.r2 + 1 : sel.r1
    const count = sel.r2 - sel.r1 + 1
    apply((ss) => {
      const adjusted = mapFormulas(ss, (f, sn) => adjustForInsert(f, sn, sheetName, 'row', at, count))
      return adjusted.map((s, i) => {
        if (i !== active || at > s.data.length) return s
        const data = s.data.slice()
        data.splice(at, 0, ...Array.from({ length: count }, () => [] as CellValue[]))
        return { ...s, data }
      })
    })
    if (!below) setSel({ ...sel, ar: sel.ar + count, r1: sel.r1 + count, r2: sel.r2 + count })
  }

  const deleteRows = () => {
    const at = sel.r1, count = sel.r2 - sel.r1 + 1
    if (count > 20 && !confirm(`Supprimer ${count} lignes ?`)) return
    apply((ss) => {
      const trimmed = ss.map((s, i) => {
        if (i !== active) return s
        const data = s.data.slice()
        data.splice(at, count)
        return { ...s, data }
      })
      return mapFormulas(trimmed, (f, sn) => adjustForInsert(f, sn, sheetName, 'row', at, -count))
    })
    setSel(selectCell(at, sel.ac))
  }

  const insertCols = () => {
    const at = sel.c1, count = sel.c2 - sel.c1 + 1
    apply((ss) => {
      const adjusted = mapFormulas(ss, (f, sn) => adjustForInsert(f, sn, sheetName, 'col', at, count))
      return adjusted.map((s, i) => {
        if (i !== active) return s
        const data = s.data.map((row) => {
          if (row.length <= at) return row
          const r = row.slice(); r.splice(at, 0, ...Array(count).fill(null)); return r
        })
        const colWidths = s.colWidths.slice()
        if (colWidths.length > at) colWidths.splice(at, 0, ...Array(count).fill(DEFAULT_COL_W))
        return { ...s, data, colWidths }
      })
    })
  }

  const deleteCols = () => {
    const at = sel.c1, count = sel.c2 - sel.c1 + 1
    apply((ss) => {
      const trimmed = ss.map((s, i) => {
        if (i !== active) return s
        const data = s.data.map((row) => { if (row.length <= at) return row; const r = row.slice(); r.splice(at, count); return r })
        const colWidths = s.colWidths.slice(); colWidths.splice(at, count)
        return { ...s, data, colWidths }
      })
      return mapFormulas(trimmed, (f, sn) => adjustForInsert(f, sn, sheetName, 'col', at, -count))
    })
    setSel(selectCell(sel.ar, at))
  }

  // ─── Recopie (Ctrl+D / Ctrl+R) ───────────────────────────────────────────
  const fill = (down: boolean) => {
    const updates: CellUpdate[] = []
    if (down) {
      const src = sel.r1 === sel.r2 ? sel.r1 - 1 : sel.r1
      if (src < 0) return
      for (let r = src + 1; r <= sel.r2; r++)
        for (let c = sel.c1; c <= sel.c2; c++) {
          const v = raw(src, c)
          updates.push({ r, c, v: typeof v === 'string' ? shiftFormula(v, r - src, 0) : v })
        }
    } else {
      const src = sel.c1 === sel.c2 ? sel.c1 - 1 : sel.c1
      if (src < 0) return
      for (let r = sel.r1; r <= sel.r2; r++)
        for (let c = src + 1; c <= sel.c2; c++) {
          const v = raw(r, src)
          updates.push({ r, c, v: typeof v === 'string' ? shiftFormula(v, 0, c - src) : v })
        }
    }
    if (updates.length) setCells(updates)
  }

  // ─── Tri sur la colonne active (entêtes de la ligne 1 conservées) ─────────
  const sort = (asc: boolean) => {
    if (!sheet) return
    const c = sel.ac
    const start = freezeTop ? 1 : 0
    // Comme Excel : on trie le bloc de données contigu, jusqu'à la première ligne vide (les totaux placés dessous ne bougent pas)
    const isEmpty = (row: CellValue[] | undefined) => !row || row.every((v) => v === null || v === '')
    let end = start
    while (end < sheet.data.length && !isEmpty(sheet.data[end])) end++
    if (end - start < 2) return
    const rows = sheet.data.slice(start, end).map((row, i) => ({ row, from: start + i, key: engine.getValue(sheetName, start + i, c) }))
    const rank = (v: unknown) => (v === null || v === '' ? 3 : typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2)
    rows.sort((a, b) => {
      const ra = rank(a.key), rb = rank(b.key)
      if (ra !== rb) return ra === 3 ? 1 : rb === 3 ? -1 : (asc ? ra - rb : rb - ra)
      if (ra === 3) return 0
      const cmp = typeof a.key === 'number' && typeof b.key === 'number'
        ? a.key - b.key
        : String(isError(a.key) ? a.key.error : a.key).localeCompare(String(isError(b.key) ? b.key.error : b.key), 'fr', { numeric: true, sensitivity: 'base' })
      return asc ? cmp : -cmp
    })
    apply((ss) => ss.map((s, i) => {
      if (i !== active) return s
      const data = [
        ...s.data.slice(0, start),
        // les formules d'une ligne déplacée suivent la ligne (références relatives décalées)
        ...rows.map((x, j) => x.row.map((v) => (typeof v === 'string' ? shiftFormula(v, start + j - x.from, 0) : v))),
        ...s.data.slice(end),
      ]
      return { ...s, data }
    }))
  }

  // ─── Recherche ───────────────────────────────────────────────────────────
  const findNext = () => {
    const q = search.trim().toLowerCase()
    if (!q || !sheet) return
    const data = sheet.data
    const R = data.length
    // de la cellule qui suit la cellule active jusqu'à la fin, puis retour au début
    for (let i = 0; i <= R; i++) {
      const r = (sel.ar + i) % Math.max(R, 1)
      for (let c = 0; c < (data[r]?.length ?? 0); c++) {
        if (i === 0 && c <= sel.ac) continue
        if (i === R && c >= sel.ac) break
        const text = formatComputed(engine.getValue(sheetName, r, c), data[r][c]).toLowerCase()
        if (text.includes(q)) { setSel(selectCell(r, c)); setScrollToken((t) => t + 1); return }
      }
    }
    addNotification({ type: 'info', title: 'Recherche', message: `« ${search} » introuvable dans la feuille.` })
  }

  // ─── Feuilles ────────────────────────────────────────────────────────────
  const uniqueName = (base: string, except?: number) => {
    let name = base, n = 1
    while (sheets.some((s, i) => i !== except && s.name.toLowerCase() === name.toLowerCase())) name = `${base} (${++n})`
    return name
  }

  const switchSheet = (i: number) => {
    if (edit) commitEdit('none')
    setActive(i)
    setSel(selectCell(0, 0))
  }

  const addSheet = () => {
    const name = uniqueName(`Feuil${sheets.length + 1}`)
    apply((ss) => [...ss, { key: newKey(), name, data: [], colWidths: [], formats: {}, tables: [] }])
    setActive(sheets.length)
    setSel(selectCell(0, 0))
  }

  const renameSheet = (i: number) => {
    const old = sheets[i].name
    const name = prompt('Nouveau nom de la feuille (31 caractères max.)', old)?.trim()
    if (!name || name === old) return
    if (name.length > 31 || FORBIDDEN_SHEET_CHARS.test(name)) { alert('Nom invalide : 31 caractères maximum, sans : \\ / ? * [ ]'); return }
    if (sheets.some((s, j) => j !== i && s.name.toLowerCase() === name.toLowerCase())) { alert('Une feuille porte déjà ce nom.'); return }
    apply((ss) => mapFormulas(ss.map((s, j) => (j === i ? { ...s, name } : s)), (f) => renameSheetInFormula(f, old, name)))
  }

  const deleteSheet = (i: number) => {
    if (sheets.length === 1) { alert('Le registre doit garder au moins une feuille.'); return }
    if (!confirm(`Supprimer la feuille « ${sheets[i].name} » et tout son contenu ?`)) return
    const id = sheets[i].id
    if (id) deletedIds.current.push(id)
    apply((ss) => ss.filter((_, j) => j !== i))
    setActive((a) => Math.max(0, a >= i ? a - 1 : a))
  }

  // ─── Enregistrement ──────────────────────────────────────────────────────
  const save = useCallback(async (silent = false) => {
    if (!isLive) {
      if (!silent) addNotification({ type: 'warning', title: 'Mode démo', message: 'Connectez-vous à un compte réel pour enregistrer le registre.' })
      return
    }
    if (saving) return
    setSaving(true)
    const current = sheets
    try {
      for (const id of deletedIds.current) await registryApi.remove(id)
      const ids = new Map<string, string>()
      for (let i = 0; i < current.length; i++) {
        const s = current[i]
        const v = saved.current.get(s.key)
        const payload = { name: s.name, data: s.data, col_widths: s.colWidths, formats: s.formats, tables: s.tables, position: i }
        if (!s.id) ids.set(s.key, (await registryApi.create(payload)).data.id)
        else if (!v || v.data !== s.data || v.name !== s.name || v.colWidths !== s.colWidths || v.position !== i) {
          await registryApi.update(s.id, payload)
        }
      }
      const withIds = current.map((s) => (ids.has(s.key) ? { ...s, id: ids.get(s.key) } : s))
      markSaved(withIds)
      if (ids.size) setSheets((ss) => ss.map((s) => (ids.has(s.key) ? { ...s, id: ids.get(s.key) } : s)))
      forceRender((n) => n + 1)
      if (!silent) addNotification({ type: 'success', title: 'Registre enregistré', message: `${current.length} feuille(s) à jour.` })
    } catch (err) {
      const detail = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      addNotification({ type: 'error', title: 'Échec de l\'enregistrement', message: detail ? JSON.stringify(detail).slice(0, 200) : 'Serveur injoignable.' })
    } finally {
      setSaving(false)
    }
  }, [isLive, saving, sheets, addNotification])

  // Sauvegarde automatique après 20 s sans modification
  useEffect(() => {
    if (!isLive || !dirtyCount || loading) return
    const t = setTimeout(() => save(true), AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [sheets, isLive, dirtyCount, loading, save])

  // Ctrl+Z / Ctrl+Y / Ctrl+S valables sur toute la page (hors champs texte, qui gardent leur propre annulation)
  const shortcuts = useRef({ undo: () => {}, redo: () => {}, save: () => {}, fmt: (_: Partial<CellFormat>) => {}, active: {} as CellFormat })
  shortcuts.current = { undo, redo, save: () => { save() }, fmt: applyFormat, active: activeFormat }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const target = e.target as HTMLElement
      const k = e.key.toLowerCase()
      if (k === 's') { e.preventDefault(); shortcuts.current.save(); return }
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) shortcuts.current.redo(); else shortcuts.current.undo() }
      else if (k === 'y') { e.preventDefault(); shortcuts.current.redo() }
      else if (k === 'b') { e.preventDefault(); shortcuts.current.fmt({ b: !shortcuts.current.active.b }) }
      else if (k === 'i') { e.preventDefault(); shortcuts.current.fmt({ i: !shortcuts.current.active.i }) }
      else if (k === 'u') { e.preventDefault(); shortcuts.current.fmt({ u: !shortcuts.current.active.u }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyCount) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyCount])

  // ─── Import / export Excel ───────────────────────────────────────────────
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    try {
      setPendingImport(await readWorkbook(file))
    } catch {
      addNotification({ type: 'error', title: 'Import', message: 'Impossible de lire ce fichier Excel.' })
    }
  }

  const confirmImport = async (mode: 'replace' | 'merge') => {
    const wb = pendingImport
    setPendingImport(null)
    if (!wb) return
    const incoming = wb.sheets.filter((s) => s.data.length || wb.sheets.length === 1)
    if (isLive) {
      try {
        if (dirtyCount) await save(true)
        const { data } = await registryApi.importWorkbook(
          incoming.map((s, i) => ({ name: s.name, data: s.data, col_widths: s.colWidths, formats: {}, tables: [], position: i })), wb.fileName, mode)
        const list = data.map(fromDTO)
        markSaved(list)
        history.current = { past: [], future: [] }
        setSheets(list)
      } catch {
        addNotification({ type: 'error', title: 'Import', message: 'Enregistrement du classeur impossible.' })
        return
      }
    } else {
      const imported = incoming.map((s) => ({ key: newKey(), name: s.name, data: s.data, colWidths: s.colWidths, formats: {}, tables: [] }))
      apply((ss) => (mode === 'replace' ? imported : [...ss.filter((s) => !imported.some((n) => n.name === s.name)), ...imported]))
    }
    setActive(0)
    setSel(selectCell(0, 0))
    addNotification({ type: 'success', title: 'Classeur importé', message: `${incoming.length} feuille(s) depuis ${wb.fileName}. Rapport disponible dans « Rapports ».` })
    if (isLive) saveImportReport(registryImportReport(wb.fileName, incoming, mode))
  }

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new()
    for (const s of sheets) {
      const ws: XLSX.WorkSheet = {}
      let maxC = 0
      s.data.forEach((row, r) => row.forEach((v, c) => {
        if (v === null || v === '') return
        maxC = Math.max(maxC, c)
        const addr = XLSX.utils.encode_cell({ r, c })
        if (typeof v === 'string' && v.startsWith('=')) {
          const cv = engine.getValue(s.name, r, c)
          const val = isError(cv) ? cv.error : cv
          ws[addr] = { t: typeof val === 'number' ? 'n' : typeof val === 'boolean' ? 'b' : 's', v: val ?? '', f: v.slice(1) }
        } else {
          ws[addr] = { t: typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : 's', v }
        }
        // Format de nombre (monnaie, pourcentage, date…) : SheetJS l'écrit dans le .xlsx
        const nf = s.formats[fmtKey(r, c)]?.nf
        const z = nf && XLSX_NUMFMT[nf]
        if (z && ws[addr].t === 'n') ws[addr].z = z
      }))
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(s.data.length - 1, 0), c: maxC } })
      ws['!cols'] = s.colWidths.map((w) => ({ wpx: w }))
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
    }
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `registre_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ─── Statistiques de la sélection (barre d'état) ─────────────────────────
  const stats = useMemo(() => {
    if (!sheet) return null
    let sum = 0, count = 0, filled = 0, min = Infinity, max = -Infinity
    const r2 = Math.min(sel.r2, sheet.data.length - 1)
    let visited = 0
    for (let r = sel.r1; r <= r2 && visited < 300000; r++) {
      const c2 = Math.min(sel.c2, (sheet.data[r]?.length ?? 0) - 1)
      for (let c = sel.c1; c <= c2; c++) {
        visited++
        const v = engine.getValue(sheetName, r, c)
        if (v === null || v === '') continue
        filled++
        const n = numericValue(v)
        if (n === null || typeof v !== 'number') continue
        sum += n; count++; min = Math.min(min, n); max = Math.max(max, n)
      }
    }
    return { sum, count, filled, min, max, avg: count ? sum / count : 0 }
  }, [sel, sheet, sheetName, engine])

  const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 4 })
  const selRef = sel.r1 === sel.r2 && sel.c1 === sel.c2 ? cellName(sel.r1, sel.c1) : `${cellName(sel.r1, sel.c1)}:${cellName(sel.r2, sel.c2)}`

  const insertFromCalculator = (text: string) => {
    let v = parseInput(text)
    if (typeof v === 'string' && v.startsWith('=')) v = normalizeFormulaInput(v)
    setCells([{ r: sel.ar, c: sel.ac, v }])
  }
  const insertFunction = (name: string) =>
    setEdit(edit ? { ...edit, text: `${edit.text}${name}(` } : { r: sel.ar, c: sel.ac, text: `=${name}(` })

  const onShortcut = (a: 'find' | 'fillDown' | 'fillRight') => {
    if (a === 'find') searchRef.current?.focus()
    else if (a === 'fillDown') fill(true)
    else fill(false)
  }

  const btn = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent'
  const sep = <span className="w-px h-5 bg-gray-200 mx-1" />

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Chargement du registre…</div>
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 pt-6">
        <Header title="Registre des producteurs" subtitle="Classeur de la coopérative : feuilles, entêtes et formules du fichier Excel" />
      </div>

      {!isLive && (
        <p className="mx-6 mt-2 text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
          Mode démo : les modifications restent sur cet appareil. Connectez-vous à un compte réel pour enregistrer le registre.
        </p>
      )}

      {/* Barre d'outils (après un clic, le clavier revient à la grille) */}
      <div
        onClick={(e) => { if ((e.target as HTMLElement).closest('button')) document.querySelector<HTMLElement>('[data-grid]')?.focus() }}
        className="mx-6 mt-3 flex flex-wrap items-center gap-0.5 bg-white border border-gray-200 rounded-xl px-2 py-1"
      >
        <button onClick={() => save()} disabled={saving || !dirtyCount} className={`${btn} ${dirtyCount ? 'text-primary-700' : ''}`} title="Enregistrer (Ctrl+S)">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {dirtyCount ? `Enregistrer (${dirtyCount})` : 'Enregistré'}
        </button>
        <button onClick={undo} disabled={!history.current.past.length} className={btn} title="Annuler (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
        <button onClick={redo} disabled={!history.current.future.length} className={btn} title="Rétablir (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
        {sep}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsm,.csv,.ods" onChange={onImportFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className={btn}><Upload className="w-4 h-4" /> Importer Excel</button>
        <button onClick={exportXlsx} className={btn}><Download className="w-4 h-4" /> Exporter Excel</button>
        {sep}
        <button onClick={() => insertRows(false)} className={btn} title="Insérer des lignes au-dessus"><ArrowUpToLine className="w-4 h-4" /> Ligne</button>
        <button onClick={() => insertRows(true)} className={btn} title="Insérer des lignes en dessous"><ArrowDownToLine className="w-4 h-4" /> Ligne</button>
        <button onClick={deleteRows} className={btn} title="Supprimer les lignes sélectionnées"><Trash2 className="w-4 h-4" /> Lignes</button>
        <button onClick={insertCols} className={btn} title="Insérer des colonnes à gauche"><Columns3 className="w-4 h-4" /> + Colonne</button>
        <button onClick={deleteCols} className={btn} title="Supprimer les colonnes sélectionnées"><Trash2 className="w-4 h-4" /> Colonnes</button>
        <button onClick={() => fill(true)} className={btn} title="Recopier vers le bas (Ctrl+D)"><ChevronsDown className="w-4 h-4" /> Recopier</button>
        {sep}
        <button onClick={() => sort(true)} className={btn} title="Trier la feuille selon la colonne active (A→Z)"><ArrowDownAZ className="w-4 h-4" /></button>
        <button onClick={() => sort(false)} className={btn} title="Trier la feuille selon la colonne active (Z→A)"><ArrowUpAZ className="w-4 h-4" /></button>
        <button onClick={() => setFreezeTop((f) => !f)} className={`${btn} ${freezeTop ? 'text-primary-700' : ''}`} title="Figer la ligne des entêtes"><Pin className="w-4 h-4" /> Entêtes</button>
        {sep}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findNext() } }}
            placeholder="Rechercher (Entrée)" className="pl-7 pr-2 py-1.5 w-44 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={() => setPanel(panel === 'functions' ? null : 'functions')} className={`${btn} ${panel === 'functions' ? 'bg-primary-50 text-primary-700' : ''}`}>
            <FunctionSquare className="w-4 h-4" /> Fonctions
          </button>
          <button onClick={() => setPanel(panel === 'calc' ? null : 'calc')} className={`${btn} ${panel === 'calc' ? 'bg-primary-50 text-primary-700' : ''}`}>
            <CalcIcon className="w-4 h-4" /> Calculatrice
          </button>
        </div>
      </div>

      {/* Barre de mise en forme */}
      <FormatToolbar active={activeFormat} onApply={applyFormat} onClear={clearFormat} onTable={makeTable} />

      {/* Barre de formule */}
      <div className="mx-6 mt-2 flex items-center gap-2">
        <span className="w-24 text-center font-mono text-xs bg-gray-100 rounded-lg py-1.5 text-gray-700">{selRef}</span>
        <span className="text-gray-400 italic font-serif text-sm">fx</span>
        <input
          value={edit ? edit.text : rawText(raw(sel.ar, sel.ac))}
          onChange={(e) => setEdit({ r: edit?.r ?? sel.ar, c: edit?.c ?? sel.ac, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit('down') }
            else if (e.key === 'Escape') setEdit(null)
          }}
          placeholder="Valeur ou formule (ex. =SOMME(K2:K500) ou =NB.SI(E2:E500;&quot;Femme&quot;))"
          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Grille + panneau latéral */}
      <div className="flex-1 min-h-0 mx-6 mt-2 flex border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col">
          {sheet && (
            <SpreadsheetGrid
              key={sheet.key}
              data={sheet.data}
              colWidths={sheet.colWidths}
              sheetName={sheetName}
              engine={engine}
              sel={sel}
              setSel={(s) => { setSel(s); setScrollToken((t) => t + 1) }}
              edit={edit}
              setEdit={setEdit}
              commitEdit={commitEdit}
              freezeTop={freezeTop}
              onSetCells={setCells}
              formats={sheet.formats}
              onColWidth={onColWidth}
              onShortcut={onShortcut}
              scrollToken={scrollToken}
            />
          )}
          {/* Onglets des feuilles */}
          <div className="flex items-center gap-1 border-t border-gray-200 bg-gray-50 px-2 py-1 overflow-x-auto">
            <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0 mr-1" />
            {sheets.map((s, i) => (
              <div key={s.key} className={`group flex items-center rounded-lg text-xs flex-shrink-0 ${i === active ? 'bg-white shadow-sm border border-gray-200 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
                <button onClick={() => switchSheet(i)} onDoubleClick={() => renameSheet(i)} title="Double-clic pour renommer" className="px-3 py-1.5">
                  {s.name}
                </button>
                {i === active && sheets.length > 1 && (
                  <button onClick={() => deleteSheet(i)} className="pr-2 text-gray-400 hover:text-red-600" title="Supprimer la feuille">×</button>
                )}
              </div>
            ))}
            <button onClick={addSheet} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 flex-shrink-0" title="Nouvelle feuille"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
        {panel === 'calc' && (
          <Calculator engine={engine} sheetName={sheetName} selectionRef={selRef} onInsert={insertFromCalculator} onClose={() => setPanel(null)} />
        )}
        {panel === 'functions' && <FunctionsHelp onInsert={insertFunction} onClose={() => setPanel(null)} />}
      </div>

      {/* Barre d'état */}
      <div className="mx-6 mb-4 mt-1.5 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span>{sheet?.data.length ?? 0} ligne(s) · {sheets.length} feuille(s)</span>
        {stats && stats.filled > 1 && (
          <>
            <span>Nb : <b className="text-gray-800">{stats.filled}</b></span>
            {stats.count > 0 && <>
              <span>Somme : <b className="text-gray-800">{fmt(stats.sum)}</b></span>
              <span>Moyenne : <b className="text-gray-800">{fmt(stats.avg)}</b></span>
              <span>Min : <b className="text-gray-800">{fmt(stats.min)}</b></span>
              <span>Max : <b className="text-gray-800">{fmt(stats.max)}</b></span>
            </>}
          </>
        )}
        <span className="ml-auto">{isLive ? (dirtyCount ? 'Modifications non enregistrées (sauvegarde automatique)' : 'Tout est enregistré') : 'Mode démo'}</span>
      </div>

      {/* Choix du mode d'import */}
      {pendingImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Importer « {pendingImport.fileName} »</h3>
            <p className="text-sm text-gray-600">
              {pendingImport.sheets.length} feuille(s) : {pendingImport.sheets.map((s) => s.name).join(', ')}.
              Les entêtes et les formules sont conservées.
            </p>
            <div className="space-y-2">
              <button onClick={() => confirmImport('merge')} className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-primary-400 hover:bg-primary-50/40">
                <p className="font-semibold text-sm text-gray-900">Ajouter au registre</p>
                <p className="text-xs text-gray-500">Les feuilles de même nom sont remplacées, les autres sont conservées.</p>
              </button>
              <button onClick={() => confirmImport('replace')} className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50/40">
                <p className="font-semibold text-sm text-gray-900">Remplacer tout le registre</p>
                <p className="text-xs text-gray-500">Toutes les feuilles actuelles sont supprimées.</p>
              </button>
            </div>
            <button onClick={() => setPendingImport(null)} className="w-full py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-xl">Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
