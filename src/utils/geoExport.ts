import * as XLSX from 'xlsx'
import * as shpwrite from '@mapbox/shp-write'
import type { Parcel, Producer } from '../types'

// Build a GeoJSON FeatureCollection from parcels (+ producer name)
export function parcelsToFeatureCollection(parcels: Parcel[], producers: Producer[]) {
  const producerName = (id: string) => producers.find((p) => p.id === id)?.fullName ?? ''
  return {
    type: 'FeatureCollection' as const,
    features: parcels.map((p) => ({
      type: 'Feature' as const,
      properties: {
        fieldId: p.fieldId,
        producteur: producerName(p.producerId),
        village: p.village,
        section: p.section,
        culture: p.culture,
        superficie_ha: p.areaHectares,
        perimetre_m: p.perimeterMeters,
        eudr_score: p.eudrScore ?? null,
        eudr_statut: p.eudrStatus ?? null,
        date: p.createdAt,
      },
      geometry: p.geometry,
    })),
  }
}

// GeoJSON string
export function toGeoJSON(parcels: Parcel[], producers: Producer[]): string {
  return JSON.stringify(parcelsToFeatureCollection(parcels, producers), null, 2)
}

// KML string
export function toKML(parcels: Parcel[], producers: Producer[]): string {
  const producerName = (id: string) => producers.find((p) => p.id === id)?.fullName ?? ''
  const esc = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const placemarks = parcels.map((p) => {
    const ring = p.geometry.coordinates[0]
      .map(([lng, lat]) => `${lng},${lat},0`)
      .join(' ')
    const color =
      p.eudrStatus === 'compliant' ? 'ff16a34a' :
      p.eudrStatus === 'non_compliant' ? 'ff2626dc' : 'ff0ba5e9'
    return `    <Placemark>
      <name>${esc(p.fieldId)}</name>
      <description><![CDATA[
        Producteur: ${producerName(p.producerId)}<br/>
        Village: ${p.village} - ${p.section}<br/>
        Culture: ${p.culture}<br/>
        Superficie: ${p.areaHectares.toFixed(2)} ha<br/>
        Score EUDR: ${p.eudrScore ?? '—'}%
      ]]></description>
      <Style><PolyStyle><color>7f${color.slice(2)}</color></PolyStyle><LineStyle><color>${color}</color><width>2</width></LineStyle></Style>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Parcelles GeoCollect EUDR</name>
${placemarks}
  </Document>
</kml>`
}

// Shapefile (zip Blob)
export async function toShapefileZip(parcels: Parcel[], producers: Producer[]): Promise<Blob> {
  const fc = parcelsToFeatureCollection(parcels, producers)
  const options = {
    outputType: 'blob',
    types: { polygon: 'parcelles_eudr' },
  } as unknown as Parameters<typeof shpwrite.zip>[1]
  return shpwrite.zip(fc as never, options) as unknown as Blob
}

// Producers list (with parcel info) → Excel workbook Blob
export function producersToExcel(producers: Producer[], parcels: Parcel[]): Blob {
  const rows = producers.map((prod) => {
    const prodParcels = parcels.filter((p) => p.producerId === prod.id)
    const totalHa = prodParcels.reduce((s, p) => s + p.areaHectares, 0)
    const compliant = prodParcels.filter((p) => p.eudrStatus === 'compliant').length
    return {
      'FIELD ID Base': prod.fieldIdBase,
      'Nom': prod.lastName,
      'Prénom': prod.firstName,
      'Genre': prod.gender === 'F' ? 'Femme' : 'Homme',
      'Année naissance': prod.birthYear ?? '',
      'Téléphone': prod.phone ?? '',
      'Village': prod.village,
      'Section': prod.section,
      'Région': prod.region,
      'Pays': prod.country,
      'Nb parcelles': prodParcels.length,
      'Superficie totale (ha)': Number(totalHa.toFixed(2)),
      'Parcelles conformes EUDR': compliant,
      'FIELD IDs parcelles': prodParcels.map((p) => p.fieldId).join(' ; '),
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
    { wch: 20 }, { wch: 40 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Producteurs')

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// Detailed parcels list → Excel workbook Blob
export function parcelsToExcel(parcels: Parcel[], producers: Producer[]): Blob {
  const producerName = (id: string) => producers.find((p) => p.id === id)?.fullName ?? ''
  const rows = parcels.map((p) => ({
    'FIELD ID': p.fieldId,
    'Producteur': producerName(p.producerId),
    'Village': p.village,
    'Section': p.section,
    'Culture': p.culture,
    'Superficie (ha)': p.areaHectares,
    'Périmètre (m)': p.perimeterMeters,
    'Nb sommets': p.vertexCount,
    'Score EUDR': p.eudrScore ?? '',
    'Statut EUDR': p.eudrStatus ?? '',
    'Synchronisé': p.isSynced ? 'Oui' : 'Non',
    'Date création': p.createdAt,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Parcelles')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// Trigger a browser download for any Blob or string
export function downloadBlob(content: Blob | string, filename: string, mime = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
