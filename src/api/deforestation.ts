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
  // Matrice RDUE (si activée)
  usage_cat?: string          // Enclave | Parc/reserve | Foret classee | Agro-foret classee | Domaine rural
  zone?: string               // nom de la forêt classée / du parc / de l'enclave
  legalite?: string
  zero_def?: string
  rdue_stat?: 'Potentiellement conforme' | 'Non conforme' | 'A verifier'
  legal_note?: string
}

export interface DeforestationOptions {
  standard: Standard
  tolerance_ha: number
  alert_pct: number
  treecover_min: number
  apply_rdue: boolean         // matrice RDUE : légalité foncière x zéro déforestation
  forest_min_frac: number     // part de forêt au 31/12 de coupure pour classer la parcelle « Forêt »
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
  // Forêts classées, parcs / réserves, enclaves (données privées de la coopérative, en base)
  landZones: () => api.get<GeoJSON.FeatureCollection>('/parcels/landuse/', { timeout: 120000 }),
  // 1000 parcelles max par appel : la page découpe les gros fichiers en lots
  analyze: (features: AnalyzeFeature[], options: DeforestationOptions) =>
    api.post<DeforestationResponse>('/parcels/deforestation/analyze/', { features, ...options }, { timeout: 180000 }),
}
