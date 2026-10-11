import { useEffect, useMemo } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'

/** Catégories foncières de référence (RDUE Côte d'Ivoire) : couleur, libellé, ordre d'affichage (enclaves au-dessus). */
export const ZONE_STYLE: Record<string, { color: string; fill: string; label: string; one: string; order: number }> = {
  'Foret classee': { color: '#b91c1c', fill: '#ef4444', label: 'Forêts classées', one: 'Forêt classée', order: 0 },
  'Parc/reserve': { color: '#7f1d1d', fill: '#991b1b', label: 'Parcs / réserves', one: 'Parc / réserve', order: 1 },
  'Agro-foret classee': { color: '#a16207', fill: '#ca8a04', label: 'Agro-forêts classées', one: 'Agro-forêt classée', order: 2 },
  Enclave: { color: '#a16207', fill: '#facc15', label: 'Enclaves', one: 'Enclave', order: 3 },
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** Forêts classées, parcs, agro-forêts et enclaves : une couche par catégorie visible, enclaves dessinées par-dessus. */
export default function LandZonesLayer({ data, visible }: { data: GeoJSON.FeatureCollection; visible: Set<string> }) {
  const groups = useMemo(() => {
    const by = new Map<string, GeoJSON.Feature[]>()
    for (const f of data.features) {
      const c = String(f.properties?.category ?? '')
      by.set(c, [...(by.get(c) ?? []), f])
    }
    return [...by.entries()].sort((a, b) => (ZONE_STYLE[a[0]]?.order ?? 9) - (ZONE_STYLE[b[0]]?.order ?? 9))
  }, [data])

  return (
    <>
      {groups.filter(([cat]) => visible.has(cat)).map(([cat, feats]) => {
        const st = ZONE_STYLE[cat] ?? { color: '#6b7280', fill: '#9ca3af', label: cat, one: cat, order: 9 }
        return (
          <GeoJSON key={cat} data={{ type: 'FeatureCollection', features: feats } as GeoJSON.FeatureCollection}
            style={() => ({ color: st.color, weight: cat === 'Enclave' ? 1.8 : 1.4, fillColor: st.fill, fillOpacity: cat === 'Enclave' ? 0.28 : 0.13, dashArray: cat === 'Enclave' ? undefined : '5 4' })}
            onEachFeature={(f, layer) => {
              const p = f.properties ?? {}
              layer.bindTooltip(`<b>${esc(p.name || st.label)}</b><br/><span style="color:${st.color}">${esc(st.one)}</span>${p.region ? ` · ${esc(p.region)}` : ''}`, { sticky: true })
              layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 3, fillOpacity: cat === 'Enclave' ? 0.45 : 0.25 }))
              layer.on('mouseout', () => (layer as L.Path).setStyle({ weight: cat === 'Enclave' ? 1.8 : 1.4, fillOpacity: cat === 'Enclave' ? 0.28 : 0.13 }))
            }} />
        )
      })}
    </>
  )
}

/** Centre la carte sur une zone choisie dans la liste. */
export function FlyToZone({ feature }: { feature: GeoJSON.Feature | null }) {
  const map = useMap()
  useEffect(() => {
    if (!feature) return
    try { map.flyToBounds(L.geoJSON(feature).getBounds(), { padding: [30, 30], maxZoom: 14, duration: 0.8 }) } catch { /* géométrie vide */ }
  }, [feature, map])
  return null
}
