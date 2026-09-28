import api from './client'
import { gzipJson } from '../utils/gzip'

export interface ValidatorOptions {
  threshold: number              // % de superposition au-delà duquel le moins prioritaire est supprimé
  min_area_ha: number
  remove_exact_duplicates: boolean
  remove_full_containment: boolean
  remove_over_threshold: boolean
  remove_small: boolean
  remove_slivers: boolean
  fix_geometries: boolean
  detect_overlaps: boolean
}

export const DEFAULT_VALIDATOR_OPTIONS: ValidatorOptions = {
  threshold: 18, min_area_ha: 0.01,
  remove_exact_duplicates: true, remove_full_containment: true, remove_over_threshold: true,
  remove_small: true, remove_slivers: true, fix_geometries: true, detect_overlaps: true,
}

export type RemovalReason =
  | 'geometrie_nulle' | 'geometrie_irreparable' | 'surface_inferieure_seuil' | 'sliver'
  | 'doublon_exact' | 'inclusion_totale' | 'superposition_sup_seuil'

export interface ValidatorResult {
  index: number
  id: string
  pk?: string                    // source en base : identifiant de la parcelle
  status: 'kept' | 'removed'
  reason: RemovalReason | ''
  ref_id: string                 // polygone conservé à l'origine de la suppression
  corrected: boolean
  errors: string[]
  area_ha: number
  vertices: number
  overlap_ids: string
  overlap_pct: number
  is_ovlp: 'OUI' | 'NON'
  geometry?: GeoJSON.Geometry    // géométrie corrigée (ou géométrie de la source en base)
}

export interface ValidatorSummary {
  initial_count: number
  final_count: number
  deleted_count: number
  duplicates_removed: number
  containment_removed: number
  over_threshold_removed: number
  small_removed: number
  slivers_removed: number
  null_removed: number
  geometries_fixed: number
  overlaps_detected: number
  initial_area_ha: number
  final_area_ha: number
  topology_errors: Record<string, number>
  threshold: number
  min_area_ha: number
  processing_time: number
  source: string
}

export interface ValidatorResponse { summary: ValidatorSummary; results: ValidatorResult[] }

export const validatorApi = {
  /** Polygones d'un fichier : envoyés compressés (gzip), traités en une fois (superpositions globales). */
  runFeatures: async (features: { id: string; geometry: GeoJSON.Geometry }[], options: ValidatorOptions) => {
    const { body, gzip } = await gzipJson({ features, options })
    return api.post<ValidatorResponse>('/parcels/validator/run/', body, {
      headers: { 'Content-Type': 'application/json', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) },
      timeout: 300000,
    })
  },
  /** Données déjà en base : rien à envoyer. */
  runSource: (source: 'parcels' | 'legacy', options: ValidatorOptions, cooperative?: string) =>
    api.post<ValidatorResponse>('/parcels/validator/run/', { source, options, cooperative }, { timeout: 300000 }),
}
