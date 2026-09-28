import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

/**
 * Cadre la carte sur les géométries dès qu'elles arrivent (une seule fois),
 * pour qu'une coopérative située hors de la zone par défaut voie ses polygones.
 */
export default function FitToData({ geometries }: { geometries: GeoJSON.Geometry[] }) {
  const map = useMap()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !geometries.length) return
    try {
      const bounds = L.geoJSON({
        type: 'FeatureCollection',
        features: geometries.map((geometry) => ({ type: 'Feature', geometry, properties: {} })),
      } as GeoJSON.FeatureCollection).getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
        done.current = true
      }
    } catch { /* géométrie invalide : on garde la vue par défaut */ }
  }, [geometries, map])

  return null
}
