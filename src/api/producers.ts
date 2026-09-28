import api, { fetchAll } from './client'

export interface CreateProducerPayload {
  first_name: string
  last_name: string
  phone?: string
  national_id?: string
  gender: 'M' | 'F'
  birth_year?: number
  village?: string
  section: string
  region?: string
  country?: string
  cooperative?: string
  assigned_agent?: string
  // Champs GMR facultatifs
  national_farm_id?: string
  district?: string
  total_area_ha?: number
  farm_type?: 'small' | 'large'
  num_units?: number
  certification_year?: number
  owner_first_name?: string
  owner_last_name?: string
  owner_phone?: string
  owner_national_id?: string
  owner_gender?: 'M' | 'F' | ''
  permanent_workers?: number
  temporary_workers?: number
  inspector_name?: string
  // Toutes les colonnes du fichier Excel d'origine, sous leur entête
  extra_data?: Record<string, unknown>
}

export interface BulkImportResult {
  created: Record<string, unknown>[]
  errors: { index: number; errors: Record<string, unknown> }[]
}

export const producersApi = {
  list: () => fetchAll('/producers/'),
  create: (data: CreateProducerPayload) => api.post('/producers/', data),
  bulk: (producers: CreateProducerPayload[], cooperative?: string) =>
    api.post<BulkImportResult>('/producers/bulk/', { producers, cooperative }, {
      // un statut 400 renvoie quand même le détail des lignes rejetées
      validateStatus: (s) => s === 201 || s === 400,
    }),
}
