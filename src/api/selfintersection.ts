import api from './client'
import { gzipJson } from '../utils/gzip'

export interface SelfIntersectionOptions {
  fix_geometries: boolean
  multipart_to_single: boolean
  fill_holes: boolean
  fill_holes_max_ha: number        // 0 = tous les trous
  round_corners: boolean
  round_radius_m: number
  min_area_ha: number              // suppression des polygones de 0 à N ha (borne haute exclue)
  remove_dup_code: boolean
  id_field: string                 // champ code (Field_ID) pour la déduplication
}

// Valeurs par défaut du plugin (si_hole_engine.py)
export const DEFAULT_SI_OPTIONS: SelfIntersectionOptions = {
  fix_geometries: true, multipart_to_single: true, fill_holes: true, fill_holes_max_ha: 0,
  round_corners: true, round_radius_m: 2, min_area_ha: 0.25, remove_dup_code: true, id_field: '',
}

export interface SelfIntersectionResult {
  index: number                    // rang du polygone d'origine
  part: number                     // rang de la partie après éclatement
  id: string
  status: 'kept' | 'deleted' | 'dup_code'
  reason: string
  ref_id: string                   // code en doublon
  area_ha: number
  errors: string[]
  corrected: boolean
  holes_filled: number
  rounded: boolean
  geometry?: GeoJSON.Geometry      // géométrie nettoyée
}

export interface SelfIntersectionSummary {
  initial_count: number
  after_split_count: number
  final_count: number
  deleted_count: number
  small_removed: number
  null_removed: number
  dup_code_removed: number
  geometries_fixed: number
  holes_filled: number
  rounded_count: number
  initial_area_ha: number
  final_area_ha: number
  topology_errors: Record<string, number>
  min_area_ha: number
  id_field: string
  processing_time: number
}

export interface SelfIntersectionResponse { summary: SelfIntersectionSummary; results: SelfIntersectionResult[] }

export const selfIntersectionApi = {
  run: async (features: { id: string; geometry: GeoJSON.Geometry; properties: Record<string, unknown> }[], options: SelfIntersectionOptions) => {
    const { body, gzip } = await gzipJson({ features, options })
    return api.post<SelfIntersectionResponse>('/parcels/selfintersection/run/', body, {
      headers: { 'Content-Type': 'application/json', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) },
      timeout: 300000,
    })
  },
}
