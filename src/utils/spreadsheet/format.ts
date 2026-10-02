// Mise en forme des cellules du Registre : gras, couleurs, alignement, formats de nombres, bordures.
import type { CSSProperties } from 'react'
import { serialToDate, type Computed, isError } from './engine'

export interface CellFormat {
  b?: boolean          // gras
  i?: boolean          // italique
  u?: boolean          // souligné
  c?: string           // couleur du texte
  bg?: string          // couleur de fond
  a?: 'left' | 'center' | 'right'   // alignement horizontal
  nf?: NumberFormatId  // format de nombre
  bd?: string          // bordures : combinaison de t,b,l,r (haut/bas/gauche/droite)
  sz?: number          // taille de police (px)
}

export type NumberFormatId = 'general' | 'int' | 'dec2' | 'thousands' | 'money' | 'percent' | 'date' | 'datetime'

export const NUMBER_FORMATS: { id: NumberFormatId; label: string; example: string }[] = [
  { id: 'general', label: 'Général', example: '1234,5' },
  { id: 'int', label: 'Nombre entier', example: '1 235' },
  { id: 'dec2', label: 'Nombre (2 décimales)', example: '1 234,50' },
  { id: 'thousands', label: 'Milliers', example: '1 234 500' },
  { id: 'money', label: 'Monnaie (FCFA)', example: '1 235 FCFA' },
  { id: 'percent', label: 'Pourcentage', example: '12,5 %' },
  { id: 'date', label: 'Date', example: '01/06/2026' },
  { id: 'datetime', label: 'Date et heure', example: '01/06/2026 14:30' },
]

// Code de format Excel correspondant (pour l'export .xlsx : SheetJS écrit ces formats de nombres)
export const XLSX_NUMFMT: Record<NumberFormatId, string | undefined> = {
  general: undefined, int: '#,##0', dec2: '#,##0.00', thousands: '#,##0',
  money: '#,##0" FCFA"', percent: '0.0%', date: 'dd/mm/yyyy', datetime: 'dd/mm/yyyy hh:mm',
}

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nfG = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 10 })

function serialToDateTime(serial: number): string {
  const whole = Math.floor(serial)
  const frac = serial - whole
  const mins = Math.round(frac * 24 * 60)
  const h = String(Math.floor(mins / 60)).padStart(2, '0')
  const m = String(mins % 60).padStart(2, '0')
  return `${serialToDate(whole)} ${h}:${m}`
}

/** Valeur calculée + format -> texte affiché. Renvoie null si le format ne s'applique pas (texte, erreur…). */
export function applyNumberFormat(value: Computed, nf?: NumberFormatId): string | null {
  if (!nf || nf === 'general' || value === null || typeof value === 'boolean' || isError(value)) return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n)) return null
  switch (nf) {
    case 'int': return nf0.format(Math.round(n))
    case 'dec2': return nf2.format(n)
    case 'thousands': return nf0.format(Math.round(n))
    case 'money': return `${nf0.format(Math.round(n))} FCFA`
    case 'percent': return `${nfG.format(Math.round(n * 1000) / 10)} %`
    case 'date': return serialToDate(n)
    case 'datetime': return serialToDateTime(n)
    default: return null
  }
}

/** Style CSS d'une cellule d'après sa mise en forme. */
export function cellStyle(fmt?: CellFormat): CSSProperties {
  if (!fmt) return {}
  const st: CSSProperties = {}
  if (fmt.b) st.fontWeight = 700
  if (fmt.i) st.fontStyle = 'italic'
  if (fmt.u) st.textDecoration = 'underline'
  if (fmt.c) st.color = fmt.c
  if (fmt.bg) st.backgroundColor = fmt.bg
  if (fmt.a) st.textAlign = fmt.a
  if (fmt.sz) st.fontSize = `${fmt.sz}px`
  if (fmt.bd) {
    const b = '1px solid #475569'
    if (fmt.bd.includes('t')) st.borderTop = b
    if (fmt.bd.includes('b')) st.borderBottom = b
    if (fmt.bd.includes('l')) st.borderLeft = b
    if (fmt.bd.includes('r')) st.borderRight = b
  }
  return st
}

export const fmtKey = (r: number, c: number) => `${r}:${c}`

/** Fusionne une mise en forme partielle ; une valeur false/'' efface l'attribut. */
export function mergeFormat(cur: CellFormat | undefined, patch: Partial<CellFormat>): CellFormat | undefined {
  const next: CellFormat = { ...cur }
  for (const [k, v] of Object.entries(patch)) {
    if (v === false || v === '' || v === undefined || v === null) delete (next as Record<string, unknown>)[k]
    else (next as Record<string, unknown>)[k] = v
  }
  return Object.keys(next).length ? next : undefined
}

// Palettes proposées dans les sélecteurs de couleur
export const TEXT_COLORS = ['#111827', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#be185d', '#ffffff']
export const FILL_COLORS = ['', '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe', '#fce7f3', '#f3f4f6', '#111827']
