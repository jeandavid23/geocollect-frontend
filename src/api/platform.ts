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
  usage?: ModuleUsage
}

/** Traitements des N derniers jours, par module : nombre de lancements et de polygones traités. */
export type ModuleUsage = Partial<Record<ModuleId, { runs: number; items: number }>>

export interface PlatformAlert {
  level: 'error' | 'warning' | 'info'
  kind: 'suspended' | 'expired' | 'expiring' | 'quota' | 'unassigned'
  admin: string | null
  message: string
}

export interface PlatformOverview {
  totals: {
    super_admins: number; super_admins_active: number; cooperatives: number; cooperatives_unassigned: number
    agents: number; producers: number; parcels: number; hectares: number; users: number
  }
  clients: PlatformAdmin[]
  usage: ModuleUsage
  usage_owner: ModuleUsage
  usage_days: number
  alerts: PlatformAlert[]
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
  selfintersection: 'Self-intersection (nettoyage)',
  gmr: 'Polygon & GMR (registre × polygones)',
  lots: 'Fiches de lot',
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
  bulkModule: (module: ModuleId, grant: boolean) =>
    api.post<{ module: ModuleId; grant: boolean; changed: number }>('/platform/modules/bulk/', { module, grant }),
  assignCooperative: (coopId: string, managedBy: string | null) =>
    api.post<{ id: string; managed_by: string | null; managed_by_name: string | null }>(
      `/platform/cooperatives/${coopId}/assign/`, { managed_by: managedBy }),
}

// ─── Corbeille (30 jours) ───────────────────────────────────────────────────
export interface TrashItem {
  id: string; label: string; username: string; role: string; deleted_by: string | null
  deleted_at: string; expires_at: string; object_count: number; size_kb: number
  summary: Record<string, number | string | string[]> & { cooperative_names?: string[] }
}
export const trashApi = {
  list: () => api.get<TrashItem[]>('/platform/trash/'),
  restore: (id: string) => api.post<{ detail: string }>(`/platform/trash/${id}/restore/`, {}, { timeout: 300000 }),
  erase: (id: string) => api.delete(`/platform/trash/${id}/`),
}
