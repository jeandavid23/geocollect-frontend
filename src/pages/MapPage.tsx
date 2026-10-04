import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Polygon, Popup, LayersControl, useMap } from 'react-leaflet'
import { Search, Filter, X, Layers, Eye, EyeOff } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useLivePolling } from '../hooks/useLivePolling'
import Header from '../components/layout/Header'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { useHasModule } from '../utils/modules'
import type { Parcel } from '../types'
import LegacyParcelsLayer, { MapLegend, LEGACY_COLOR } from '../components/map/LegacyParcelsLayer'
import LegacyImportModal from '../components/map/LegacyImportModal'
import FitToData from '../components/map/FitToData'
import GisWorkspace from '../components/gis/GisWorkspace'

const { BaseLayer } = LayersControl

const EUDR_COLORS = {
  compliant: { fill: '#16a34a', stroke: '#15803d' },
  non_compliant: { fill: '#dc2626', stroke: '#b91c1c' },
  pending: { fill: '#f59e0b', stroke: '#d97706' },
}

function MapAutoCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  map.setView([lat, lng], 13)
  return null
}

export default function MapPage() {
  useLivePolling()
  const { parcels, producers, legacyParcels, cooperatives } = useAppStore()
  const role = useAuthStore((s) => s.user?.role)
  const hasLegacy = useHasModule('legacy')
  const isAdmin = role === 'super_admin' || role === 'owner'
  // Super admin : toutes les coopératives, ou une seule
  const [filterCoop, setFilterCoop] = useState('all')
  const [showLegacy, setShowLegacy] = useState(true)
  const [showLegacyImport, setShowLegacyImport] = useState(false)
  const coopName = (id: string) => cooperatives.find((c) => c.id === id)?.name
  const legacy = useMemo(
    () => legacyParcels.filter((p) => filterCoop === 'all' || p.cooperativeId === filterCoop),
    [legacyParcels, filterCoop],
  )
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number } | null>(null)
  // Outils SIG (édition type QGIS) : coopérative, super admin et propriétaire (pas les agents)
  const canGis = role === 'cooperative' || isAdmin
  const [mode, setMode] = useState<'view' | 'gis'>('view')

  const filtered = useMemo(() => {
    return parcels.filter((p) => {
      const matchStatus = filterStatus === 'all' || p.eudrStatus === filterStatus
      const matchCoop = filterCoop === 'all' || p.cooperativeId === filterCoop
      if (!matchCoop) return false
      const matchSearch =
        !search ||
        p.fieldId.toLowerCase().includes(search.toLowerCase()) ||
        p.village.toLowerCase().includes(search.toLowerCase()) ||
        p.section.toLowerCase().includes(search.toLowerCase()) ||
        producers.find((pr) => pr.id === p.producerId)?.fullName.toLowerCase().includes(search.toLowerCase())
      return matchStatus && matchSearch
    })
  }, [parcels, producers, search, filterStatus, filterCoop])

  const centerLat = 7.67
  const centerLng = -5.68

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 pt-6 pb-0">
        <Header title="Carte Interactive" subtitle={mode === 'gis' ? 'Outils SIG : sélection, table attributaire, édition des polygones, mesures' : 'Vue cartographique de toutes les parcelles'} />
        {canGis && (
          <div className="inline-flex mt-3 rounded-xl bg-gray-100 p-1 text-sm">
            <button onClick={() => setMode('view')} className={`px-4 py-1.5 rounded-lg font-medium ${mode === 'view' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>Consultation</button>
            <button onClick={() => setMode('gis')} className={`px-4 py-1.5 rounded-lg font-medium ${mode === 'gis' ? 'bg-white shadow text-primary-700' : 'text-gray-500'}`}>Outils SIG (édition)</button>
          </div>
        )}
      </div>
      {mode === 'gis' ? <div className="flex-1 min-h-0 mt-3"><GisWorkspace /></div> : (<>

      {/* Toolbar */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher FIELD ID, village, producteur..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {[
            { value: 'all', label: 'Toutes' },
            { value: 'compliant', label: '🟢 Conformes' },
            { value: 'non_compliant', label: '🔴 Non conformes' },
            { value: 'pending', label: '🟡 En attente' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterStatus === f.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isAdmin && (
          <select value={filterCoop} onChange={(e) => setFilterCoop(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none">
            <option value="all">Toutes les coopératives</option>
            {cooperatives.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <button
          onClick={() => setShowLegacy((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 hover:bg-gray-50"
          style={{ color: LEGACY_COLOR }}
        >
          {showLegacy ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          Anciens polygones ({legacy.length})
        </button>
        {hasLegacy && (role === 'cooperative' || (isAdmin && filterCoop !== 'all')) && (
          <button
            onClick={() => setShowLegacyImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white hover:opacity-90"
            style={{ background: LEGACY_COLOR }}
          >
            <Layers className="w-3.5 h-3.5" /> Importer
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto">{filtered.length} parcelle(s)</span>
      </div>

      {/* Map */}
      <div className="flex-1 px-6 pb-6">
        <div className="relative h-full rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={12}
            className="h-full w-full"
          >
            <FitToData geometries={[...filtered.map((p) => p.geometry), ...legacy.map((p) => p.geometry)]} />
            {showLegacy && <LegacyParcelsLayer parcels={legacy} coopName={isAdmin ? coopName : undefined} />}
            {centerOn && <MapAutoCenter lat={centerOn.lat} lng={centerOn.lng} />}

            <LayersControl position="topright">
              <BaseLayer checked name="OpenStreetMap">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
              </BaseLayer>
              <BaseLayer name="Satellite Google">
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                  attribution="&copy; Google"
                />
              </BaseLayer>
              <BaseLayer name="Hybride Google">
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  attribution="&copy; Google"
                />
              </BaseLayer>
              <BaseLayer name="Terrain Google">
                <TileLayer
                  url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
                  attribution="&copy; Google"
                />
              </BaseLayer>
            </LayersControl>

            {filtered.map((parcel) => {
              const coords = parcel.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
              const colors = EUDR_COLORS[parcel.eudrStatus ?? 'pending']
              const producer = producers.find((p) => p.id === parcel.producerId)

              return (
                <Polygon
                  key={parcel.id}
                  positions={coords}
                  pathOptions={{
                    color: colors.stroke,
                    fillColor: colors.fill,
                    fillOpacity: selectedParcel?.id === parcel.id ? 0.7 : 0.4,
                    weight: selectedParcel?.id === parcel.id ? 3 : 2,
                  }}
                  eventHandlers={{
                    click: () => {
                      setSelectedParcel(parcel)
                      const center = coords[Math.floor(coords.length / 2)]
                      setCenterOn({ lat: center[0], lng: center[1] })
                    },
                  }}
                >
                  <Popup>
                    <div className="min-w-48">
                      <p className="font-bold text-gray-800 text-sm font-mono">{parcel.fieldId}</p>
                      <p className="text-xs text-gray-500 mt-1">{producer?.fullName}</p>
                      <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                        <p>📍 {parcel.village} · {parcel.section}</p>
                        <p>🌿 {parcel.culture}</p>
                        <p>📐 {parcel.areaHectares.toFixed(2)} ha</p>
                      </div>
                      <div className={`mt-2 text-xs font-semibold px-2 py-1 rounded-lg ${
                        parcel.eudrStatus === 'compliant' ? 'bg-green-100 text-green-700' :
                        parcel.eudrStatus === 'non_compliant' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {parcel.eudrStatus === 'compliant' ? '✅ Conforme EUDR' :
                         parcel.eudrStatus === 'non_compliant' ? '❌ Non conforme' :
                         '⏳ En attente'} · {parcel.eudrScore ?? '—'}%
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              )
            })}
          </MapContainer>
          <MapLegend legacyCount={showLegacy ? legacy.length : 0} mappedCount={filtered.length} />
        </div>
      </div>
      {showLegacyImport && (
        <LegacyImportModal
          onClose={() => setShowLegacyImport(false)}
          cooperativeId={isAdmin ? filterCoop : undefined}
        />
      )}

      {/* Selected parcel panel */}
      {selectedParcel && (
        <div className="fixed bottom-6 right-6 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-[1000]">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-bold text-gray-800 font-mono text-sm">{selectedParcel.fieldId}</p>
              <p className="text-xs text-gray-500">
                {producers.find((p) => p.id === selectedParcel.producerId)?.fullName}
              </p>
            </div>
            <button onClick={() => setSelectedParcel(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Superficie', value: `${selectedParcel.areaHectares.toFixed(2)} ha` },
              { label: 'Périmètre', value: `${selectedParcel.perimeterMeters} m` },
              { label: 'Village', value: selectedParcel.village },
              { label: 'Section', value: selectedParcel.section },
              { label: 'Culture', value: selectedParcel.culture },
              { label: 'Score EUDR', value: `${selectedParcel.eudrScore ?? '—'}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400">{label}</p>
                <p className="font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
          <span className={`mt-3 block text-center text-xs font-semibold py-2 rounded-xl ${
            selectedParcel.eudrStatus === 'compliant' ? 'bg-green-100 text-green-700' :
            selectedParcel.eudrStatus === 'non_compliant' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {selectedParcel.eudrStatus === 'compliant' ? '🟢 Conforme EUDR' :
             selectedParcel.eudrStatus === 'non_compliant' ? '🔴 Non conforme EUDR' :
             '🟡 En attente de validation'}
          </span>
        </div>
      )}
      </>)}
    </div>
  )
}
