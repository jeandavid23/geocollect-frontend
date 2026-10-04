import { useRef, useState } from 'react'
import { Upload, MapPin, Layers, FileCheck2, AlertTriangle } from 'lucide-react'
import area from '@turf/area'
import { parseLegacyFiles, LEGACY_ACCEPT } from '../../utils/legacyImport'
import { parseGeoFile } from '../../utils/geoImport'
import { useAppStore } from '../../store/appStore'
import { LEGACY_COLOR } from './LegacyParcelsLayer'

export type SourceKind = 'file' | 'parcels' | 'legacy'

export interface SourceFeature {
  id: string                             // identifiant affiché (Field_ID, nom…)
  geometry: GeoJSON.Geometry
  properties: Record<string, unknown>
  area_ha: number | null
}

export interface PickedSource {
  kind: SourceKind
  label: string                          // nom du fichier ou de la source
  features: SourceFeature[]
  skipped: number
}

const ID_KEYS = ['field_id', 'fieldid', 'id', 'code', 'code_prod', 'matricule', 'nom', 'name', 'parcelle']

function pickId(props: Record<string, unknown>, fallback: string) {
  const lower = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]))
  for (const k of ID_KEYS) if (lower[k] !== undefined && lower[k] !== null && String(lower[k]).trim()) return String(lower[k]).trim()
  return fallback
}

interface Props {
  allowPoints?: boolean                  // déforestation : Excel de points lon/lat accepté
  onPicked: (s: PickedSource | null) => void
  picked: PickedSource | null
}

/** Choix des polygones à traiter : fichier, parcelles mappées ou anciens polygones de la coopérative. */
export default function PolygonSourcePicker({ allowPoints, onPicked, picked }: Props) {
  const { parcels, legacyParcels, producers, isLoading } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const mapped = parcels.filter((p) => p.geometry?.coordinates?.[0]?.length >= 3)

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (!files.length) return
    setBusy(true); setError('')
    try {
      const ext = files[0].name.toLowerCase().split('.').pop() || ''
      if (allowPoints && ['xlsx', 'xls', 'csv'].includes(ext)) {
        const pts = await parseGeoFile(files[0])
        if (!pts.length) throw new Error('Aucune coordonnée (colonnes latitude / longitude) trouvée dans ce fichier.')
        onPicked({
          kind: 'file', label: files[0].name, skipped: 0,
          features: pts.map((p, i) => ({ id: p.name || `Point ${i + 1}`, geometry: p.geometry, properties: {}, area_ha: p.area_ha })),
        })
      } else {
        const res = await parseLegacyFiles(files)
        if (!res.features.length) throw new Error('Aucun polygone trouvé dans ce fichier.')
        onPicked({
          kind: 'file', label: res.sourceName, skipped: res.skipped,
          features: res.features.map((f, i) => ({
            id: pickId(f.properties, f.name || `Polygone ${i + 1}`),
            geometry: f.geometry, properties: f.properties, area_ha: f.area_hectares,
          })),
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fichier illisible.')
      onPicked(null)
    } finally {
      setBusy(false)
    }
  }

  const pickParcels = () => {
    const byId = new Map(producers.map((p) => [p.id, p]))
    onPicked({
    kind: 'parcels', label: 'Parcelles mappées par les agents', skipped: 0,
    features: mapped.map((p) => ({
      id: p.fieldId, geometry: p.geometry as GeoJSON.Geometry,
      properties: {
        FIELD_ID: p.fieldId, PRODUCTEUR: byId.get(p.producerId)?.fullName ?? '', CODE_PRODUCTEUR: byId.get(p.producerId)?.fieldIdBase ?? '',
        village: p.village, section: p.section, culture: p.culture,
      },
      area_ha: p.areaHectares || null,
    })),
    })
  }

  const pickLegacy = () => onPicked({
    kind: 'legacy', label: 'Anciens polygones de la coopérative', skipped: 0,
    features: legacyParcels.map((p) => ({
      id: p.name || p.id, geometry: p.geometry, properties: p.properties,
      area_ha: p.areaHectares ?? (() => { try { return area(p.geometry) / 10000 } catch { return null } })(),
    })),
  })

  const card = (active: boolean) =>
    `flex-1 min-w-[200px] text-left p-4 rounded-2xl border-2 transition ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-100 bg-white hover:border-primary-200'}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <input ref={inputRef} type="file" multiple
          accept={allowPoints ? `${LEGACY_ACCEPT},.xlsx,.xls,.csv` : LEGACY_ACCEPT} onChange={onFiles} className="hidden" />
        <button onClick={() => inputRef.current?.click()} disabled={busy} className={card(picked?.kind === 'file')}>
          <p className="flex items-center gap-2 font-semibold text-gray-900 text-sm"><Upload className="w-4 h-4 text-green-600" />{busy ? 'Lecture du fichier…' : 'Fichier'}</p>
          <p className="text-xs text-gray-500 mt-1">KML, KMZ, GeoPackage, Shapefile, GeoJSON{allowPoints ? ', Excel de points' : ''}</p>
        </button>
        <button onClick={pickParcels} disabled={!mapped.length} className={`${card(picked?.kind === 'parcels')} disabled:opacity-50`}>
          <p className="flex items-center gap-2 font-semibold text-gray-900 text-sm"><MapPin className="w-4 h-4 text-primary-600" />Parcelles mappées</p>
          <p className="text-xs text-gray-500 mt-1">{isLoading ? 'Chargement…' : `${mapped.length} parcelle(s) des agents`}</p>
        </button>
        <button onClick={pickLegacy} disabled={!legacyParcels.length} className={`${card(picked?.kind === 'legacy')} disabled:opacity-50`}>
          <p className="flex items-center gap-2 font-semibold text-gray-900 text-sm"><Layers className="w-4 h-4" style={{ color: LEGACY_COLOR }} />Anciens polygones</p>
          <p className="text-xs text-gray-500 mt-1">{isLoading ? 'Chargement…' : `${legacyParcels.length} polygone(s) importé(s)`}</p>
        </button>
      </div>
      {error && (
        <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </p>
      )}
      {picked && (
        <p className="flex items-center gap-2 text-sm text-gray-700">
          <FileCheck2 className="w-4 h-4 text-green-600" />
          <b>{picked.label}</b> · {picked.features.length.toLocaleString('fr-FR')} entité(s)
          {picked.skipped > 0 && <span className="text-amber-600">· {picked.skipped} ignorée(s) (ni polygone ni point)</span>}
        </p>
      )}
    </div>
  )
}
