/**
 * Polygones de la coopérative à télécharger : parcelles cartographiées par les agents et anciens polygones importés,
 * avec le code producteur et le code parcelle du registre (noms de champs ≤ 10 caractères pour le Shapefile).
 */
import type { LegacyParcel, Parcel, Producer } from '../types'
import { exportGeoJSON, exportKML, exportShapefile, type OutFeature } from './featureExport'

export type PolygonFormat = 'geojson' | 'kml' | 'shp'
export const POLYGON_FORMATS: { key: PolygonFormat; label: string }[] = [
  { key: 'geojson', label: 'GeoJSON' }, { key: 'kml', label: 'KML (Google Earth)' }, { key: 'shp', label: 'Shapefile (.zip)' },
]
const EUDR = { compliant: 'conforme', non_compliant: 'non conforme', pending: 'en attente' } as const

export function coopPolygons(producers: Producer[], parcels: Parcel[], legacy: LegacyParcel[]): OutFeature[] {
  const byId = new Map(producers.map((p) => [p.id, p]))
  const mapped = parcels.map((pa) => {
    const p = byId.get(pa.producerId)
    return { geometry: pa.geometry as GeoJSON.Geometry, properties: {
      code_prod: p?.fieldIdBase ?? '', code_parc: pa.fieldId, producteur: p?.fullName ?? '', village: p?.village ?? '',
      surface_ha: Math.round((pa.areaHectares || 0) * 10000) / 10000, origine: 'cartographiee',
      statut: pa.eudrStatus ? EUDR[pa.eudrStatus] : '', fichier: '' } }
  })
  const imported = legacy.map((lp) => {
    const p = lp.producerId ? byId.get(lp.producerId) : undefined
    return { geometry: lp.geometry as GeoJSON.Geometry, properties: {
      code_prod: p?.fieldIdBase ?? lp.code ?? '', code_parc: lp.parcelCode || '', producteur: p?.fullName ?? '',
      village: p?.village ?? '', surface_ha: lp.areaHectares != null ? Math.round(lp.areaHectares * 10000) / 10000 : '',
      origine: 'ancien polygone', statut: p ? 'rattache' : 'non rattache', fichier: lp.sourceFile } }
  })
  return [...mapped, ...imported]
}

export async function downloadPolygons(features: OutFeature[], format: PolygonFormat, name: string) {
  const base = `polygones_${name.replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}`
  if (format === 'geojson') exportGeoJSON(features, `${base}.geojson`)
  else if (format === 'kml') exportKML(features, `${base}.kml`, 'code_parc')
  else await exportShapefile(features, `${base}.zip`, 'polygones')
}
