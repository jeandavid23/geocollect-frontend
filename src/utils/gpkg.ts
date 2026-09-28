// Lecture d'un GeoPackage (.gpkg) dans le navigateur.
// Un GeoPackage est une base SQLite : on l'ouvre avec sql.js (WebAssembly), on décode
// les géométries (en-tête GPKG + WKB) puis on les reprojette en WGS84 avec proj4.
import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
import proj4 from 'proj4'

export interface GpkgFeature {
  layer: string
  geometry: GeoJSON.Geometry
  properties: Record<string, unknown>
}

// ─── WKB ────────────────────────────────────────────────────────────────────

class WkbReader {
  private view: DataView
  private pos: number
  private little = true

  constructor(bytes: Uint8Array, offset: number) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.pos = offset
  }

  private u32() { const v = this.view.getUint32(this.pos, this.little); this.pos += 4; return v }
  private f64() { const v = this.view.getFloat64(this.pos, this.little); this.pos += 8; return v }

  read(): GeoJSON.Geometry {
    this.little = this.view.getUint8(this.pos) === 1
    this.pos += 1
    let type = this.u32()
    let dims = 2
    // EWKB (PostGIS) : drapeaux dans les bits de poids fort
    if (type & 0x20000000) this.pos += 4 // SRID
    if (type & 0x80000000) dims++
    if (type & 0x40000000) dims++
    type &= 0x0fffffff
    // WKB ISO : 1001 = Point Z, 2001 = Point M, 3001 = Point ZM
    if (type > 1000) {
      const flavour = Math.floor(type / 1000)
      dims = flavour === 3 ? 4 : 3
      type %= 1000
    }
    const point = (): number[] => {
      const x = this.f64(); const y = this.f64()
      for (let i = 2; i < dims; i++) this.f64() // Z / M ignorés
      return [x, y]
    }
    const line = () => Array.from({ length: this.u32() }, point)
    const poly = () => Array.from({ length: this.u32() }, line)
    const many = () => Array.from({ length: this.u32() }, () => this.read())

    switch (type) {
      case 1: return { type: 'Point', coordinates: point() }
      case 2: return { type: 'LineString', coordinates: line() }
      case 3: return { type: 'Polygon', coordinates: poly() }
      case 4: return { type: 'MultiPoint', coordinates: many().map((g) => (g as GeoJSON.Point).coordinates) }
      case 5: return { type: 'MultiLineString', coordinates: many().map((g) => (g as GeoJSON.LineString).coordinates) }
      case 6: return { type: 'MultiPolygon', coordinates: many().map((g) => (g as GeoJSON.Polygon).coordinates) }
      case 7: return { type: 'GeometryCollection', geometries: many() }
      default: throw new Error(`Type de géométrie WKB non pris en charge (${type}).`)
    }
  }
}

// En-tête GPKG : « GP », version, drapeaux, srs_id, enveloppe, puis le WKB
function decodeGpkgGeometry(blob: Uint8Array): GeoJSON.Geometry | null {
  if (blob.length < 8 || blob[0] !== 0x47 || blob[1] !== 0x50) return null
  const flags = blob[3]
  if (flags & 0x10) return null // géométrie vide
  const envelope = [0, 32, 48, 48, 64][(flags >> 1) & 0x07] ?? 0
  return new WkbReader(blob, 8 + envelope).read()
}

// ─── Reprojection ───────────────────────────────────────────────────────────

type Transform = (xy: number[]) => number[]

function transformFor(srs: { organization?: string; code?: number; definition?: string } | undefined): Transform {
  const identity: Transform = (xy) => xy
  if (!srs) return identity
  const org = (srs.organization || '').toUpperCase()
  const code = srs.code ?? 0
  if (org === 'EPSG' && (code === 4326 || code === 4979 || code === 4258)) return identity
  // UTM WGS84 (Côte d'Ivoire : 32629 / 32630 / 32631)
  let def: string | undefined
  if (org === 'EPSG' && code >= 32601 && code <= 32760) {
    const zone = code % 100
    def = `+proj=utm +zone=${zone}${code >= 32701 ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`
  } else if (srs.definition && srs.definition !== 'undefined') {
    def = srs.definition
  }
  if (!def) return identity
  try {
    const conv = proj4(def, 'EPSG:4326')
    return (xy) => conv.forward(xy)
  } catch {
    throw new Error(`Système de coordonnées non reconnu (${org}:${code}). Réexportez la couche en WGS84 (EPSG:4326).`)
  }
}

function reproject(geom: GeoJSON.Geometry, t: Transform): GeoJSON.Geometry {
  const map = (c: unknown): unknown =>
    typeof (c as number[])[0] === 'number' ? t(c as number[]) : (c as unknown[]).map(map)
  if (geom.type === 'GeometryCollection') {
    return { type: 'GeometryCollection', geometries: geom.geometries.map((g) => reproject(g, t)) }
  }
  return { ...geom, coordinates: map(geom.coordinates) } as GeoJSON.Geometry
}

// ─── Lecture ────────────────────────────────────────────────────────────────

export async function readGeoPackage(buffer: ArrayBuffer): Promise<GpkgFeature[]> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const db = new SQL.Database(new Uint8Array(buffer))
  try {
    const rows = <T,>(sql: string): T[] => {
      const res = db.exec(sql)
      if (!res.length) return []
      const { columns, values } = res[0]
      return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i]])) as T)
    }

    let layers: { table_name: string; column_name: string; srs_id: number }[]
    try {
      layers = rows('SELECT table_name, column_name, srs_id FROM gpkg_geometry_columns')
    } catch {
      throw new Error("Ce fichier n'est pas un GeoPackage valide (table gpkg_geometry_columns absente).")
    }
    const srsList = rows<{ srs_id: number; organization: string; organization_coordsys_id: number; definition: string }>(
      'SELECT srs_id, organization, organization_coordsys_id, definition FROM gpkg_spatial_ref_sys',
    )

    const out: GpkgFeature[] = []
    for (const layer of layers) {
      const srs = srsList.find((s) => s.srs_id === layer.srs_id)
      const t = transformFor(srs && { organization: srs.organization, code: srs.organization_coordsys_id, definition: srs.definition })
      const table = layer.table_name.replace(/"/g, '""')
      for (const row of rows<Record<string, unknown>>(`SELECT * FROM "${table}"`)) {
        const blob = row[layer.column_name]
        if (!(blob instanceof Uint8Array)) continue
        const geom = decodeGpkgGeometry(blob)
        if (!geom) continue
        const properties: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) {
          if (k === layer.column_name || v instanceof Uint8Array) continue
          properties[k] = v
        }
        out.push({ layer: layer.table_name, geometry: reproject(geom, t), properties })
      }
    }
    return out
  } finally {
    db.close()
  }
}
