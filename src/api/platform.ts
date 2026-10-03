import api from './client'
import type { LicenseSummary, ModuleId } from '../types'

// Espace du propriétaire de la plateforme (Super Super Admin)

export interface PlatformAdmin {
  id: string
  username: string
  full_name: string
  email: string
  phone: string
  is_active: boolean
  created_at: string
  last_login: string | null
  license: LicenseSummary
  notes: string
  parcels?: number
  hectares?: number
  cooperatives?: { id: string; name: string; region: string; is_active: boolean; n_agents: number }[]
}

export interface PlatformOverview {
  totals: {
    super_admins: number; super_admins_active: number; cooperatives: number; cooperatives_unassigned: number
    agents: number; producers: number; parcels: number; hectares: number; users: number
  }
  clients: PlatformAdmin[]
  modules: { id: ModuleId; label: string }[]
}

export interface LicensePayload {
  organization?: string
  max_cooperatives?: number | null
  max_agents_per_coop?: number | null
  modules?: ModuleId[]
  expires_at?: string | null
  notes?: string
}

export interface AdminCreatePayload extends LicensePayload {
  full_name: string
  email?: string
  phone?: string
  username?: string
  password?: string
}

export const MODULE_LABELS: Record<ModuleId, string> = {
  deforestation: 'Analyse déforestation',
  rdue: 'Matrice RDUE (forêts classées, enclaves)',
  validator: 'Polygon Validator',
  registry: 'Registre (tableur)',
  legacy: 'Anciens polygones',
}
export const ALL_MODULES = Object.keys(MODULE_LABELS) as ModuleId[]

export const platformApi = {
  overview: () => api.get<PlatformOverview>('/platform/overview/'),
  admins: () => api.get<PlatformAdmin[]>('/platform/admins/'),
  admin: (id: string) => api.get<PlatformAdmin>(`/platform/admins/${id}/`),
  createAdmin: (data: AdminCreatePayload) =>
    api.post<PlatformAdmin & { account_username: string; account_password: string }>('/platform/admins/', data),
  updateAdmin: (id: string, data: LicensePayload & { full_name?: string; email?: string; phone?: string; is_active?: boolean }) =>
    api.patch<PlatformAdmin>(`/platform/admins/${id}/`, data),
  deleteAdmin: (id: string) => api.delete(`/platform/admins/${id}/`),
  resetPassword: (id: string) =>
    api.post<{ username: string; new_password: string; full_name: string }>(`/auth/users/${id}/reset-password/`),
  assignCooperative: (coopId: string, managedBy: string | null) =>
    api.post<{ id: string; managed_by: string | null; managed_by_name: string | null }>(
      `/platform/cooperatives/${coopId}/assign/`, { managed_by: managedBy }),
}
