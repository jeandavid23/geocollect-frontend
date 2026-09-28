import { useMemo } from 'react'
import { GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import type { LegacyParcel } from '../../types'

// Anciens polygones : violet, contour en pointillé, pour les distinguer des parcelles
// mappées par les agents (vert / orange / rouge selon le statut EUDR).
export const LEGACY_COLOR = '#7c3aed'

const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function popupHtml(p: LegacyParcel, coopName?: string): string {
  const rows = Object.entries(p.properties)
    .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
    .slice(0, 25)
    .map(([k, v]) => `<tr><td style="color:#6b7280;padding-right:8px">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('')
  return `
    <div style="min-width:180px;font-size:12px">
      <p style="font-weight:700;margin:0">${escapeHtml(p.name)}</p>
      <p style="color:${LEGACY_COLOR};margin:2px 0 6px">Ancien polygone${p.areaHectares != null ? ` · ${p.areaHectares.toFixed(2)} ha` : ''}</p>
      ${coopName ? `<p style="color:#6b7280;margin:0 0 4px">${escapeHtml(coopName)}</p>` : ''}
      <p style="color:#9ca3af;margin:0 0 6px">Fichier : ${escapeHtml(p.sourceFile || '—')}</p>
      ${rows ? `<div style="max-height:160px;overflow:auto"><table>${rows}</table></div>` : ''}
    </div>`
}

interface Props {
  parcels: LegacyParcel[]
  // Nom de la coopérative (vue admin, plusieurs coopératives sur la même carte)
  coopName?: (cooperativeId: string) => string | undefined
  // false : les clics traversent la couche (page de mapping, pour poser des sommets par-dessus)
  interactive?: boolean
}

export default function LegacyParcelsLayer({ parcels, coopName, interactive = true }: Props) {
  // Rendu canvas : reste fluide avec plusieurs milliers de polygones
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), [])

  const data = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: parcels.map((p) => ({ type: 'Feature', id: p.id, geometry: p.geometry, properties: { id: p.id } })),
  }), [parcels])

  const byId = useMemo(() => new Map(parcels.map((p) => [p.id, p])), [parcels])

  if (!parcels.length) return null
  return (
    <GeoJSON
      // la couche Leaflet ne se redessine pas seule quand les données changent
      key={`${parcels.length}-${parcels[0]?.id}-${parcels[parcels.length - 1]?.id}-${interactive}`}
      data={data}
      style={() => ({ color: LEGACY_COLOR, weight: 2, dashArray: '6 4', fillColor: LEGACY_COLOR, fillOpacity: 0.12, interactive })}
      onEachFeature={(feature, layer) => {
        if (!interactive) return
        const p = byId.get(String(feature.properties?.id))
        // contenu construit à l'ouverture : 10 000 polygones sans générer 10 000 fiches d'avance
        if (p) layer.bindPopup(() => popupHtml(p, coopName?.(p.cooperativeId)))
      }}
      // options transmises à chaque polygone à sa création (`interactive` n'est pas modifiable ensuite)
      {...({ renderer, interactive } as object)}
    />
  )
}

/** Légende commune : anciens polygones + parcelles mappées. */
export function MapLegend({ legacyCount, mappedCount }: { legacyCount: number; mappedCount: number }) {
  return (
    <div className="absolute bottom-4 left-4 z-[500] bg-white/95 rounded-xl shadow border border-gray-100 px-3 py-2 text-xs space-y-1">
      <p className="flex items-center gap-2">
        <span className="w-4 h-3 rounded-sm border-2 border-dashed" style={{ borderColor: LEGACY_COLOR, background: `${LEGACY_COLOR}22` }} />
        Anciens polygones ({legacyCount})
      </p>
      <p className="flex items-center gap-2">
        <span className="w-4 h-3 rounded-sm border-2 border-green-700 bg-green-600/40" />
        Parcelles mappées ({mappedCount})
      </p>
    </div>
  )
}
