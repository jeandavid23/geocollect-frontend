// Références A1, recopie de formules et saisie en français.
// Les formules sont stockées en syntaxe Excel anglaise (=SUM(B2:B9)) pour rester
// compatibles avec les fichiers .xlsx ; la saisie française (=SOMME(B2:B9;2)) est convertie.

export function colName(c: number): string {
  let s = ''
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

export function colIndex(name: string): number {
  let n = 0
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export const cellName = (r: number, c: number) => `${colName(c)}${r + 1}`

/** Nom de feuille utilisable dans une formule : 'Mes producteurs'!A1 */
export function sheetPrefix(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) ? `${name}!` : `'${name.replace(/'/g, "''")}'!`
}

// Découpe une formule en segments « code » et « chaîne » ("…") pour ne jamais toucher aux textes
function splitStrings(formula: string): { code: boolean; text: string }[] {
  const parts: { code: boolean; text: string }[] = []
  let i = 0
  while (i < formula.length) {
    const q = formula.indexOf('"', i)
    if (q < 0) { parts.push({ code: true, text: formula.slice(i) }); break }
    if (q > i) parts.push({ code: true, text: formula.slice(i, q) })
    let j = q + 1
    while (j < formula.length) {
      if (formula[j] === '"') { if (formula[j + 1] === '"') { j += 2; continue } break }
      j++
    }
    parts.push({ code: false, text: formula.slice(q, j + 1) })
    i = j + 1
  }
  return parts
}

// Référence de cellule, avec feuille facultative : Feuil1!$B$2, 'Ma feuille'!C10
const REF_RE = /((?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?)([A-Za-z]{1,3})(\$?)([0-9]+)(?![0-9A-Za-z_(!])/g

type RefMapper = (ref: { sheet: string | null; row: number; col: number; absRow: boolean; absCol: boolean }) =>
  { row: number; col: number } | null

function mapRefs(formula: string, mapper: RefMapper): string {
  return splitStrings(formula).map((part) => {
    if (!part.code) return part.text
    return part.text.replace(REF_RE, (match, sheet: string | undefined, absC: string, col: string, absR: string, row: string, offset: number, whole: string) => {
      // ignore les noms de fonctions / identifiants qui contiennent des chiffres (ex. LOG10, ATAN2)
      const before = whole[offset - 1]
      if (before && /[A-Za-z0-9_.]/.test(before)) return match
      const sheetName = sheet ? sheet.slice(0, -1).replace(/^'|'$/g, '').replace(/''/g, "'") : null
      const res = mapper({ sheet: sheetName, row: Number(row) - 1, col: colIndex(col), absRow: absR === '$', absCol: absC === '$' })
      if (!res || res.row < 0 || res.col < 0) return '#REF!'
      return `${sheet ?? ''}${absC}${colName(res.col)}${absR}${res.row + 1}`
    })
  }).join('')
}

/** Recopie : décale les références relatives (comme la poignée de recopie d'Excel). */
export function shiftFormula(formula: string, dRow: number, dCol: number): string {
  if (!formula.startsWith('=') || (!dRow && !dCol)) return formula
  return mapRefs(formula, (r) => ({ row: r.absRow ? r.row : r.row + dRow, col: r.absCol ? r.col : r.col + dCol }))
}

/**
 * Insertion (count > 0) ou suppression (count < 0) de lignes / colonnes dans `targetSheet` à partir de l'index `at`.
 * Met à jour les références des formules qui pointent vers cette feuille.
 */
export function adjustForInsert(
  formula: string, formulaSheet: string, targetSheet: string, axis: 'row' | 'col', at: number, count: number,
): string {
  if (!formula.startsWith('=')) return formula
  const same = (s: string | null) => (s ?? formulaSheet).toLowerCase() === targetSheet.toLowerCase()
  return mapRefs(formula, (r) => {
    if (!same(r.sheet)) return { row: r.row, col: r.col }
    const v = axis === 'row' ? r.row : r.col
    let nv = v
    if (count > 0 && v >= at) nv = v + count
    if (count < 0) {
      const removed = -count
      if (v >= at + removed) nv = v - removed
      else if (v >= at) return null // la cellule référencée a été supprimée
    }
    return axis === 'row' ? { row: nv, col: r.col } : { row: r.row, col: nv }
  })
}

/** Renommage d'une feuille : met à jour les références explicites Feuille!A1. */
export function renameSheetInFormula(formula: string, oldName: string, newName: string): string {
  if (!formula.startsWith('=')) return formula
  return splitStrings(formula).map((part) => {
    if (!part.code) return part.text
    return part.text.replace(/((?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)!)/g, (m) => {
      const name = m.slice(0, -1).replace(/^'|'$/g, '').replace(/''/g, "'")
      return name.toLowerCase() === oldName.toLowerCase() ? sheetPrefix(newName) : m
    })
  }).join('')
}

// ─── Saisie en français ─────────────────────────────────────────────────────

export const FR_TO_EN: Record<string, string> = {
  SOMME: 'SUM', 'SOMME.SI': 'SUMIF', 'SOMME.SI.ENS': 'SUMIFS', SOMMEPROD: 'SUMPRODUCT', PRODUIT: 'PRODUCT',
  MOYENNE: 'AVERAGE', 'MOYENNE.SI': 'AVERAGEIF', 'MOYENNE.SI.ENS': 'AVERAGEIFS', NB: 'COUNT', NBVAL: 'COUNTA',
  'NB.VIDE': 'COUNTBLANK', 'NB.SI': 'COUNTIF', 'NB.SI.ENS': 'COUNTIFS', 'MAX.SI.ENS': 'MAXIFS', 'MIN.SI.ENS': 'MINIFS',
  SI: 'IF', 'SI.CONDITIONS': 'IFS', SIERREUR: 'IFERROR', 'SI.NON.DISP': 'IFNA', ET: 'AND', OU: 'OR', NON: 'NOT', OUX: 'XOR',
  'SI.MULTIPLE': 'SWITCH', CHOISIR: 'CHOOSE',
  RECHERCHEV: 'VLOOKUP', RECHERCHEH: 'HLOOKUP', RECHERCHEX: 'XLOOKUP', RECHERCHE: 'LOOKUP', EQUIV: 'MATCH',
  DECALER: 'OFFSET', LIGNE: 'ROW', COLONNE: 'COLUMN', LIGNES: 'ROWS', COLONNES: 'COLUMNS', 'SOUS.TOTAL': 'SUBTOTAL',
  ARRONDI: 'ROUND', 'ARRONDI.SUP': 'ROUNDUP', 'ARRONDI.INF': 'ROUNDDOWN', 'ARRONDI.AU.MULTIPLE': 'MROUND', ENT: 'INT',
  TRONQUE: 'TRUNC', PUISSANCE: 'POWER', RACINE: 'SQRT', SIGNE: 'SIGN', PLAFOND: 'CEILING', PLANCHER: 'FLOOR',
  ALEA: 'RAND', 'ALEA.ENTRE.BORNES': 'RANDBETWEEN', QUOTIENT: 'QUOTIENT', PAIR: 'EVEN', IMPAIR: 'ODD',
  CONCATENER: 'CONCATENATE', 'JOINDRE.TEXTE': 'TEXTJOIN', GAUCHE: 'LEFT', DROITE: 'RIGHT', STXT: 'MID', NBCAR: 'LEN',
  MAJUSCULE: 'UPPER', MINUSCULE: 'LOWER', NOMPROPRE: 'PROPER', SUPPRESPACE: 'TRIM', SUBSTITUE: 'SUBSTITUTE',
  REMPLACER: 'REPLACE', CHERCHE: 'SEARCH', TROUVE: 'FIND', TEXTE: 'TEXT', CNUM: 'VALUE', REPT: 'REPT', EXACT: 'EXACT',
  AUJOURDHUI: 'TODAY', MAINTENANT: 'NOW', ANNEE: 'YEAR', MOIS: 'MONTH', JOUR: 'DAY', JOURSEM: 'WEEKDAY',
  'MOIS.DECALER': 'EDATE', 'FIN.MOIS': 'EOMONTH', 'NB.JOURS.OUVRES': 'NETWORKDAYS', 'SERIE.JOUR.OUVRE': 'WORKDAY',
  DATEVAL: 'DATEVALUE', 'NO.SEMAINE': 'WEEKNUM', JOURS: 'DAYS', HEURE: 'HOUR', MINUTE: 'MINUTE', SECONDE: 'SECOND',
  ECARTYPE: 'STDEV', 'ECARTYPE.STANDARD': 'STDEV.S', 'ECARTYPE.PEARSON': 'STDEV.P', 'VAR.S': 'VAR.S', MEDIANE: 'MEDIAN',
  RANG: 'RANK', 'GRANDE.VALEUR': 'LARGE', 'PETITE.VALEUR': 'SMALL', CENTILE: 'PERCENTILE', QUARTILE: 'QUARTILE',
  ESTVIDE: 'ISBLANK', ESTNUM: 'ISNUMBER', ESTTEXTE: 'ISTEXT', ESTERREUR: 'ISERROR', ESTERR: 'ISERR', ESTNA: 'ISNA',
  ESTLOGIQUE: 'ISLOGICAL', TRIER: 'SORT', FILTRE: 'FILTER', 'SOMME.CARRES': 'SUMSQ', 'MOYENNE.GEOMETRIQUE': 'GEOMEAN',
  VA: 'PV', VC: 'FV', VPM: 'PMT', TAUX: 'RATE', VAN: 'NPV', TRI: 'IRR',
}
export const EN_TO_FR: Record<string, string> = Object.fromEntries(Object.entries(FR_TO_EN).map(([fr, en]) => [en, fr]))

/**
 * Convertit une saisie utilisateur en formule stockée :
 * noms de fonctions français → anglais, « ; » → « , » et virgule décimale → point.
 */
export function normalizeFormulaInput(input: string): string {
  if (!input.startsWith('=')) return input
  const french = splitStrings(input).some((p) => p.code && p.text.includes(';'))
  return splitStrings(input).map((part) => {
    if (!part.code) return part.text
    let t = part.text.replace(/([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.]*)\s*\(/g, (m, name: string) => {
      const key = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
      const en = FR_TO_EN[key]
      return en ? `${en}(` : m
    })
    t = t.replace(/\bVRAI\b/gi, 'TRUE').replace(/\bFAUX\b/gi, 'FALSE')
    if (french) t = t.replace(/(\d),(\d)/g, '$1.$2').replace(/;/g, ',')
    return t
  }).join('')
}
