// Import des ANCIENS polygones d'une coopérative :
//   - KML (.kml) et KMZ (.kmz, KML compressé de Google Earth)
//   - GeoPackage (.gpkg)
//   - Shapefile : .zip, ou fichiers séparés .shp + .dbf (+ .prj + .cpg) sélectionnés ensemble
//   - GeoJSON (.geojson / .json)
// Seuls les polygones sont gardés ; tous les attributs d'origine sont conservés.
import area from '@turf/area'
import { kml } from '@tmcw/togeojson'
import shp from 'shpjs'
import type { LegacyFeaturePayload } from '../api/legacy'

export interface LegacyParseResult {
  sourceName: string
  features: LegacyFeaturePayload[]
  skipped: number // entités non polygonales (points, lignes) ignorées
  warning?: string // ex. Shapefile sans .dbf : pas de table attributaire (donc pas de code producteur)
}

export const LEGACY_ACCEPT = '.kml,.kmz,.gpkg,.zip,.shp,.dbf,.prj,.cpg,.shx,.geojson,.json'

const NAME_KEYS = ['name', 'nom', 'field_id', 'fieldid', 'code', 'id_parcel', 'parcelle', 'producteur', 'nom_prod', 'id']
// Attributs de style ajoutés par Google Earth / togeojson : sans intérêt pour la coopérative
const STYLE_KEYS = new Set(['styleUrl', 'styleHash', 'styleMapHash', 'stroke', 'stroke-opacity', 'stroke-width',
  'fill', 'fill-opacity', 'visibility', 'icon', 'icon-scale', 'icon-color', 'label-scale', 'label-color'])

function pickName(props: Record<string, unknown>, fallback: string): string {
  const lower = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.toLowerCase().trim(), v]))
  for (const k of NAME_KEYS) {
    const v = lower[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim()
  }
  return fallback
}

// Supprime Z/M et arrondit à 7 décimales (~1 cm) pour alléger le stockage
function clean(coords: unknown): unknown {
  if (typeof (coords as number[])[0] === 'number') {
    const [x, y] = coords as number[]
    return [Math.round(x * 1e7) / 1e7, Math.round(y * 1e7) / 1e7]
  }
  return (coords as unknown[]).map(clean)
}

// Extrait les polygones d'une géométrie (y compris dans une GeometryCollection KML)
function polygonsOf(geom: GeoJSON.Geometry | null): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (!geom) return null
  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    return { type: geom.type, coordinates: clean(geom.coordinates) } as GeoJSON.Polygon | GeoJSON.MultiPolygon
  }
  if (geom.type === 'GeometryCollection') {
    const parts: GeoJSON.Position[][][] = []
    for (const g of geom.geometries) {
      const p = polygonsOf(g)
      if (p?.type === 'Polygon') parts.push(p.coordinates)
      else if (p?.type === 'MultiPolygon') parts.push(...p.coordinates)
    }
    if (parts.length === 1) return { type: 'Polygon', coordinates: parts[0] }
    if (parts.length > 1) return { type: 'MultiPolygon', coordinates: parts }
  }
  return null
}

function assertWgs84(features: LegacyFeaturePayload[]) {
  const first = features[0]?.geometry
  if (!first) return
  const ring = first.type === 'Polygon' ? first.coordinates[0] : first.coordinates[0]?.[0]
  const [x, y] = ring?.[0] ?? [0, 0]
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    throw new Error(
      "Les coordonnées ne sont pas en degrés (projection inconnue). Pour un Shapefile, joignez le fichier .prj ; sinon réexportez la couche en WGS84 (EPSG:4326).",
    )
  }
}

function fromGeoJSON(
  items: { geometry: GeoJSON.Geometry | null; properties: Record<string, unknown> | null; layer?: string }[],
  sourceName: string,
): LegacyParseResult {
  const features: LegacyFeaturePayload[] = []
  let skipped = 0
  items.forEach((item, i) => {
    const geometry = polygonsOf(item.geometry)
    if (!geometry) { skipped++; return }
    const properties: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(item.properties ?? {})) {
      if (STYLE_KEYS.has(k) || v === undefined) continue
      properties[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v
    }
    if (item.layer) properties._couche = item.layer
    let areaHa: number | null = null
    try { areaHa = Math.round((area(geometry) / 10000) * 10000) / 10000 } catch { /* géométrie invalide */ }
    features.push({ name: pickName(properties, `Polygone ${i + 1}`), geometry, properties, area_hectares: areaHa })
  })
  assertWgs84(features)
  return { sourceName, features, skipped }
}

function collectionItems(fc: unknown, layer?: string) {
  const obj = fc as GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry
  if (obj?.type === 'FeatureCollection') {
    return obj.features.map((f) => ({ geometry: f.geometry, properties: (f.properties ?? {}) as Record<string, unknown>, layer }))
  }
  if (obj?.type === 'Feature') {
    return [{ geometry: obj.geometry, properties: (obj.properties ?? {}) as Record<string, unknown>, layer }]
  }
  return obj?.type ? [{ geometry: obj as GeoJSON.Geometry, properties: {}, layer }] : []
}

function kmlItems(text: string) {
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Fichier KML illisible.')
  return collectionItems(kml(doc))
}

/**
 * Lit un ou plusieurs fichiers d'anciens polygones.
 * Plusieurs fichiers = les composants d'un même Shapefile (.shp, .dbf, .prj, .cpg).
 */
export async function parseLegacyFiles(files: File[]): Promise<LegacyParseResult> {
  if (!files.length) throw new Error('Aucun fichier sélectionné.')
  const ext = (f: File) => f.name.toLowerCase().split('.').pop() || ''
  const byExt = (e: string) => files.find((f) => ext(f) === e)

  // Shapefile en fichiers séparés
  const shpFile = byExt('shp')
  if (shpFile) {
    const dbf = byExt('dbf'); const prj = byExt('prj'); const cpg = byExt('cpg')
    const fc = await shp({
      shp: await shpFile.arrayBuffer(),
      dbf: dbf ? await dbf.arrayBuffer() : undefined,
      prj: prj ? await prj.text() : undefined,
      cpg: cpg ? await cpg.text() : undefined,
    } as never)
    const res = fromGeoJSON(collectionItems(fc), shpFile.name)
    if (!dbf) res.warning = `Le fichier ${shpFile.name.replace(/\.shp$/i, '.dbf')} n'a pas été sélectionné : la table attributaire (codes producteurs, noms…) est absente. Sélectionnez ensemble les fichiers .shp, .dbf et .prj (ou un .zip qui les contient).`
    if (!prj) res.warning = `${res.warning ? res.warning + ' ' : ''}Sans le fichier .prj, les coordonnées sont supposées en WGS 84 (degrés).`
    return res
  }

  const file = files[0]
  switch (ext(file)) {
    case 'kml':
      return fromGeoJSON(kmlItems(await file.text()), file.name)

    case 'kmz': {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      const kmlEntries = Object.values(zip.files).filter((f) => !f.dir && f.name.toLowerCase().endsWith('.kml'))
      if (!kmlEntries.length) throw new Error('Aucun fichier KML dans ce KMZ.')
      const items = []
      for (const entry of kmlEntries) items.push(...kmlItems(await entry.async('text')))
      return fromGeoJSON(items, file.name)
    }

    case 'gpkg': {
      const { readGeoPackage } = await import('./gpkg')
      const feats = await readGeoPackage(await file.arrayBuffer())
      const multiLayer = new Set(feats.map((f) => f.layer)).size > 1
      return fromGeoJSON(
        feats.map((f) => ({ geometry: f.geometry, properties: f.properties, layer: multiLayer ? f.layer : undefined })),
        file.name,
      )
    }

    case 'zip': {
      const result = await shp(await file.arrayBuffer())
      const collections = Array.isArray(result) ? result : [result]
      const multi = collections.length > 1
      const items = collections.flatMap((fc) =>
        collectionItems(fc, multi ? (fc as { fileName?: string }).fileName : undefined))
      return fromGeoJSON(items, file.name)
    }

    case 'geojson':
    case 'json':
      return fromGeoJSON(collectionItems(JSON.parse(await file.text())), file.name)

    default:
      throw new Error(`Format non pris en charge : .${ext(file)}. Utilisez KML, KMZ, GeoPackage, Shapefile ou GeoJSON.`)
  }
}
