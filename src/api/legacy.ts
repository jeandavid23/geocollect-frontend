import api, { fetchAll } from './client'

export interface LegacyFeaturePayload {
  name: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  properties: Record<string, unknown>
  area_hectares: number | null
}

export interface LegacySource {
  cooperative: string
  source_file: string
  count: number
  area_hectares: number
}

// Anciens polygones de la coopérative (KML, GeoPackage, Shapefile, GeoJSON)
export const legacyApi = {
  // Toutes les pages (plus de 10 000 polygones possibles)
  list: (cooperative?: string) =>
    fetchAll('/parcels/legacy/', { page_size: '2000', ...(cooperative ? { cooperative } : {}) }),
  sources: () => api.get<LegacySource[]>('/parcels/legacy/sources/'),
  // codeField : attribut qui porte le code producteur / code parcelle (rattachement au producteur du registre)
  import: (sourceFile: string, features: LegacyFeaturePayload[], replace = true, cooperative?: string, notify = true, codeField?: string) =>
    api.post<{ created: number; skipped: number; linked?: number }>('/parcels/legacy/import/', {
      source_file: sourceFile, features, replace, cooperative, notify, code_field: codeField || undefined,
    }),
  removeSource: (sourceFile: string, cooperative?: string) =>
    api.delete('/parcels/legacy/', { params: { source_file: sourceFile, cooperative } }),
}
