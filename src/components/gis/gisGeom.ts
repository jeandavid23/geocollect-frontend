import area from '@turf/area'

// Géométries de l'éditeur : toujours manipulées en « multi » (polygones → anneaux → sommets [lng, lat]),
// anneaux OUVERTS (sans répéter le premier sommet), puis reconverties en GeoJSON fermé à l'enregistrement.
export type Ring = [number, number][]
export type Multi = Ring[][]
export type PolyGeom = GeoJSON.Polygon | GeoJSON.MultiPolygon

const open = (r: number[][]): Ring => {
  const ring = r.map(([x, y]) => [x, y] as [number, number])
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop()
  return ring
}
const close = (r: Ring): number[][] => (r.length ? [...r.map(([x, y]) => [x, y]), [r[0][0], r[0][1]]] : [])

export function toMulti(g: PolyGeom): Multi {
  return g.type === 'Polygon' ? [g.coordinates.map(open)] : g.coordinates.map((p) => p.map(open))
}

export function fromMulti(m: Multi, prefer: PolyGeom['type'] = 'Polygon'): PolyGeom {
  const polys = m.filter((p) => p.length && p[0].length >= 3)
  if (polys.length === 1 && prefer === 'Polygon') return { type: 'Polygon', coordinates: polys[0].map(close) }
  return { type: 'MultiPolygon', coordinates: polys.map((p) => p.map(close)) }
}

/** GeoJSON → coordonnées Leaflet [lat, lng]. */
export function toLatLngs(g: PolyGeom): [number, number][][][] {
  return toMulti(g).map((p) => p.map((r) => r.map(([x, y]) => [y, x] as [number, number])))
}

export function translate(g: PolyGeom, dLng: number, dLat: number): PolyGeom {
  return fromMulti(toMulti(g).map((p) => p.map((r) => r.map(([x, y]) => [x + dLng, y + dLat] as [number, number]))), g.type)
}

export interface BBox { minX: number; minY: number; maxX: number; maxY: number }
export function bbox(g: PolyGeom): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of toMulti(g)) for (const r of p) for (const [x, y] of r) {
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}
export const bboxUnion = (a: BBox | null, b: BBox): BBox => (a
  ? { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }
  : b)

function pointInRing([x, y]: [number, number], ring: Ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
export function pointInPoly(pt: [number, number], g: PolyGeom) {
  return toMulti(g).some((p) => p.length && pointInRing(pt, p[0]) && !p.slice(1).some((h) => pointInRing(pt, h)))
}

/** Le polygone touche le rectangle (sélection rectangulaire, comme dans QGIS). */
export function intersectsBox(g: PolyGeom, b: BBox) {
  const gb = bbox(g)
  if (gb.maxX < b.minX || gb.minX > b.maxX || gb.maxY < b.minY || gb.minY > b.maxY) return false
  const inBox = ([x, y]: [number, number]) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY
  if (toMulti(g).some((p) => p.some((r) => r.some(inBox)))) return true
  const corners: [number, number][] = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]]
  if (corners.some((c) => pointInPoly(c, g))) return true
  // arêtes qui traversent le rectangle sans sommet à l'intérieur
  const seg = (a: [number, number], c: [number, number], d: [number, number], e: [number, number]) => {
    const o = (p: [number, number], q: [number, number], r: [number, number]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
    return o(a, c, d) !== o(a, c, e) && o(d, e, a) !== o(d, e, c)
  }
  const edges = corners.map((c, i) => [c, corners[(i + 1) % 4]] as const)
  return toMulti(g).some((p) => p.some((r) => r.some((pt, i) => edges.some(([c, d]) => seg(pt, r[(i + 1) % r.length], c, d)))))
}

export const areaHa = (g: PolyGeom) => { try { return Math.round((area(g) / 10000) * 10000) / 10000 } catch { return 0 } }

export function haversine([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const R = 6371008.8, r = Math.PI / 180
  const dLat = (y2 - y1) * r, dLng = (x2 - x1) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(y1 * r) * Math.cos(y2 * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export const lineLength = (pts: [number, number][]) => pts.slice(1).reduce((s, p, i) => s + haversine(pts[i], p), 0)

export const vertexCount = (g: PolyGeom) => toMulti(g).reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0)

/** Auto-intersection d'un anneau (contrôle rapide après édition des nœuds). */
export function hasSelfIntersection(g: PolyGeom) {
  const cross = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) => {
    const o = (p: [number, number], q: [number, number], r: [number, number]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d)
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  }
  for (const p of toMulti(g)) for (const r of p) {
    const n = r.length
    if (n > 400) continue
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (cross(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return true
    }
  }
  return false
}

export const fmtLength = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} km` : `${m.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} m`)
export const fmtArea = (ha: number) => `${ha.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} ha (${Math.round(ha * 10000).toLocaleString('fr-FR')} m²)`
