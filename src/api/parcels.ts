import api from './client'
import type { Parcel } from '../types'

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const parcelsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Parcel>>('/parcels/', { params }),

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
