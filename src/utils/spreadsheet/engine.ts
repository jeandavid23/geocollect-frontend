// Moteur de calcul du Registre : évalue les formules Excel des feuilles.
// - fast-formula-parser (MIT) : analyse des formules, références A1 / plages / autres feuilles ;
// - @formulajs/formulajs (MIT) : complète les fonctions absentes (MATCH, COUNTIFS, TEXTJOIN…) ;
// - XLOOKUP ajouté ici.
// Les valeurs calculées sont mises en cache et recalculées à chaque modification.
import FormulaParser, { type FunctionArg } from 'fast-formula-parser'
import * as formulajs from '@formulajs/formulajs'
import type { CellValue } from '../../api/registry'

const { FormulaError } = FormulaParser

export interface CellError { error: string }
export type Computed = number | string | boolean | null | CellError

export const isError = (v: unknown): v is CellError =>
  typeof v === 'object' && v !== null && typeof (v as CellError).error === 'string'

const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const toSerial = (d: Date) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EXCEL_EPOCH) / 86400000

type Fn = (...args: FunctionArg[]) => unknown

// ─── Catalogue des fonctions ────────────────────────────────────────────────

const flatten = (v: unknown): unknown[] => (Array.isArray(v) ? v.flat(Infinity) : [v])

function buildFunctions(): Record<string, Fn> {
  const builtin = new FormulaParser({}).functions as Record<string, Fn>
  const custom: Record<string, Fn> = {}

  const register = (name: string, fn: (...a: unknown[]) => unknown) => {
    const b = builtin[name]
    custom[name] = (...args: FunctionArg[]) => {
      // la version native d'abord (elle comprend mieux les plages), formulajs en secours
      if (b) {
        try {
          const r = b(...args)
          if (r !== undefined) return r
        } catch (e) {
          if (!(e instanceof FormulaError)) throw e
          if (e.error !== '#NAME?') return e
        }
      }
      const r = fn(...args.map((a) => (a.omitted ? undefined : a.value)))
      if (r instanceof Error) return new FormulaError(r.message.startsWith('#') ? r.message : '#VALUE!')
      if (r instanceof Date) return toSerial(r)
      return r
    }
  }

  for (const [name, fn] of Object.entries(formulajs)) {
    if (typeof fn === 'function' && name === name.toUpperCase()) register(name, fn as (...a: unknown[]) => unknown)
    // fonctions « à point » : STDEV.S, VAR.P, RANK.EQ…
    else if (fn && typeof fn === 'object' && name === name.toUpperCase()) {
      for (const [sub, subFn] of Object.entries(fn as Record<string, unknown>)) {
        if (typeof subFn === 'function') register(`${name}.${sub}`, subFn as (...a: unknown[]) => unknown)
      }
    }
  }

  // Anciennes fonctions Excel = versions « échantillon »
  const alias = (from: string, to: string) => { if (!custom[from] && !builtin[from] && custom[to]) custom[from] = custom[to] }
  alias('STDEV', 'STDEV.S'); alias('VAR', 'VAR.S'); alias('STDEVP', 'STDEV.P'); alias('VARP', 'VAR.P')

  // XLOOKUP(valeur ; plage_recherche ; plage_retour ; [si_absent] ; [mode] )
  custom.XLOOKUP = (lookup, lookupArr, returnArr, ifNotFound) => {
    const keys = flatten(lookupArr.value)
    const target = lookup.value
    const idx = keys.findIndex((k) =>
      typeof k === 'string' && typeof target === 'string' ? k.toLowerCase() === target.toLowerCase() : k === target)
    if (idx < 0) return ifNotFound && !ifNotFound.omitted ? ifNotFound.value : new FormulaError('#N/A')
    const ret = returnArr.value
    if (Array.isArray(ret)) {
      const rows = ret as unknown[][]
      // plage de retour verticale (une colonne) ou horizontale (une ligne)
      return rows.length > 1 ? rows[idx]?.[0] ?? null : rows[0]?.[idx] ?? null
    }
    return ret
  }

  return custom
}

let FUNCTIONS: Record<string, Fn> | null = null
const functions = () => (FUNCTIONS ??= buildFunctions())

/** Noms de toutes les fonctions disponibles (aide / auto-complétion). */
export function availableFunctions(): string[] {
  const builtin = Object.keys(new FormulaParser({}).functions)
  return [...new Set([...builtin, ...Object.keys(functions())])].sort()
}

// ─── Moteur ─────────────────────────────────────────────────────────────────

export interface EngineSheet { name: string; data: CellValue[][] }

export class WorkbookEngine {
  private sheets = new Map<string, EngineSheet>()
  private cache = new Map<string, Computed>()
  private evaluating = new Set<string>()
  private parser: FormulaParser
  private currentSheet = ''
  // Longues chaînes de formules (cumul ligne à ligne) : au-delà de MAX_DEPTH appels imbriqués,
  // on interrompt, puis on calcule la feuille dans l'ordre pour que chaque formule trouve ses dépendances en cache.
  private tooDeep = false
  private warming = false
  private static MAX_DEPTH = 150

  constructor(sheets: EngineSheet[] = []) {
    this.setSheets(sheets)
    this.parser = new FormulaParser({
      functions: functions(),
      onCell: ({ sheet, row, col }) => this.valueForParser(sheet ?? this.currentSheet, row - 1, col - 1),
      onRange: ({ sheet, from, to }) => {
        const s = this.sheet(sheet ?? this.currentSheet)
        // colonne entière (A:A) ou ligne entière (1:1) : on s'arrête aux dernières cellules remplies
        const lastRow = to.row > 100000 ? Math.max(s?.data.length ?? 0, from.row) : to.row
        const width = Math.max(0, ...(s?.data ?? []).map((row) => row.length))
        const lastCol = to.col > 1000 ? Math.max(width, from.col) : to.col
        const out: unknown[][] = []
        for (let r = from.row; r <= lastRow; r++) {
          const row: unknown[] = []
          for (let c = from.col; c <= lastCol; c++) row.push(this.valueForParser(sheet ?? this.currentSheet, r - 1, c - 1))
          out.push(row)
        }
        return out
      },
    })
  }

  setSheets(sheets: EngineSheet[]) {
    this.sheets = new Map(sheets.map((s) => [s.name.toLowerCase(), s]))
    this.cache.clear()
  }

  /** À appeler après chaque modification de cellule. */
  invalidate() { this.cache.clear() }

  private sheet(name: string) { return this.sheets.get(name.toLowerCase()) }

  private valueForParser(sheetName: string, r: number, c: number): unknown {
    const v = this.getValue(sheetName, r, c)
    return isError(v) ? new FormulaError(v.error) : v
  }

  /** Valeur affichée d'une cellule (r, c à partir de 0). */
  getValue(sheetName: string, r: number, c: number): Computed {
    const raw = this.sheet(sheetName)?.data[r]?.[c] ?? null
    if (typeof raw !== 'string' || !raw.startsWith('=') || raw.length < 2) return raw === '' ? null : raw
    const key = `${sheetName.toLowerCase()}!${r},${c}`
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached
    if (this.evaluating.has(key)) return { error: '#CIRC!' } // référence circulaire
    if (this.evaluating.size >= WorkbookEngine.MAX_DEPTH) {
      this.tooDeep = true
      return { error: '#DEPTH!' }
    }

    const top = this.evaluating.size === 0
    const result = this.compute(key, sheetName, r, c, raw)
    if (!top || !this.tooDeep) return result

    // Chaîne trop longue : calcul de la feuille dans l'ordre (haut → bas, puis bas → haut)
    if (this.warming) return result // warmUp lit tooDeep pour compter les échecs
    this.tooDeep = false
    this.warming = true
    try {
      for (const reverse of [false, true]) {
        this.warmUp(sheetName, reverse)
        this.tooDeep = false
        const retry = this.compute(key, sheetName, r, c, raw)
        if (!this.tooDeep) return retry
        this.tooDeep = false
      }
      return { error: '#DEPTH!' }
    } finally {
      this.warming = false
    }
  }

  private compute(key: string, sheetName: string, r: number, c: number, formula: string): Computed {
    this.evaluating.add(key)
    const previous = this.currentSheet
    this.currentSheet = this.sheet(sheetName)?.name ?? sheetName
    let result: Computed
    try {
      result = normalizeResult(this.parser.parse(formula.slice(1), { sheet: this.currentSheet, row: r + 1, col: c + 1 }))
    } catch (e) {
      result = { error: errorCode(e) }
    } finally {
      this.currentSheet = previous
      this.evaluating.delete(key)
    }
    // un résultat obtenu pendant une chaîne interrompue est faux : on ne le garde pas
    if (!this.tooDeep) this.cache.set(key, result)
    return result
  }

  private warmUp(sheetName: string, reverse: boolean) {
    const data = this.sheet(sheetName)?.data ?? []
    let failures = 0 // échecs consécutifs : mauvais sens de parcours, inutile d'insister
    outer: for (let i = 0; i < data.length; i++) {
      const r = reverse ? data.length - 1 - i : i
      for (let c = 0; c < (data[r]?.length ?? 0); c++) {
        const v = data[r][c]
        if (typeof v === 'string' && v.startsWith('=')) {
          this.tooDeep = false
          this.getValue(sheetName, r, c)
          failures = this.tooDeep ? failures + 1 : 0
          if (failures >= 3) break outer
        }
      }
    }
    this.tooDeep = false
  }

  /** Évalue une expression libre (calculatrice) dans le contexte d'une feuille. */
  evaluate(expression: string, sheetName: string): Computed {
    const formula = expression.startsWith('=') ? expression.slice(1) : expression
    if (!formula.trim()) return null
    this.currentSheet = this.sheet(sheetName)?.name ?? sheetName
    try {
      return normalizeResult(this.parser.parse(formula, { sheet: this.currentSheet, row: 1, col: 1 }))
    } catch (e) {
      return { error: errorCode(e) }
    }
  }
}

function errorCode(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? '')
  if (/not implemented/i.test(msg)) return '#NAME?' // fonction inconnue
  return e instanceof FormulaError ? e.error : '#ERROR!'
}

function normalizeResult(v: unknown): Computed {
  if (v instanceof FormulaError) return { error: /not implemented/i.test(v.message ?? '') ? '#NAME?' : v.error }
  if (Array.isArray(v)) return normalizeResult((v as unknown[][])[0]?.[0] ?? (v as unknown[])[0] ?? null)
  if (v instanceof Date) return toSerial(v)
  if (typeof v === 'number') return Number.isFinite(v) ? v : { error: '#NUM!' }
  if (typeof v === 'string' || typeof v === 'boolean' || v === null) return v
  if (v === undefined) return null
  return String(v)
}

// ─── Affichage ──────────────────────────────────────────────────────────────

const DATE_FORMULA = /^=\s*(TODAY|NOW|DATE|EDATE|EOMONTH|WORKDAY|DATEVALUE)\s*\(/i

export function serialToDate(serial: number): string {
  const d = new Date(EXCEL_EPOCH + Math.round(serial) * 86400000)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

/** Texte affiché dans la grille. */
export function formatComputed(v: Computed, raw?: CellValue): string {
  if (v === null) return ''
  if (isError(v)) return v.error
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX'
  if (typeof v === 'number') {
    if (typeof raw === 'string' && DATE_FORMULA.test(raw)) return serialToDate(v)
    if (Number.isInteger(v)) return String(v)
    return String(Math.round(v * 1e10) / 1e10).replace('.', ',')
  }
  return v
}

/** Nombre utilisable pour les statistiques de sélection (somme, moyenne…). */
export function numericValue(v: Computed): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v.replace(',', '.')))) return Number(v.replace(',', '.'))
  return null
}
