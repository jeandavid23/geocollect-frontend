import api from './client'

export interface LotLine { id?: number; producer: string; producer_name?: string; producer_code?: string; village?: string; weight_kg: number; bags: number; delivery_date?: string | null; receipt?: string }
export interface LotIssue { level: 'bloquant' | 'attention'; producer: string; message: string }
export interface LotChecks {
  blocking: number; warnings: number; issues: LotIssue[]; net_weight_kg: number; total_area_ha: number
  producers: { producer: string; name: string; code: string; weight_kg: number; parcels: number; area_ha: number; yield_kg_ha: number | null; status: 'ok' | 'attention' | 'bloquant' }[]
  parcels: { id: string; producer_id: string; field_id: string; village: string; area_hectares: number; eudr_status: string; eudr_score: number | null; geometry: GeoJSON.Geometry }[]
}
export interface Lot {
  id: string; cooperative: string; cooperative_name: string; code: string; campaign: string; product: 'cacao' | 'cafe' | 'autre'
  lot_date: string; bags: number; gross_weight_kg: number | null; net_weight_kg: number; quality: string; warehouse: string
  buyer: string; destination: string; transport: string; notes: string; status: 'brouillon' | 'valide' | 'expedie'
  created_by_name: string; created_at: string; updated_at: string; lines: LotLine[]; checks?: LotChecks
}
export type LotPayload = Partial<Omit<Lot, 'id' | 'code' | 'cooperative' | 'cooperative_name' | 'net_weight_kg' | 'checks' | 'created_at' | 'updated_at' | 'created_by_name'>>

export const lotsApi = {
  list: () => api.get<Lot[]>('/lots/'),
  get: (id: string) => api.get<Lot>(`/lots/${id}/`),
  create: (data: LotPayload) => api.post<Lot>('/lots/', data),
  update: (id: string, data: LotPayload) => api.patch<Lot>(`/lots/${id}/`, data),
  remove: (id: string) => api.delete(`/lots/${id}/`),
}

export const PRODUCT_LABEL = { cacao: 'Cacao (fèves)', cafe: 'Café (vert)', autre: 'Autre' } as const
export const STATUS_LABEL = { brouillon: 'Brouillon', valide: 'Validé', expedie: 'Expédié' } as const
