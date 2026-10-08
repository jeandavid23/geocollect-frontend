import { areaHa, hasSelfIntersection, type PolyGeom } from '../components/gis/gisGeom'

// Export au format du système d'information EUDR (TRACES) — fichier GeoJSON de la déclaration de diligence raisonnable.
// Règles : https://eudr.webcloud.ec.europa.eu/tracesnt/help/eudr-documentation/operator/geojson-description.html
//  - WGS 84, [longitude, latitude], 6 décimales ; Point, MultiPoint, Polygon, MultiPolygon uniquement
//  - polygones fermés, au moins 4 positions, SANS trous ni auto-intersection
//  - propriétés (sensibles à la casse) : ProducerName, ProducerCountry (ISO 2), ProductionPlace, Area (nombre, en ha)
//  - un point suffit pour une parcelle de moins de 4 ha ; 25 Mo au maximum par déclaration

export interface TracesInput {
  id: string                      // identifiant affiché dans le rapport (Field ID, nom…)
  geometry: GeoJSON.Geometry
  producerName: string
  productionPlace: string
  areaHa?: number | null
}

export interface TracesOptions {
  country: string                 // code ISO 2 (CI)
  pointsUnder4ha: boolean         // point au lieu du polygone pour les parcelles < 4 ha
  fillHoles: boolean              // trous retirés (sinon la parcelle est écartée)
}

export interface TracesIssue { id: string; level: 'exclu' | 'corrigé'; message: string }

export interface TracesResult {
  files: { name: string; content: string; features: number }[]
  kept: number
  points: number
  polygons: number
  excluded: number
  issues: TracesIssue[]
  totalArea: number
}

const MAX_BYTES = 24 * 1024 * 1024        // marge sous la limite de 25 Mo
const r6 = (v: number) => Math.round(v * 1e6) / 1e6

/** Anneau prêt pour TRACES : arrondi à 6 décimales, sommets consécutifs identiques retirés, fermé. Null si < 4 positions. */
function cleanRing(ring: number[][]): number[][] | null {
  const out: number[][] = []
  for (const p of ring) {
    const q = [r6(p[0]), r6(p[1])]
    const last = out[out.length - 1]
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q)
  }
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop()
  if (out.length < 3) return null
  out.push([out[0][0], out[0][1]])
  return out
}

/** Point représentatif d'un polygone : barycentre de surface de l'anneau extérieur (le plus grand). */
function centroid(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  let best = polys[0][0], bestA = 0
  for (const p of polys) {
    let a = 0
    for (let i = 0; i < p[0].length - 1; i++) a += p[0][i][0] * p[0][i + 1][1] - p[0][i + 1][0] * p[0][i][1]
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = p[0] }
  }
  let A = 0, cx = 0, cy = 0
  for (let i = 0; i < best.length - 1; i++) {
    const [x0, y0] = best[i], [x1, y1] = best[i + 1]
    const f = x0 * y1 - x1 * y0
    A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
  }
  if (Math.abs(A) < 1e-12) return [r6(best[0][0]), r6(best[0][1])]
  return [r6(cx / (3 * A)), r6(cy / (3 * A))]
}

export function buildTraces(items: TracesInput[], opts: TracesOptions, baseName: string): TracesResult {
  const issues: TracesIssue[] = []
  const features: object[] = []
  let points = 0, polygons = 0, totalArea = 0
  const country = opts.country.trim().toUpperCase()

  for (const it of items) {
    const g = it.geometry
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
      if (g?.type === 'Point') {
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [r6(g.coordinates[0]), r6(g.coordinates[1])] },
          properties: props(it, country, it.areaHa ?? 4) })
        points++; totalArea += it.areaHa ?? 4
      } else issues.push({ id: it.id, level: 'exclu', message: 'Géométrie absente ou non surfacique' })
      continue
    }
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    const cleaned: number[][][][] = []
    let holes = 0, broken = false
    for (const p of polys) {
      if (p.length > 1) holes += p.length - 1
      const outer = cleanRing(p[0])
      if (!outer) { broken = true; continue }
      cleaned.push(opts.fillHoles ? [outer] : [outer, ...p.slice(1).map(cleanRing).filter(Boolean) as number[][][]])
    }
    if (!cleaned.length) { issues.push({ id: it.id, level: 'exclu', message: 'Polygone trop petit (moins de 3 sommets distincts après arrondi)' }); continue }
    if (broken) issues.push({ id: it.id, level: 'corrigé', message: 'Partie dégénérée retirée' })
    if (holes && !opts.fillHoles) { issues.push({ id: it.id, level: 'exclu', message: `${holes} trou(s) : refusé par TRACES (cochez « Combler les trous » ou découpez la parcelle)` }); continue }
    if (holes) issues.push({ id: it.id, level: 'corrigé', message: `${holes} trou(s) comblé(s)` })
    const geom: PolyGeom = cleaned.length === 1 ? { type: 'Polygon', coordinates: cleaned[0] } : { type: 'MultiPolygon', coordinates: cleaned }
    if (hasSelfIntersection(geom)) { issues.push({ id: it.id, level: 'exclu', message: 'Polygone qui se croise lui-même : passez-le au Self-intersection' }); continue }
    const ha = Math.round((it.areaHa && it.areaHa > 0 ? it.areaHa : areaHa(geom)) * 10000) / 10000
    totalArea += ha
    if (opts.pointsUnder4ha && ha < 4) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: centroid(geom) }, properties: props(it, country, ha) })
      points++
    } else {
      features.push({ type: 'Feature', geometry: geom, properties: props(it, country, ha) })
      polygons++
    }
  }

  // découpage en fichiers de moins de 25 Mo
  const files: TracesResult['files'] = []
  let chunk: string[] = [], size = 0
  const flush = () => {
    if (!chunk.length) return
    const n = files.length + 1
    files.push({ name: `${baseName}${n > 1 || size > MAX_BYTES ? `_partie${n}` : ''}.geojson`, content: `{"type":"FeatureCollection","features":[${chunk.join(',')}]}`, features: chunk.length })
    chunk = []; size = 0
  }
  for (const f of features) {
    const s = JSON.stringify(f)
    if (size + s.length > MAX_BYTES) flush()
    chunk.push(s); size += s.length + 1
  }
  flush()
  if (files.length > 1) files.forEach((f, i) => { f.name = `${baseName}_partie${i + 1}.geojson` })

  return { files, kept: features.length, points, polygons, excluded: issues.filter((i) => i.level === 'exclu').length, issues, totalArea }
}

function props(it: TracesInput, country: string, area: number) {
  const p: Record<string, string | number> = { ProducerCountry: country, Area: Math.round(area * 10000) / 10000 }
  if (it.producerName?.trim()) p.ProducerName = it.producerName.trim().slice(0, 255)
  if (it.productionPlace?.trim()) p.ProductionPlace = it.productionPlace.trim().slice(0, 255)
  return p
}
