import api, { fetchAll } from './client'
import type { Parcel } from '../types'

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const parcelsApi = {
  bulkDelete: (ids: string[]) => api.post<{ deleted: number }>('/parcels/bulk-delete/', { ids }, { timeout: 120000 }),
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Parcel>>('/parcels/', { params }),

  // Toutes les parcelles visibles (toutes les pages)
  listAll: () => fetchAll('/parcels/'),

  create: (data: Partial<Parcel>) =>
    api.post<Parcel>('/parcels/', data),

  detail: (id: string) =>
    api.get<Parcel>(`/parcels/${id}/`),

  update: (id: string, data: Partial<Parcel>) =>
    api.patch<Parcel>(`/parcels/${id}/`, data),

  validate: (id: string) =>
    api.post(`/parcels/${id}/validate/`),

  geojson: () =>
    api.get('/parcels/geojson/'),

  exportCSV: () =>
    api.get('/parcels/export/csv/', { responseType: 'blob' }),

  syncOffline: (parcels: Partial<Parcel>[]) =>
    api.post('/parcels/sync/', { parcels }),
}

// ─── Contrôle spatial (PostGIS en production) ───────────────────────────────
export interface SpatialSide {
  kind: 'parcel' | 'legacy'; id: string | null; label: string; area_ha: number
  producer: { id?: string | null; code: string; name: string } | null
}
export interface OverlapRow {
  type: 'meme_producteur' | 'autres_producteurs' | 'autre_cooperative'
  doublon: boolean; area_ha: number; pct_a: number; pct_b: number
  a: SpatialSide; b: SpatialSide; other_cooperative: string | null; geometry: GeoJSON.Geometry | null
}
export interface OverlapResponse {
  cooperative: string; min_ha: number; results: OverlapRow[]
  summary: { engine: 'postgis' | 'shapely'; total: number; meme_producteur: number; autres_producteurs: number; autre_cooperative: number; doublons: number; area_ha: number; truncated: boolean }
}
export interface ZoneRow {
  kind: 'parcel' | 'legacy'; id: string; label: string; area_ha: number | null
  category: string; zone: string; pct: number; legalite: string; note?: string
  producer: { code: string; name: string } | null
  zones: { category: string; name: string; pct: number; area_ha: number | null }[]
}
export interface ZoneResponse {
  cooperative: string; results: ZoneRow[]
  summary: { engine: 'postgis' | 'shapely'; zones_loaded: number; parcels_in_zones: number; illegal: number; by_category: Record<string, number> }
}
export const spatialApi = {
  overlaps: (params: { cooperative?: string; other?: boolean; min_ha?: number }) =>
    api.get<OverlapResponse>('/parcels/spatial/overlaps/', { params, timeout: 180000 }),
  zones: (cooperative?: string) => api.get<ZoneResponse>('/parcels/spatial/zones/', { params: cooperative ? { cooperative } : undefined, timeout: 180000 }),
}
