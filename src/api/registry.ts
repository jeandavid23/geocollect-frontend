import api from './client'

export type CellValue = string | number | boolean | null

export interface TableDef { name: string; r1: number; c1: number; r2: number; c2: number; style?: string }

export interface RegistrySheetDTO {
  id: string
  cooperative: string
  name: string
  position: number
  data: CellValue[][]
  col_widths: number[]
  formats?: Record<string, unknown>
  tables?: TableDef[]
  source_file: string
  updated_by_name: string
  created_at: string
  updated_at: string
}

export interface SheetPayload {
  name: string
  data: CellValue[][]
  col_widths?: number[]
  formats?: Record<string, unknown>
  tables?: TableDef[]
  position?: number
}

// Registre des producteurs : un classeur (plusieurs feuilles) par coopérative
export const registryApi = {
  list: (cooperative?: string) =>
    api.get<RegistrySheetDTO[]>('/registry/sheets/', { params: cooperative ? { cooperative } : undefined }),
  create: (sheet: SheetPayload, cooperative?: string) =>
    api.post<RegistrySheetDTO>('/registry/sheets/', { ...sheet, cooperative }),
  update: (id: string, sheet: Partial<SheetPayload>) =>
    api.patch<RegistrySheetDTO>(`/registry/sheets/${id}/`, sheet),
  remove: (id: string) => api.delete(`/registry/sheets/${id}/`),
  importWorkbook: (sheets: SheetPayload[], sourceFile: string, mode: 'replace' | 'merge', cooperative?: string) =>
    api.post<RegistrySheetDTO[]>('/registry/import/', { sheets, source_file: sourceFile, mode, cooperative }),
}
