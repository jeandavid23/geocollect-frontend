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
  code?: string            // code du producteur TEL QUE DANS LE REGISTRE (devient son identifiant)
  parcel_code?: string     // code parcelle (registre : une ligne par parcelle, le code producteur se répète)
  district?: string
  total_area_ha?: number
  estimated_production_kg?: number | string | null   // « Total estimate production (current year) » du registre
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

export interface MatchStats {
  code_field: string | null; producers: number; mapped_producers: number; to_map: number
  polygons_per_producer: { '1': number; '2': number; '3+': number }
  legacy_polygons: number; linked_polygons: number; orphan_polygons: number; polygons_without_code: number
  fields?: string[]; suggested_field?: string | null; suggested_matches?: number
  unmatched_codes?: string[]; ambiguous_codes?: string[]
  registry_parcels?: number; registry_parcels_with_polygon?: number; registry_parcels_without_polygon?: number
}

export interface ProducerParcels {
  registry_parcels: { id: string; parcel_code: string; area_ha: number | null; estimated_production_kg: number | null
    polygons: number; polygon_area_ha: number }[]
  unassigned_polygons: { id: string; code: string; parcel_code: string; area_ha: number | null; source_file: string }[]
  mapped_parcels: { field_id: string; area_ha: number | null; eudr_status: string }[]
}
export interface RegistryExport {
  cooperative: string
  rows: Record<string, string | number | null>[]
  unlinked_polygons: Record<string, string | number | null>[]
}

export interface BulkImportResult {
  created: Record<string, unknown>[]
  updated?: number
  errors: { index: number | null; errors: Record<string, unknown> }[]
  match?: MatchStats | null
}

export const producersApi = {
  update: (id: string, data: Record<string, unknown>) => api.patch<Record<string, unknown>>(`/producers/${id}/`, data),
  remove: (id: string) => api.delete(`/producers/${id}/`),
  bulkDelete: (ids: string[]) => api.post<{ deleted: number; protected: number; protected_codes: string[] }>('/producers/bulk-delete/', { ids }, { timeout: 120000 }),
  // parcelles du registre d'un producteur et polygones rattachés
  parcels: (id: string) => api.get<ProducerParcels>(`/producers/${id}/parcels/`),
  // registre normalisé de la coopérative (une ligne par parcelle)
  registryExport: (cooperative?: string) =>
    api.get<RegistryExport>('/producers/registry-export/', { params: cooperative ? { cooperative } : undefined, timeout: 180000 }),
  match: (codeField?: string | null, cooperative?: string, parcelField?: string | null) =>
    api.post<MatchStats>('/producers/match/', { code_field: codeField ?? null, parcel_field: parcelField ?? null, cooperative }, { timeout: 180000 }),
  recodeInfo: (cooperative?: string) => api.get<{ columns: { name: string; filled: number }[]; suggested: string | null; preview: RecodeReport | null }>('/producers/recode/', { params: cooperative ? { cooperative } : undefined }),
  recode: (column: string, apply: boolean, cooperative?: string) => api.post<RecodeReport & { applied: boolean; match?: MatchStats }>('/producers/recode/', { column, apply, cooperative }, { timeout: 180000 }),
  purgeInfo: (cooperative?: string) => api.get<{ cooperative: string; producers: number; protected: number; registry_sheets: number }>('/producers/purge/', { params: cooperative ? { cooperative } : undefined }),
  purge: (body: { registry: boolean; producers: boolean; confirm: string }, cooperative?: string) =>
    api.post<{ registry_sheets: number; deleted: number; protected: number; protected_codes: string[] }>('/producers/purge/', { ...body, cooperative }, { timeout: 180000 }),
  matchStatus: (cooperative?: string) => api.get<MatchStats>('/producers/match/', { params: cooperative ? { cooperative } : undefined }),
  list: () => fetchAll('/producers/'),
  create: (data: CreateProducerPayload) => api.post('/producers/', data),
  // use_codes : le fichier a une colonne « code producteur » (aucun code généré) ; relink : croisement avec les polygones
  bulk: (producers: CreateProducerPayload[], cooperative?: string, opts: { use_codes?: boolean; relink?: boolean } = {}) =>
    api.post<BulkImportResult>('/producers/bulk/', { producers, cooperative, ...opts }, {
      // un statut 400 renvoie quand même le détail des lignes rejetées
      validateStatus: (s) => s === 201 || (s === 400),
      timeout: 120000,
    }),
}

export interface RecodeReport {
  producers: number; recoded: number; unchanged: number; without_code: number
  duplicates: number; duplicate_codes: string[]; conflicts: number; sample: { avant: string; apres: string }[]
}
