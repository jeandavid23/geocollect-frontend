import type { GPSPoint } from '../types'

// Haversine distance in meters between two lat/lng points
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Polygon area in m² from GPS points (Shoelace / Gauss)
export function computePolygonArea(points: GPSPoint[]): number {
  if (points.length < 3) return 0
  const R = 6371000
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const lat1 = (points[i].lat * Math.PI) / 180
    const lat2 = (points[j].lat * Math.PI) / 180
    const dLng = ((points[j].lng - points[i].lng) * Math.PI) / 180
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  return Math.abs((area * R * R) / 2)
}

// Polygon perimeter in meters
export function computePerimeter(points: GPSPoint[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineDistance(
      points[i].lat, points[i].lng,
      points[i + 1].lat, points[i + 1].lng
    )
  }
  // Close the loop
  total += haversineDistance(
    points[points.length - 1].lat, points[points.length - 1].lng,
    points[0].lat, points[0].lng
  )
  return total
}

// Filter out aberrant GPS points (outlier detection)
export function filterAberrantPoints(
  points: GPSPoint[],
  maxSpeedMs = 10 // max 10 m/s walking
): GPSPoint[] {
  if (points.length < 2) return points
  const filtered: GPSPoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = filtered[filtered.length - 1]
    const curr = points[i]
    const dist = haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng)
    const timeSec = (curr.timestamp - prev.timestamp) / 1000
    if (timeSec > 0) {
      const speed = dist / timeSec
      if (speed <= maxSpeedMs) filtered.push(curr)
    } else {
      filtered.push(curr)
    }
  }
  return filtered
}

// Convert GPS points array to GeoJSON polygon coordinates
export function pointsToGeoJSONCoords(points: GPSPoint[]): number[][][] {
  if (points.length < 3) return []
  const coords = points.map((p) => [p.lng, p.lat])
  // Close ring
  coords.push([points[0].lng, points[0].lat])
  return [coords]
}

// GPS accuracy label
export function accuracyLabel(accuracy: number): {
  label: string
  color: string
  ok: boolean
} {
  if (accuracy <= 3) return { label: 'Excellente', color: 'text-green-600', ok: true }
  if (accuracy <= 5) return { label: 'Bonne', color: 'text-green-500', ok: true }
  if (accuracy <= 10) return { label: 'Acceptable', color: 'text-yellow-500', ok: true }
  if (accuracy <= 20) return { label: 'Faible', color: 'text-orange-500', ok: false }
  return { label: 'Mauvaise', color: 'text-red-500', ok: false }
}

// ─── Overlap / intersection detection ────────────────────────────────────────

// Ray-casting: is a [lng, lat] point inside a polygon ring (array of [lng, lat])?
export function pointInPolygon(point: number[], ring: number[][]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Do two segments (p1-p2) and (p3-p4) properly cross?
function segmentsIntersect(p1: number[], p2: number[], p3: number[], p4: number[]): boolean {
  const d = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const d1 = d(p3, p4, p1)
  const d2 = d(p3, p4, p2)
  const d3 = d(p1, p2, p3)
  const d4 = d(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

// Do two polygon rings (each an array of [lng, lat]) overlap?
export function polygonsOverlap(ringA: number[][], ringB: number[][]): boolean {
  // 1. Any vertex of A inside B, or vertex of B inside A → overlap
  if (ringA.some((pt) => pointInPolygon(pt, ringB))) return true
  if (ringB.some((pt) => pointInPolygon(pt, ringA))) return true
  // 2. Any edge of A crosses any edge of B → overlap
  for (let i = 0; i < ringA.length - 1; i++) {
    for (let j = 0; j < ringB.length - 1; j++) {
      if (segmentsIntersect(ringA[i], ringA[i + 1], ringB[j], ringB[j + 1])) return true
    }
  }
  return false
}

// Find existing parcels whose polygon overlaps the given ring.
// Each parcel must expose { id, fieldId, geometry: { coordinates: number[][][] } }.
export function findOverlappingParcels<T extends { geometry: { coordinates: number[][][] } }>(
  ring: number[][],
  parcels: T[]
): T[] {
  if (ring.length < 3) return []
  return parcels.filter((p) => {
    const other = p.geometry?.coordinates?.[0]
    if (!other || other.length < 3) return false
    return polygonsOverlap(ring, other)
  })
}

export function formatArea(m2: number): string {
  const ha = m2 / 10000
  if (ha >= 0.01) return `${ha.toFixed(2)} ha`
  return `${m2.toFixed(0)} m²`
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`
  return `${m.toFixed(0)} m`
}
