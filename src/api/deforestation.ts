import api from './client'

// Statuts et niveaux de risque du plugin « Deforestation check »
export type DefStatus = 'Conforme' | 'A risque' | 'Non conforme' | 'Indetermine'
export type RiskLevel = 'Faible' | 'Modere' | 'Eleve' | 'Tres eleve'
export type Standard = 'EUDR' | 'RA' | 'EUDR+RA'

export interface DeforestationResult {
  status: DefStatus
  risk_level?: RiskLevel
  area_ha?: number
  defor_ha?: number          // perte forestière APRÈS la date de coupure
  defor_pct?: number
  forest2000_pct?: number    // part de la parcelle boisée en 2000 (couvert >= seuil FAO)
  forest2020_pct?: number    // part encore boisée au 31/12 de l'année de coupure
  cover2020?: 'Foret' | 'Agriculture'
  years?: string             // années de perte détectées
  loss_by_year?: Record<string, number>
  pixels?: number
  method?: 'pixels' | 'pixels_touches' | 'centroide'
  error?: string
}

export interface DeforestationOptions {
  standard: Standard
  tolerance_ha: number
  alert_pct: number
  treecover_min: number
}

export interface DeforestationResponse {
  count: number
  standard: Standard
  cutoff_year: number
  source: string
  results: DeforestationResult[]
}

export interface AnalyzeFeature {
  geometry: GeoJSON.Geometry
  area_ha: number | null
}

export const deforestationApi = {
  // 1000 parcelles max par appel : la page découpe les gros fichiers en lots
  analyze: (features: AnalyzeFeature[], options: DeforestationOptions) =>
    api.post<DeforestationResponse>('/parcels/deforestation/analyze/', { features, ...options }, { timeout: 180000 }),
}
