import type { GeoJSONPolygon, ValidationResult, ValidationCheck } from '../types'

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function polygonArea(coords: number[][]): number {
  let area = 0
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i][0] * coords[i + 1][1]
    area -= coords[i + 1][0] * coords[i][1]
  }
  return Math.abs(area / 2)
}

function degreesToMeters(degArea: number): number {
  // Approximation for West Africa (latitude ~7°N)
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos((7 * Math.PI) / 180)
  return degArea * metersPerDegLat * metersPerDegLng
}

function segmentsIntersect(
  p1: number[], p2: number[],
  p3: number[], p4: number[]
): boolean {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1]
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1]
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / cross
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / cross
  return t > 0 && t < 1 && u > 0 && u < 1
}

function hasAutoIntersection(coords: number[][]): boolean {
  const n = coords.length - 1
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (segmentsIntersect(coords[i], coords[i + 1], coords[j], coords[j + 1])) {
        return true
      }
    }
  }
  return false
}

function isClockwise(coords: number[][]): boolean {
  let sum = 0
  for (let i = 0; i < coords.length - 1; i++) {
    sum += (coords[i + 1][0] - coords[i][0]) * (coords[i + 1][1] + coords[i][1])
  }
  return sum > 0
}

// ─── Main Validator (Polygon Validator EUDR by JDK) ──────────────────────────

export function validateEUDR(
  geometry: GeoJSONPolygon,
  options: {
    minAreaHa?: number
    maxAreaHa?: number
    country?: string
    culture?: string
  } = {}
): ValidationResult {
  const { minAreaHa = 0.1, maxAreaHa = 500, country = 'Côte d\'Ivoire' } = options
  const coords = geometry.coordinates[0]
  const checks: ValidationCheck[] = []

  // 1. Geometry not null
  checks.push({
    name: 'geometry_valid',
    label: 'Géométrie valide',
    passed: coords.length >= 4,
    severity: 'error',
    message: coords.length >= 4
      ? 'La géométrie est valide'
      : `Polygone invalide : ${coords.length} points (min 4)`,
    value: coords.length,
  })

  // 2. Ring closed
  const isClosed =
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
  checks.push({
    name: 'ring_closed',
    label: 'Anneau fermé',
    passed: isClosed,
    severity: 'error',
    message: isClosed
      ? 'Le polygone est correctement fermé'
      : 'Le premier et dernier point ne coïncident pas',
  })

  // 3. Auto-intersection
  const selfIntersects = hasAutoIntersection(coords)
  checks.push({
    name: 'no_self_intersection',
    label: 'Pas d\'auto-intersection',
    passed: !selfIntersects,
    severity: 'error',
    message: !selfIntersects
      ? 'Aucune auto-intersection détectée'
      : 'Le polygone s\'auto-intersecte (géométrie invalide)',
  })

  // 4. Minimum area
  const degArea = polygonArea(coords)
  const areaM2 = degreesToMeters(degArea)
  const areaHa = areaM2 / 10000
  const aboveMin = areaHa >= minAreaHa
  checks.push({
    name: 'min_area',
    label: `Superficie minimale (${minAreaHa} ha)`,
    passed: aboveMin,
    severity: 'error',
    message: aboveMin
      ? `Superficie ${areaHa.toFixed(2)} ha — conforme`
      : `Superficie ${areaHa.toFixed(2)} ha inférieure au minimum ${minAreaHa} ha`,
    value: `${areaHa.toFixed(2)} ha`,
  })

  // 5. Maximum area
  const belowMax = areaHa <= maxAreaHa
  checks.push({
    name: 'max_area',
    label: `Superficie maximale (${maxAreaHa} ha)`,
    passed: belowMax,
    severity: 'warning',
    message: belowMax
      ? `Superficie ${areaHa.toFixed(2)} ha — dans les limites`
      : `Superficie ${areaHa.toFixed(2)} ha supérieure au maximum attendu`,
    value: `${areaHa.toFixed(2)} ha`,
  })

  // 6. Orientation (counter-clockwise for GeoJSON standard)
  const cw = isClockwise(coords)
  checks.push({
    name: 'orientation',
    label: 'Orientation GeoJSON (CCW)',
    passed: !cw,
    severity: 'warning',
    message: !cw
      ? 'Orientation correcte (sens antihoraire)'
      : 'Orientation horaire (non standard GeoJSON)',
  })

  // 7. Vertex count
  const vertexCount = coords.length - 1
  const goodVertexCount = vertexCount >= 3 && vertexCount <= 200
  checks.push({
    name: 'vertex_count',
    label: 'Nombre de sommets',
    passed: goodVertexCount,
    severity: 'warning',
    message: goodVertexCount
      ? `${vertexCount} sommets — valide`
      : `${vertexCount} sommets hors de la plage acceptable (3-200)`,
    value: vertexCount,
  })

  // 8. Country check (mock — would use spatial query in prod)
  const inCountry = country === 'Côte d\'Ivoire' || country === 'Ghana' || country === 'Cameroun'
  checks.push({
    name: 'country_boundary',
    label: `Localisation (${country})`,
    passed: inCountry,
    severity: 'error',
    message: inCountry
      ? `La parcelle est localisée en ${country}`
      : `La parcelle semble hors des limites de ${country}`,
  })

  // 9. Deforestation risk (mock score — would use external API in prod)
  const deforestationRisk = Math.random() > 0.2
  checks.push({
    name: 'deforestation_risk',
    label: 'Absence de déforestation (EUDR)',
    passed: deforestationRisk,
    severity: 'error',
    message: deforestationRisk
      ? 'Aucun indicateur de déforestation détecté après 2020'
      : 'Risque de déforestation détecté — vérification requise',
  })

  // 10. Protected area check (mock)
  const notInProtectedArea = Math.random() > 0.1
  checks.push({
    name: 'protected_area',
    label: 'Zone non protégée',
    passed: notInProtectedArea,
    severity: 'error',
    message: notInProtectedArea
      ? 'La parcelle n\'est pas en zone protégée'
      : 'La parcelle chevauche une zone protégée ou forêt classée',
  })

  // Calculate EUDR score
  const errorChecks = checks.filter((c) => c.severity === 'error')
  const warningChecks = checks.filter((c) => c.severity === 'warning')
  const errorScore = errorChecks.filter((c) => c.passed).length / errorChecks.length
  const warningScore = warningChecks.filter((c) => c.passed).length / warningChecks.length
  const eudrScore = Math.round((errorScore * 0.8 + warningScore * 0.2) * 100)

  const isValid = errorChecks.every((c) => c.passed) && eudrScore >= 60

  return {
    isValid,
    eudrScore,
    checks,
    summary: isValid
      ? `Polygone conforme EUDR — Score ${eudrScore}%`
      : `Polygone NON conforme EUDR — Score ${eudrScore}% — ${errorChecks.filter((c) => !c.passed).length} erreur(s) critique(s)`,
    timestamp: new Date().toISOString(),
  }
}
