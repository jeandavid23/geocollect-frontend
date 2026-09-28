import { useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import L from 'leaflet'

export interface ResultItem {
  key: string
  geometry: GeoJSON.Geometry
  color: string
  dashed?: boolean
  popup: () => string // construit à l'ouverture seulement (10 000+ polygones)
}

/** Couche de résultats d'analyse : rendu canvas, couleur par entité, fiche au clic. */
export default function ResultsLayer({ items, version }: { items: ResultItem[]; version: string }) {
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), [])
  const byKey = useMemo(() => new Map(items.map((it) => [it.key, it])), [items])
  const data = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: items.map((it) => ({ type: 'Feature', geometry: it.geometry, properties: { key: it.key } })),
  }), [items])

  if (!items.length) return null
  return (
    <GeoJSON
      key={version}
      data={data}
      style={(f) => {
        const it = byKey.get(String(f?.properties?.key))
        const color = it?.color ?? '#6b7280'
        return { color, weight: 1.5, fillColor: color, fillOpacity: 0.35, dashArray: it?.dashed ? '5 4' : undefined }
      }}
      pointToLayer={(f, latlng) => {
        const it = byKey.get(String(f?.properties?.key))
        return L.circleMarker(latlng, { radius: 5, color: it?.color, fillColor: it?.color, fillOpacity: 0.8, renderer })
      }}
      onEachFeature={(f, layer) => {
        const it = byKey.get(String(f.properties?.key))
        if (it) layer.bindPopup(() => it.popup())
      }}
      {...({ renderer } as object)}
    />
  )
}

export const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
