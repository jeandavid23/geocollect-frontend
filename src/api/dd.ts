import api from './client'
import { RISK_MAP, RISK_ON, RISK_TEXT, RISK_UI } from '../theme/tokens'

/** Diligence raisonnée EUDR (moteur commun eudr_evidence : convergence de preuves + WHISP facultatif). */
export type Risk = 'faible' | 'a_verifier' | 'eleve'
export type Forest2020 = 'oui' | 'incertain' | 'non'

export interface SourceForest { pct: number; ha: number }
export interface SourceLoss { ha: number; pct: number; first_year: number | null; last_year: number | null; outside_forest_ha: number }
export interface DDEvidence {
  area_ha: number; pixels: number
  forest2020: Record<string, SourceForest>; forest2020_union_pct: number
  loss_post2020: Record<string, SourceLoss>; loss_post2020_ha: number; loss_post2020_pct: number
  predisturbance_pct: Record<string, number>; commodity2020: Record<string, { pct: number; mean_prob: number }>
  error?: string
}
export interface DDClassification {
  risk: Risk; score: number; reasons: string[]
  forest2020: Forest2020; forest2020_votes: number; forest2020_sources: string[]; forest2020_available: string[]
  loss_sources: string[]; loss_post2020_ha: number; agri_before_cutoff: boolean; commodity2020_pct: number
  predisturbance_pct: number; protected_max_pct: number; rdue_illegal: boolean
  whisp_like: 'low' | 'more_info_needed' | 'high'
  justification: { fr: string; en: string }
}
export interface DDResult {
  index: number; id: string; rejected: boolean; reasons?: string[]
  geometry_report?: { valid: boolean; reasons: string[]; area_ha: number; kind: 'point' | 'polygon'; needs_polygon: boolean }
  evidence?: DDEvidence
  context?: { protected: { kind: string; name: string; designation?: string; pct: number; ha: number }[]; rdue: { category?: string; zone?: string; legalite?: string } }
  classification?: DDClassification
  properties: { kind: 'parcel' | 'legacy'; label: string; village: string; producer: string; producer_code: string; producer_id: string | null }
  whisp?: Record<string, string> | null; whisp_risk?: string | null
  whisp_concordance: 'concordant' | 'plus_strict' | 'moins_strict' | 'non_calcule'
}
export interface DDSummary {
  analysed: number; rejected: number; counts: Record<Risk, number>; area_ha: Record<Risk, number>; total_area_ha: number
  whisp_concordance: Record<string, number>; whisp_concordance_rate: number | null
  conclusion: 'negligeable' | 'non_negligeable'; layers_unavailable?: string[]; protected_versions?: [string, string][]
}
export interface DDDecision {
  id: string; parcel_key: string; decision: string; decision_label: string; comment: string; author_name: string
  created_at: string; attachment_name: string; attachment_type: string; attachment_data: string | null
}
export interface DDAnalysis {
  id: string; cooperative: string; cooperative_name: string; lot: string | null; lot_code: string | null
  created_at: string; created_by: string | null; status: 'pending' | 'running' | 'done' | 'error'
  progress: number; total: number; scope: { source: string; label: string }
  thresholds: Record<string, number | boolean>; report_meta: ReportMeta; summary: DDSummary | Record<string, never>
  whisp_status: string; whisp_version: string; whisp_message: string; error: string; keep_until: string
  manifest?: Record<string, unknown>; results?: DDResult[]; decisions?: DDDecision[]
}
export interface ReportMeta {
  operator?: string; product?: 'cacao' | 'cafe'; hs_code?: string; quantity_kg?: number | null
  period_start?: string; period_end?: string; region?: string; country?: string; responsible?: string
}
export interface DDCatalog {
  engine_version: string
  datasets: { id: string; name: string; producer: string; version: string; resolution: string; licence: string; citation: string }[]
  sources: Record<string, { roles: string[]; encoding?: string; todo?: string }>
  defaults: Record<string, number | boolean>
  regulation: { regulation: string; cutoff_date: string; retention_years: number; point_max_area_ha: number
    country_risk: Record<string, string>; application_dates: Record<string, string>; hs_codes: Record<string, string> }
  whisp_configured: boolean
  /** textes communs à tous les outils (moteur eudr_evidence) : méthode, sens des risques, motifs, actions */
  explain?: DDExplain
}
export interface DDExplain {
  method: { title: string; text: string }[]; risk: Record<Risk, string>; reasons: Record<string, string>
  actions: Record<string, string>; thresholds: Record<string, string>; limits: string[]
}

const p = (cooperative?: string) => (cooperative ? { cooperative } : undefined)

export const ddApi = {
  catalog: () => api.get<DDCatalog>('/dd/catalog/'),
  settings: (cooperative?: string) => api.get<{ defaults: Record<string, number | boolean>; thresholds: Record<string, number | boolean> }>('/dd/settings/', { params: p(cooperative) }),
  saveSettings: (thresholds: Record<string, number | boolean>, cooperative?: string) => api.put('/dd/settings/', { thresholds, cooperative }),
  list: (cooperative?: string) => api.get<DDAnalysis[]>('/dd/analyses/', { params: p(cooperative) }),
  start: (body: { source: string; lot?: string | null; thresholds?: Record<string, number | boolean>; report_meta?: ReportMeta; cooperative?: string }) =>
    api.post<DDAnalysis>('/dd/analyses/', body),
  get: (id: string) => api.get<DDAnalysis>(`/dd/analyses/${id}/`, { timeout: 120000 }),
  status: (id: string) => api.get<{ status: DDAnalysis['status']; progress: number; total: number; error: string; whisp_status: string }>(`/dd/analyses/${id}/status/`),
  decide: (id: string, body: { parcel_key: string; decision: string; comment: string; attachment_name?: string; attachment_type?: string; attachment_data?: string }) =>
    api.post<DDDecision>(`/dd/analyses/${id}/decisions/`, body),
  whispExport: (id: string) => api.get<Blob>(`/dd/analyses/${id}/whisp-export/`, { responseType: 'blob', timeout: 120000 }),
  whispImport: (id: string, csv: string) => api.post<{ matched: number; rows: number; summary: DDSummary }>(`/dd/analyses/${id}/whisp-import/`, { csv }),
}

export const RISK_LABEL: Record<Risk, string> = { faible: 'Faible', a_verifier: 'À vérifier', eleve: 'Élevé' }
/** Badges, textes, PDF ; sur la carte satellite : RISK_MAP_COLOR (plus lumineux) */
export const RISK_COLOR: Record<Risk, string> = RISK_UI
export const RISK_MAP_COLOR: Record<Risk, string> = RISK_MAP
export const RISK_ON_COLOR: Record<Risk, string> = RISK_ON
export const RISK_TEXT_COLOR: Record<Risk, string> = RISK_TEXT
export const FOREST_LABEL: Record<Forest2020, string> = { oui: 'Forêt', incertain: 'Incertain', non: 'Non forêt' }
export const SOURCE_LABEL: Record<string, string> = {
  jrc_gfc2020: 'JRC 2020', tmf: 'TMF', worldcover2020: 'WorldCover', hansen: 'Hansen',
  tmf_deforestation: 'TMF déforestation', tmf_degradation: 'TMF dégradation', radd: 'RADD', glad_l: 'GLAD-L',
}
export const CONCORDANCE_LABEL: Record<string, string> = {
  concordant: 'Concordant', plus_strict: 'Plus strict que WHISP', moins_strict: 'Moins strict que WHISP', non_calcule: 'Non calculé',
}
export const WHISP_STATUS_LABEL: Record<string, string> = {
  non_execute: 'WHISP non exécuté', en_cours: 'WHISP en cours', execute: 'WHISP exécuté', importe: 'Résultats WHISP importés', erreur: 'WHISP en erreur',
}
