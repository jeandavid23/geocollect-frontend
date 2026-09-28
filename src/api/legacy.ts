import api from './client'

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
  list: (cooperative?: string) =>
    api.get('/parcels/legacy/', { params: cooperative ? { cooperative } : undefined }),
  sources: () => api.get<LegacySource[]>('/parcels/legacy/sources/'),
  import: (sourceFile: string, features: LegacyFeaturePayload[], replace = true, cooperative?: string) =>
    api.post<{ created: number; skipped: number }>('/parcels/legacy/import/', {
      source_file: sourceFile, features, replace, cooperative,
    }),
  removeSource: (sourceFile: string, cooperative?: string) =>
    api.delete('/parcels/legacy/', { params: { source_file: sourceFile, cooperative } }),
}
