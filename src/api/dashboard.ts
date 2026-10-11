import api from './client'

export const dashboardApi = {
  admin: () => api.get('/dashboard/admin/'),
  coop: () => api.get('/dashboard/coop/'),
  agent: () => api.get('/dashboard/agent/'),
}

// ─── « Prochaines actions » de la coopérative ───────────────────────────────
export interface CoopStep { key: string; label: string; done: boolean; detail: string; to: string; progress?: number }
export interface CoopAction {
  level: 'urgent' | 'todo' | 'info'; key: string; count: number; title: string; detail: string
  to: string; cta: string; module?: string | null
}
export interface CoopActionsResponse {
  cooperative: string; steps: CoopStep[]; actions: CoopAction[]; spatial_at: string
  counts: { producers: number; to_map: number; parcels: number; legacy_polygons: number; agents: number }
}
export const coopActionsApi = {
  get: (refresh = false) => api.get<CoopActionsResponse>('/dashboard/coop/actions/', { params: refresh ? { refresh: 1 } : undefined, timeout: 120000 }),
}

// ─── Comparatif des coopératives (super admin / propriétaire) ──────────────
export interface CoopCompareRow {
  id: string; name: string; is_active: boolean; managed_by: string | null
  producers: number; mapped: number; to_map: number; mapped_pct: number
  parcels: number; non_compliant: number; legacy_polygons: number; agents: number; lots_ready: number
  overlaps: number | null; illegal: number | null; last_activity: string | null; coop_account_id: string | null
}
export const compareApi = {
  get: () => api.get<{ cooperatives: CoopCompareRow[] }>('/dashboard/admin/compare/', { timeout: 120000 }),
}
