import * as XLSX from 'xlsx'
import type { CellValue } from '../api/registry'
import type { CreateProducerPayload } from '../api/producers'

// ─── Lecture du classeur ────────────────────────────────────────────────────

export interface WorkbookSheet {
  name: string
  // Cellules telles que dans Excel : formules conservées (« =SUM(B2:B9) »)
  data: CellValue[][]
  // Valeurs calculées par Excel (utilisées pour créer les producteurs)
  values: CellValue[][]
  colWidths: number[]
}

export interface ParsedWorkbook {
  fileName: string
  sheets: WorkbookSheet[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function cellValue(v: unknown): CellValue {
  if (v === undefined || v === null || v === '') return null
  if (v instanceof Date) return isoDate(v)
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v
  return String(v)
}

// Retire les lignes et colonnes vides en fin de feuille
function trim(rows: CellValue[][]): CellValue[][] {
  let lastRow = rows.length - 1
  while (lastRow >= 0 && rows[lastRow].every((c) => c === null || c === '')) lastRow--
  const kept = rows.slice(0, lastRow + 1)
  let lastCol = 0
  for (const r of kept) for (let c = r.length - 1; c >= lastCol; c--) if (r[c] !== null && r[c] !== '') { lastCol = c + 1; break }
  return kept.map((r) => r.slice(0, lastCol))
}

/** Lit toutes les feuilles d'un classeur .xlsx / .xls / .csv / .ods. */
export async function readWorkbook(file: File): Promise<ParsedWorkbook> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellDates: true })
  const sheets: WorkbookSheet[] = []
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    if (!ws?.['!ref']) { sheets.push({ name, data: [], values: [], colWidths: [] }); continue }
    const range = XLSX.utils.decode_range(ws['!ref'])
    const data: CellValue[][] = []
    const values: CellValue[][] = []
    // on part de A1 pour garder les références des formules intactes
    for (let r = 0; r <= range.e.r; r++) {
      const dRow: CellValue[] = []
      const vRow: CellValue[] = []
      for (let c = 0; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
        const v = cellValue(cell?.v)
        vRow.push(v)
        dRow.push(cell?.f ? `=${cell.f}` : v)
      }
      data.push(dRow)
      values.push(vRow)
    }
    const trimmed = trim(data)
    const colWidths = (ws['!cols'] ?? []).slice(0, trimmed[0]?.length ?? 0)
      .map((col) => Math.round(col?.wpx ?? (col?.wch ? col.wch * 7 + 10 : 110)))
    sheets.push({ name, data: trimmed, values: values.slice(0, trimmed.length), colWidths })
  }
  return { fileName: file.name, sheets }
}

// ─── Correspondance entêtes → champs du producteur ─────────────────────────

export type FieldKind = 'text' | 'int' | 'decimal' | 'gender' | 'farmType' | 'fullName'

export interface ProducerField {
  key: string
  label: string
  api?: keyof CreateProducerPayload // absent pour « Nom et prénoms » (découpé en nom + prénom)
  kind: FieldKind
  aliases: string[]
}

export const PRODUCER_FIELDS: ProducerField[] = [
  { key: 'lastName', label: 'Nom', api: 'last_name', kind: 'text',
    aliases: ['nom', 'nom producteur', 'nom du producteur', 'nom planteur', 'last name', 'lastname', 'surname', 'nom de famille'] },
  { key: 'firstName', label: 'Prénom(s)', api: 'first_name', kind: 'text',
    aliases: ['prenom', 'prenoms', 'prenom producteur', 'first name', 'firstname', 'prenom du producteur'] },
  { key: 'fullName', label: 'Nom et prénoms (une seule colonne)', kind: 'fullName',
    aliases: ['nom et prenoms', 'nom et prenom', 'nom prenoms', 'nom prenom', 'nom complet', 'noms et prenoms',
      'producteur', 'planteur', 'nom du planteur', 'full name', 'nom & prenoms', 'nom & prenom'] },
  { key: 'phone', label: 'Téléphone', api: 'phone', kind: 'text',
    aliases: ['telephone', 'tel', 'phone', 'contact', 'numero de telephone', 'n telephone', 'cellulaire', 'mobile'] },
  { key: 'gender', label: 'Genre', api: 'gender', kind: 'gender', aliases: ['genre', 'sexe', 'gender', 'sex'] },
  { key: 'birthYear', label: 'Année de naissance', api: 'birth_year', kind: 'int',
    aliases: ['annee de naissance', 'annee naissance', 'naissance', 'birth year', 'birthyear', 'ne en', 'date de naissance', 'annee'] },
  { key: 'nationalId', label: "N° pièce d'identité (CNI)", api: 'national_id', kind: 'text',
    aliases: ['cni', 'n cni', 'numero cni', 'piece identite', 'piece d identite', 'n piece', 'national id', 'identite', 'nationalid'] },
  { key: 'village', label: 'Village', api: 'village', kind: 'text', aliases: ['village', 'localite', 'ville', 'campement'] },
  { key: 'section', label: 'Section', api: 'section', kind: 'text', aliases: ['section', 'sous section', 'groupement', 'zone'] },
  { key: 'district', label: 'District / Département', api: 'district', kind: 'text',
    aliases: ['district', 'departement', 'sous prefecture', 'province', 'etat'] },
  { key: 'region', label: 'Région', api: 'region', kind: 'text', aliases: ['region'] },
  { key: 'nationalFarmId', label: "Code / ID d'exploitation", api: 'national_farm_id', kind: 'text',
    aliases: ['code planteur', 'code producteur', 'code', 'id producteur', 'matricule', 'code exploitation', 'national farm id', 'id exploitation', 'numero producteur'] },
  { key: 'totalAreaHa', label: 'Superficie totale (ha)', api: 'total_area_ha', kind: 'decimal',
    aliases: ['superficie', 'superficie ha', 'superficie totale', 'surface', 'surface ha', 'hectares', 'ha', 'superficie declaree', 'area'] },
  { key: 'farmType', label: "Type d'exploitation", api: 'farm_type', kind: 'farmType', aliases: ['type exploitation', 'type d exploitation', 'farm type'] },
  { key: 'numUnits', label: "Nombre d'unités / parcelles", api: 'num_units', kind: 'int',
    aliases: ['nombre de parcelles', 'nb parcelles', 'nombre parcelles', 'nombre d unites', 'unites agricoles'] },
  { key: 'certificationYear', label: 'Année de certification', api: 'certification_year', kind: 'int',
    aliases: ['annee de certification', 'annee certification', 'certification'] },
  { key: 'ownerLastName', label: 'Nom du propriétaire', api: 'owner_last_name', kind: 'text', aliases: ['nom proprietaire', 'nom du proprietaire'] },
  { key: 'ownerFirstName', label: 'Prénom du propriétaire', api: 'owner_first_name', kind: 'text', aliases: ['prenom proprietaire', 'prenom du proprietaire'] },
  { key: 'ownerPhone', label: 'Téléphone du propriétaire', api: 'owner_phone', kind: 'text', aliases: ['telephone proprietaire', 'contact proprietaire'] },
  { key: 'ownerNationalId', label: 'CNI du propriétaire', api: 'owner_national_id', kind: 'text', aliases: ['cni proprietaire'] },
  { key: 'permanentWorkers', label: 'Travailleurs permanents', api: 'permanent_workers', kind: 'int',
    aliases: ['travailleurs permanents', 'employes permanents', 'main d oeuvre permanente'] },
  { key: 'temporaryWorkers', label: 'Travailleurs temporaires', api: 'temporary_workers', kind: 'int',
    aliases: ['travailleurs temporaires', 'employes temporaires', 'main d oeuvre temporaire'] },
  { key: 'inspectorName', label: "Inspecteur interne", api: 'inspector_name', kind: 'text', aliases: ['inspecteur', 'nom inspecteur', 'inspecteur interne'] },
]

/** Minuscules, sans accents ni ponctuation : « N° Pièce d'identité » → « n piece d identite ». */
export function normalizeHeader(h: string): string {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[°º]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Champ correspondant le plus probable à une entête ('' = donnée conservée seulement). */
export function guessField(header: string, taken: Set<string>): string {
  const n = normalizeHeader(header)
  if (!n) return ''
  for (const f of PRODUCER_FIELDS) if (!taken.has(f.key) && f.aliases.includes(n)) return f.key
  // correspondance partielle : l'entête commence par un alias de plusieurs mots
  for (const f of PRODUCER_FIELDS) {
    if (taken.has(f.key)) continue
    if (f.aliases.some((a) => a.includes(' ') && n.startsWith(a))) return f.key
  }
  return ''
}

/** Ligne d'entêtes probable : parmi les 15 premières, celle qui a le plus de textes. */
export function detectHeaderRow(values: CellValue[][]): number {
  let best = 0, bestScore = -1
  values.slice(0, 15).forEach((row, i) => {
    const score = row.filter((c) => typeof c === 'string' && c.trim() !== '' && isNaN(Number(c))).length
    if (score > bestScore) { best = i; bestScore = score }
  })
  return best
}

/** Entêtes uniques et non vides (doublons suffixés, colonnes sans titre nommées). */
export function headersOf(values: CellValue[][], headerRow: number): string[] {
  const row = values[headerRow] ?? []
  const width = Math.max(row.length, ...values.slice(headerRow + 1, headerRow + 50).map((r) => r.length))
  const seen = new Map<string, number>()
  return Array.from({ length: width }, (_, c) => {
    let h = String(row[c] ?? '').replace(/\s+/g, ' ').trim() || `Colonne ${XLSX.utils.encode_col(c)}`
    const count = (seen.get(h) ?? 0) + 1
    seen.set(h, count)
    if (count > 1) h = `${h} (${count})`
    return h
  })
}

export function autoMapping(headers: string[]): string[] {
  const taken = new Set<string>()
  return headers.map((h) => {
    const f = guessField(h, taken)
    if (f) taken.add(f)
    return f
  })
}

// ─── Construction des producteurs ───────────────────────────────────────────

export interface ProducerImportRow {
  excelRow: number // numéro de ligne dans Excel (1 = première ligne)
  cells: CellValue[] // valeurs de la ligne, dans l'ordre des entêtes du fichier
  payload: CreateProducerPayload
  errors: string[]
}

function toInt(v: CellValue): number | undefined {
  if (v === null || v === '') return undefined
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return Number(v.slice(0, 4)) // date → année
  const n = parseInt(String(v).replace(/\s/g, ''), 10)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function toDecimal(v: CellValue): number | undefined {
  if (v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined
}

const text = (v: CellValue) => (v === null ? '' : String(v).trim())

/** Transforme les lignes du tableau en producteurs, avec toutes les colonnes dans extra_data. */
export function buildProducerRows(
  values: CellValue[][],
  headerRow: number,
  mapping: string[],
  defaults: { section: string; region: string },
): ProducerImportRow[] {
  const headers = headersOf(values, headerRow)
  const fields = new Map(PRODUCER_FIELDS.map((f) => [f.key, f]))
  const out: ProducerImportRow[] = []

  values.slice(headerRow + 1).forEach((row, i) => {
    if (row.every((c) => c === null || text(c) === '')) return // ligne vide
    const p: Record<string, unknown> = {}
    const extra: Record<string, unknown> = {}
    headers.forEach((h, c) => {
      const v = row[c] ?? null
      if (v !== null && text(v) !== '') extra[h] = v
      const field = fields.get(mapping[c])
      if (!field || v === null || text(v) === '') return
      switch (field.kind) {
        case 'fullName': {
          const parts = text(v).split(/\s+/)
          p.last_name = parts[0]
          p.first_name = parts.slice(1).join(' ')
          break
        }
        case 'gender': {
          const g = normalizeHeader(text(v))
          p.gender = g.startsWith('f') || g === 'femme' || g === 'feminin' ? 'F' : 'M'
          break
        }
        case 'farmType':
          p.farm_type = /grand|large/i.test(text(v)) ? 'large' : 'small'
          break
        case 'int': { const n = toInt(v); if (n !== undefined) p[field.api!] = n; break }
        case 'decimal': { const n = toDecimal(v); if (n !== undefined) p[field.api!] = n; break }
        default:
          p[field.api!] = text(v)
      }
    })

    if (p.last_name) p.last_name = String(p.last_name).toUpperCase()
    if (!p.section && defaults.section.trim()) p.section = defaults.section.trim()
    if (p.section) p.section = String(p.section).toUpperCase()
    if (!p.region && defaults.region.trim()) p.region = defaults.region.trim()
    if (!p.gender) p.gender = 'M'

    // Aucune colonne obligatoire : la ligne est enregistrée avec les entêtes du fichier
    const errors: string[] = []

    out.push({
      excelRow: headerRow + i + 2,
      cells: headers.map((_, c) => row[c] ?? null),
      payload: { ...(p as unknown as CreateProducerPayload), extra_data: extra },
      errors,
    })
  })
  return out
}

// ─── Modèle téléchargeable ──────────────────────────────────────────────────

export function buildProducerTemplate(): Blob {
  const example = [
    {
      'Code planteur': 'CP-0001', Nom: 'KONAN', 'Prénoms': 'Jean', 'Téléphone': '+225 07 11 22 33',
      Genre: 'Homme', 'Année de naissance': 1975, Village: 'Akakro', Section: 'BEOUMI', 'Région': 'Bélier',
      CNI: 'CI001234567', 'Superficie (ha)': 2.5, 'Nombre de parcelles': 1,
    },
    {
      'Code planteur': 'CP-0002', Nom: 'KOUASSI', 'Prénoms': 'Marie', 'Téléphone': '+225 07 22 33 44',
      Genre: 'Femme', 'Année de naissance': 1982, Village: 'Kpouebo', Section: 'BEOUMI', 'Région': 'Bélier',
      CNI: '', 'Superficie (ha)': 1.75, 'Nombre de parcelles': 2,
    },
  ]
  const ws = XLSX.utils.json_to_sheet(example)
  ws['!cols'] = Object.keys(example[0]).map((k) => ({ wch: Math.max(10, k.length + 2) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Producteurs')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
