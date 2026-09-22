import api from './client'

export type RiskLevel = 'high' | 'medium' | 'low' | 'unknown'

export interface DeforestationResult {
  name: string
  geometry_type: string
  area_ha?: number
  forest_pct?: number
  loss_recent_pct?: number   // perte forestière après le seuil EUDR (2020)
  loss_total_pct?: number    // perte totale 2001 -> 2023
  loss_recent_ha?: number
  alert_area_ha?: number | null  // alertes GFW/RADD récentes
  risk: RiskLevel
  risk_label: string
  error?: string
}

export interface DeforestationResponse {
  count: number
  cutoff_year: number
  summary: Record<RiskLevel, number>
  results: DeforestationResult[]
}

export interface AnalyzeFeature {
  name: string
  area_ha: number | null
  geometry: GeoJSON.Geometry
}

export const deforestationApi = {
  analyze: (features: AnalyzeFeature[], cutoffYear = 2020) =>
    api.post<DeforestationResponse>('/parcels/deforestation/analyze/', {
      features,
      cutoff_year: cutoffYear,
    }),
}
