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

// ─── Analyse d'activité (tableaux de bord) ──────────────────────────────────
// Parcelles : cartographiées ET anciens polygones importés, toutes comptées comme parcelles de la coopérative.
export type RiskLevel = 'faible' | 'a_verifier' | 'eleve'
export interface Analytics {
  campaign: string; cooperatives: number
  parcels: { total: number; mapped: number; legacy: number; hectares: number; mapped_ha: number; legacy_ha: number; avg_ha: number
    eudr: { compliant: number; non_compliant: number; pending: number } }
  producers: { total: number; with_parcels: number; to_map: number; coverage_pct: number; villages: number }
  risk: { analysed: number; counts: Record<RiskLevel, number>; area_ha: Record<RiskLevel, number>; last_analysis: string | null }
  volumes: { campaign: string; net_kg: number; deliveries: number; producers_delivering: number; amount_fcfa: number
    avg_price: number | null; kg_per_producer: number; yield_kg_ha: number | null; previous_campaign: string
    previous_net_kg: number; growth_pct: number | null
    estimated_kg: number | null; producers_with_estimate: number; estimated_yield_kg_ha: number | null; realisation_pct: number | null }
  monthly: { month: string; net_kg: number; amount_fcfa: number; deliveries: number }[]
  pipeline: { weighed_kg: number; in_lots_kg: number; shipped_kg: number; received_kg: number; processed_kg: number }
  lots: Record<'brouillon' | 'valide' | 'expedie', number>
  top_producers: { code: string; name: string; village: string; deliveries: number; net_kg: number; amount_fcfa: number }[]
  activity: { week: string; mapped: number; legacy: number }[]
  top_agents: { name: string; parcels: number; hectares: number }[]
  per_cooperative?: { id: string; name: string; parcels: number; hectares: number; producers: number; net_kg: number
    amount_fcfa: number; high_risk: number }[]
}
export const analyticsApi = {
  get: (campaign: string, cooperative?: string) =>
    api.get<Analytics>('/dashboard/analytics/', { params: { campaign, ...(cooperative ? { cooperative } : {}) }, timeout: 120000 }),
}
