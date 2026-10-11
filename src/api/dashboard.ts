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
