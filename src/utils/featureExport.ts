import * as XLSX from 'xlsx'
import * as shpwrite from '@mapbox/shp-write'
import { downloadBlob } from './geoExport'

// Exports génériques d'entités GeoJSON (sorties des outils de traitement)

export interface OutFeature { geometry: GeoJSON.Geometry; properties: Record<string, unknown> }

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function exportGeoJSON(features: OutFeature[], filename: string) {
  const fc = { type: 'FeatureCollection', features: features.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: f.properties })) }
  downloadBlob(new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }), filename)
}

function kmlPolygon(coords: number[][][]) {
  const ring = (r: number[][]) => r.map(([x, y]) => `${x},${y},0`).join(' ')
  const [outer, ...holes] = coords
  return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring(outer ?? [])}</coordinates></LinearRing></outerBoundaryIs>${
    holes.map((h) => `<innerBoundaryIs><LinearRing><coordinates>${ring(h)}</coordinates></LinearRing></innerBoundaryIs>`).join('')}</Polygon>`
}

export function exportKML(features: OutFeature[], filename: string, nameField?: string) {
  const marks = features.map((f, i) => {
    const g = f.geometry as { type: string; coordinates: unknown }
    const geom = g.type === 'Polygon' ? kmlPolygon(g.coordinates as number[][][])
      : g.type === 'MultiPolygon' ? `<MultiGeometry>${(g.coordinates as number[][][][]).map(kmlPolygon).join('')}</MultiGeometry>` : ''
    if (!geom) return ''
    const data = Object.entries(f.properties).map(([k, v]) => `<Data name="${esc(k)}"><value>${esc(v)}</value></Data>`).join('')
    const name = nameField ? f.properties[nameField] : undefined
    return `<Placemark><name>${esc(name ?? `#${i + 1}`)}</name><ExtendedData>${data}</ExtendedData>${geom}</Placemark>`
  }).join('\n')
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(filename)}</name>\n${marks}\n</Document></kml>`
  downloadBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), filename)
}

/**
 * shp-write écrit les Polygon et les MultiPolygon dans deux couches du même nom : la seconde écrase la première
 * (des polygones disparaissaient du .zip). Tout est donc converti en MultiPolygon → une seule couche complète.
 */
export function asMultiPolygon(g: GeoJSON.Geometry): GeoJSON.Geometry {
  return g?.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [g.coordinates] } : g
}

export async function exportShapefile(features: OutFeature[], filename: string, layer: string) {
  // Shapefile : noms de champs limités à 10 caractères, valeurs texte
  const fc = {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature', geometry: asMultiPolygon(f.geometry),
      properties: Object.fromEntries(Object.entries(f.properties).map(([k, v]) => [k, v === null || v === undefined ? '' : typeof v === 'number' ? v : String(v)])),
    })),
  }
  const blob = await shpwrite.zip(fc as never, { outputType: 'blob', types: { polygon: layer } } as never) as unknown as Blob
  downloadBlob(blob, filename)
}

export function exportExcel(sheets: { name: string; rows: Record<string, unknown>[] | unknown[][] }[], filename: string) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = Array.isArray(s.rows[0]) ? XLSX.utils.aoa_to_sheet(s.rows as unknown[][]) : XLSX.utils.json_to_sheet(s.rows as Record<string, unknown>[])
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadBlob(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}
