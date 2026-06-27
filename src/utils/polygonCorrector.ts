import kinks from '@turf/kinks'
import unkinkPolygon from '@turf/unkink-polygon'
import booleanClockwise from '@turf/boolean-clockwise'
import area from '@turf/area'
import { polygon as turfPolygon } from '@turf/helpers'
import type { GeoJSONPolygon } from '../types'

// ─── Polygon Validator EUDR by JDK — Analysis & Correction ───────────────────
// Reproduces the geometry-repair features of the QGIS plugin:
//   • duplicate / coincident vertex removal
//   • ring closure
//   • spike removal
//   • self-intersection repair (unkink → keep largest part)
//   • winding-order normalisation (CCW, GeoJSON standard)

export interface PolygonIssue {
  code: 'self_intersection' | 'duplicate_vertices' | 'not_closed' | 'spikes' | 'winding_order' | 'too_few_vertices'
  label: string
  severity: 'error' | 'warning'
  detail: string
  fixable: boolean
}

export interface PolygonAnalysis {
  fieldId?: string
  issues: PolygonIssue[]
  isValid: boolean
  vertexCount: number
  areaHa: number
}

export interface CorrectionResult {
  corrected: GeoJSONPolygon
  applied: string[]
  changed: boolean
  areaBeforeHa: number
  areaAfterHa: number
  removedVertices: number
}

const ringArea = (ring: number[][]): number => {
  // signed shoelace (in squared degrees) — sign only used for winding
  let s = 0
  for (let i = 0; i < ring.length - 1; i++) {
    s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return s / 2
}

const safeArea = (ring: number[][]): number => {
  try {
    if (ring.length < 4) return 0
    return area(turfPolygon([closeRing(ring)])) / 10000 // ha
  } catch {
    return 0
  }
}

function closeRing(ring: number[][]): number[][] {
  if (ring.length === 0) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...ring, [first[0], first[1]]]
  }
  return ring
}

// Remove consecutive duplicate / near-duplicate vertices (tolerance ~0.1 m)
function removeDuplicates(ring: number[][], tolDeg = 1e-6): { ring: number[][]; removed: number } {
  const out: number[][] = []
  let removed = 0
  for (const pt of ring) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev[0] - pt[0]) < tolDeg && Math.abs(prev[1] - pt[1]) < tolDeg) {
      removed++
      continue
    }
    out.push(pt)
  }
  return { ring: out, removed }
}

// Remove spikes: a vertex whose angle is nearly 0° or 180° (degenerate)
function removeSpikes(ring: number[][], minAngleDeg = 1): { ring: number[][]; removed: number } {
  if (ring.length < 5) return { ring, removed: 0 }
  const open = ring.slice(0, -1) // work on open ring
  const n = open.length
  const keep: number[][] = []
  let removed = 0
  for (let i = 0; i < n; i++) {
    const prev = open[(i - 1 + n) % n]
    const curr = open[i]
    const next = open[(i + 1) % n]
    const v1x = prev[0] - curr[0], v1y = prev[1] - curr[1]
    const v2x = next[0] - curr[0], v2y = next[1] - curr[1]
    const dot = v1x * v2x + v1y * v2y
    const m1 = Math.hypot(v1x, v1y), m2 = Math.hypot(v2x, v2y)
    if (m1 === 0 || m2 === 0) { removed++; continue }
    const angle = (Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180) / Math.PI
    if (angle < minAngleDeg || angle > 180 - minAngleDeg) { removed++; continue }
    keep.push(curr)
  }
  return { ring: closeRing(keep), removed }
}

// Detect self-intersection count via turf kinks
function countKinks(ring: number[][]): number {
  try {
    const fc = kinks(turfPolygon([closeRing(ring)]))
    return fc.features.length
  } catch {
    return 0
  }
}

// Analyse a polygon — list all issues (no mutation)
export function analyzePolygon(geometry: GeoJSONPolygon, fieldId?: string): PolygonAnalysis {
  const ring = geometry.coordinates[0] ?? []
  const issues: PolygonIssue[] = []

  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1) : ring
  const vertexCount = open.length

  if (vertexCount < 3) {
    issues.push({
      code: 'too_few_vertices', label: 'Sommets insuffisants', severity: 'error',
      detail: `${vertexCount} sommet(s) — au moins 3 requis`, fixable: false,
    })
  }

  const { removed: dupRemoved } = removeDuplicates(ring)
  if (dupRemoved > 0) {
    issues.push({
      code: 'duplicate_vertices', label: 'Sommets dupliqués', severity: 'warning',
      detail: `${dupRemoved} sommet(s) dupliqué(s) détecté(s)`, fixable: true,
    })
  }

  const isClosed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  if (!isClosed) {
    issues.push({
      code: 'not_closed', label: 'Anneau non fermé', severity: 'error',
      detail: 'Le premier et le dernier sommet ne coïncident pas', fixable: true,
    })
  }

  const nKinks = countKinks(ring)
  if (nKinks > 0) {
    issues.push({
      code: 'self_intersection', label: 'Auto-intersection', severity: 'error',
      detail: `${nKinks} point(s) d'auto-intersection détecté(s)`, fixable: true,
    })
  }

  const { removed: spikeRemoved } = removeSpikes(ring)
  if (spikeRemoved > 0) {
    issues.push({
      code: 'spikes', label: 'Pics / sommets dégénérés', severity: 'warning',
      detail: `${spikeRemoved} pic(s) géométrique(s) détecté(s)`, fixable: true,
    })
  }

  if (ring.length >= 4 && ringArea(closeRing(ring)) < 0) {
    issues.push({
      code: 'winding_order', label: 'Orientation non standard', severity: 'warning',
      detail: 'Sens horaire — la norme GeoJSON attend le sens antihoraire (CCW)', fixable: true,
    })
  }

  const errors = issues.filter((i) => i.severity === 'error')
  return {
    fieldId,
    issues,
    isValid: errors.length === 0,
    vertexCount,
    areaHa: safeArea(ring),
  }
}

// Correct a polygon — apply all available repairs, return the fixed geometry
export function correctPolygon(geometry: GeoJSONPolygon): CorrectionResult {
  const original = geometry.coordinates[0] ?? []
  const areaBeforeHa = safeArea(original)
  const applied: string[] = []
  let ring = [...original]
  const startVertices = ring.length

  // 1. Remove duplicates
  const dup = removeDuplicates(ring)
  if (dup.removed > 0) { ring = dup.ring; applied.push(`Suppression de ${dup.removed} sommet(s) dupliqué(s)`) }

  // 2. Close ring
  const before = ring.length
  ring = closeRing(ring)
  if (ring.length !== before) applied.push('Fermeture de l\'anneau')

  // 3. Remove spikes
  const spk = removeSpikes(ring)
  if (spk.removed > 0) { ring = spk.ring; applied.push(`Suppression de ${spk.removed} pic(s)`) }

  // 4. Repair self-intersections (unkink → keep largest part)
  if (countKinks(ring) > 0) {
    try {
      const result = unkinkPolygon(turfPolygon([closeRing(ring)]))
      let bestRing: number[][] | null = null
      let bestArea = -1
      for (const f of result.features) {
        const r = f.geometry.coordinates[0]
        const a = area(f)
        if (a > bestArea) { bestArea = a; bestRing = r }
      }
      if (bestRing) { ring = bestRing; applied.push('Réparation de l\'auto-intersection (unkink)') }
    } catch {
      // leave as-is if turf fails
    }
  }

  // 5. Normalise winding order to CCW
  try {
    const closed = closeRing(ring)
    if (booleanClockwise(closed)) {
      ring = [...closed].reverse()
      applied.push('Réorientation en sens antihoraire (CCW)')
    } else {
      ring = closed
    }
  } catch {
    ring = closeRing(ring)
  }

  const areaAfterHa = safeArea(ring)
  return {
    corrected: { type: 'Polygon', coordinates: [closeRing(ring)] },
    applied,
    changed: applied.length > 0,
    areaBeforeHa,
    areaAfterHa,
    removedVertices: Math.max(0, startVertices - ring.length),
  }
}
