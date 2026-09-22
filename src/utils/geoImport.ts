// Import multi-format pour l'analyse de déforestation :
//   - GeoJSON (.geojson / .json)
//   - KML (.kml)
//   - Shapefile (.zip contenant .shp/.dbf/.shx)
//   - Excel de points (.xlsx / .xls)  -> une ligne = un point (lat/lng)
//
// Toutes les sources sont normalisées vers une liste d'ImportedFeature.
import area from '@turf/area'
import { kml } from '@tmcw/togeojson'
import shp from 'shpjs'
import * as XLSX from 'xlsx'

export interface ImportedFeature {
  name: string
  area_ha: number | null
  geometry: GeoJSON.Geometry
}

const NAME_KEYS = ['name', 'nom', 'field_id', 'id', 'code', 'parcelle', 'producteur', 'producer']
const LAT_KEYS = ['lat', 'latitude', 'y', 'lat_dd', 'gps_lat']
const LNG_KEYS = ['lng', 'lon', 'long', 'longitude', 'x', 'lon_dd', 'gps_lon', 'gps_lng']
const AREA_KEYS = ['area_ha', 'superficie', 'surface', 'area', 'ha', 'hectares']

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const lower: Record<string, unknown> = {}
  for (const k of Object.keys(row)) lower[k.toLowerCase().trim()] = row[k]
  for (const key of keys) if (lower[key] !== undefined && lower[key] !== '') return lower[key]
  return undefined
}

function polygonAreaHa(geom: GeoJSON.Geometry): number | null {
  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    try {
      return Math.round((area(geom as never) / 10000) * 10000) / 10000
    } catch {
      return null
    }
  }
  return null
}

function featuresFromGeoJSON(gj: unknown): ImportedFeature[] {
  const out: ImportedFeature[] = []
  const pushFeature = (geom: GeoJSON.Geometry | null, props: Record<string, unknown>, idx: number) => {
    if (!geom) return
    const name =
      (pick(props, NAME_KEYS) as string) || `Entité ${idx + 1}`
    const areaProp = pick(props, AREA_KEYS)
    const areaHa =
      areaProp != null && !isNaN(Number(areaProp)) ? Number(areaProp) : polygonAreaHa(geom)
    out.push({ name: String(name), area_ha: areaHa, geometry: geom })
  }

  const obj = gj as { type?: string; features?: unknown[]; geometry?: unknown; geometries?: unknown[] }
  if (obj?.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    obj.features.forEach((f, i) => {
      const feat = f as GeoJSON.Feature
      pushFeature(feat.geometry as GeoJSON.Geometry, (feat.properties || {}) as Record<string, unknown>, i)
    })
  } else if (obj?.type === 'Feature') {
    const feat = obj as unknown as GeoJSON.Feature
    pushFeature(feat.geometry as GeoJSON.Geometry, (feat.properties || {}) as Record<string, unknown>, 0)
  } else if (obj?.type === 'GeometryCollection' && Array.isArray(obj.geometries)) {
    obj.geometries.forEach((g, i) => pushFeature(g as GeoJSON.Geometry, {}, i))
  } else if (obj?.type) {
    // géométrie brute
    pushFeature(obj as unknown as GeoJSON.Geometry, {}, 0)
  }
  return out
}

function featuresFromExcel(buf: ArrayBuffer): ImportedFeature[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const out: ImportedFeature[] = []
  rows.forEach((row, i) => {
    const lat = Number(pick(row, LAT_KEYS))
    const lng = Number(pick(row, LNG_KEYS))
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return
    const name = (pick(row, NAME_KEYS) as string) || `Point ${i + 1}`
    const areaProp = pick(row, AREA_KEYS)
    const areaHa = areaProp != null && !isNaN(Number(areaProp)) && Number(areaProp) > 0 ? Number(areaProp) : null
    out.push({
      name: String(name),
      area_ha: areaHa,
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })
  })
  return out
}

/** Parse un fichier importé vers une liste d'entités normalisées. */
export async function parseGeoFile(file: File): Promise<ImportedFeature[]> {
  const ext = file.name.toLowerCase().split('.').pop() || ''

  if (ext === 'geojson' || ext === 'json') {
    const text = await file.text()
    return featuresFromGeoJSON(JSON.parse(text))
  }

  if (ext === 'kml') {
    const text = await file.text()
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    return featuresFromGeoJSON(kml(doc))
  }

  if (ext === 'zip') {
    const buf = await file.arrayBuffer()
    const result = await shp(buf)
    // shp() renvoie une FeatureCollection ou un tableau de FeatureCollection
    if (Array.isArray(result)) {
      return result.flatMap((fc) => featuresFromGeoJSON(fc))
    }
    return featuresFromGeoJSON(result)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer()
    return featuresFromExcel(buf)
  }

  throw new Error(
    `Format non pris en charge : .${ext}. Utilisez GeoJSON, KML, Shapefile (.zip) ou Excel (.xlsx).`,
  )
}
