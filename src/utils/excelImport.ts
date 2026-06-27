import * as XLSX from 'xlsx'

// One parsed row from the imported Excel file
export interface ImportedProducerRow {
  firstName: string
  lastName: string
  phone: string
  gender: 'M' | 'F'
  birthYear?: number
  village: string
  section: string
  region: string
  nationalId?: string
  _errors: string[]
}

// Accepts many possible column header spellings (FR/EN, accents, case)
const COLUMN_MAP: Record<string, keyof ImportedProducerRow> = {
  nom: 'lastName', lastname: 'lastName', 'last name': 'lastName',
  prenom: 'firstName', 'prénom': 'firstName', firstname: 'firstName', 'first name': 'firstName',
  telephone: 'phone', 'téléphone': 'phone', tel: 'phone', phone: 'phone',
  genre: 'gender', sexe: 'gender', gender: 'gender',
  'annee naissance': 'birthYear', 'année naissance': 'birthYear', naissance: 'birthYear',
  birthyear: 'birthYear', 'annee de naissance': 'birthYear', 'année de naissance': 'birthYear',
  village: 'village',
  section: 'section',
  region: 'region', 'région': 'region',
  cni: 'nationalId', 'piece identite': 'nationalId', 'pièce identité': 'nationalId',
  nationalid: 'nationalId', identite: 'nationalId',
}

function normalizeKey(k: string): string {
  return k.trim().toLowerCase()
}

function mapGender(v: unknown): 'M' | 'F' {
  const s = String(v ?? '').trim().toLowerCase()
  if (s.startsWith('f')) return 'F'
  return 'M'
}

// Parse an uploaded .xlsx / .xls / .csv file → producer rows
export async function parseProducersFile(file: File): Promise<ImportedProducerRow[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return raw.map((row) => {
    const out: ImportedProducerRow = {
      firstName: '', lastName: '', phone: '', gender: 'M',
      village: '', section: '', region: 'Bélier', _errors: [],
    }

    for (const [rawKey, value] of Object.entries(row)) {
      const field = COLUMN_MAP[normalizeKey(rawKey)]
      if (!field) continue
      if (field === 'gender') {
        out.gender = mapGender(value)
      } else if (field === 'birthYear') {
        const n = parseInt(String(value), 10)
        if (!Number.isNaN(n)) out.birthYear = n
      } else {
        ;(out[field] as string) = String(value ?? '').trim()
      }
    }

    // Validation
    if (!out.lastName) out._errors.push('Nom manquant')
    if (!out.firstName) out._errors.push('Prénom manquant')
    if (!out.section) out._errors.push('Section manquante')

    return out
  })
}

// Generate a downloadable template (.xlsx) with the expected columns
export function buildProducerTemplate(): Blob {
  const example = [
    {
      Nom: 'KONAN', 'Prénom': 'Jean', 'Téléphone': '+225 07 11 22 33',
      Genre: 'Homme', 'Année naissance': 1975, Village: 'Akakro',
      Section: 'BEOUMI', 'Région': 'Bélier', CNI: 'CI001234567',
    },
    {
      Nom: 'KOUASSI', 'Prénom': 'Marie', 'Téléphone': '+225 07 22 33 44',
      Genre: 'Femme', 'Année naissance': 1982, Village: 'Kpouebo',
      Section: 'BEOUMI', 'Région': 'Bélier', CNI: '',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(example)
  ws['!cols'] = [
    { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 8 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Producteurs')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
