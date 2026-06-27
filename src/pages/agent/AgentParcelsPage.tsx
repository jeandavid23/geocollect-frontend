import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Polygon, Popup, LayersControl, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { Search, Filter, X, MapPin, Plus, Wifi, WifiOff } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import Header from '../../components/layout/Header'
import { useAppStore } from '../../store/appStore'
import type { Parcel } from '../../types'

const { BaseLayer } = LayersControl

const EUDR_COLORS = {
  compliant: { fill: '#16a34a', stroke: '#15803d' },
  non_compliant: { fill: '#dc2626', stroke: '#b91c1c' },
  pending: { fill: '#f59e0b', stroke: '#d97706' },
}

function MapAutoCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  map.setView([lat, lng], 16)
  return null
}

export default function AgentParcelsPage() {
  const navigate = useNavigate()
  const { parcels, producers } = useAppStore()
  const myParcels = parcels.filter((p) => p.agentId === 'agent-001')

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected] = useState<Parcel | null>(null)
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number } | null>(null)

  const producerName = (id: string) => producers.find((p) => p.id === id)?.fullName ?? '—'

  const filtered = useMemo(() => myParcels.filter((p) => {
    const matchStatus = filterStatus === 'all' || p.eudrStatus === filterStatus
    const matchSearch = !search ||
      p.fieldId.toLowerCase().includes(search.toLowerCase()) ||
      p.village.toLowerCase().includes(search.toLowerCase()) ||
      producerName(p.producerId).toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [myParcels, search, filterStatus])

  const totalHa = myParcels.reduce((s, p) => s + p.areaHectares, 0)

  const focusParcel = (p: Parcel) => {
    setSelected(p)
    const coords = p.geometry.coordinates[0]
    const c = coords[Math.floor(coords.length / 2)]
    setCenterOn({ lat: c[1], lng: c[0] })
  }

  return (
    <div className="p-6 space-y-5">
      <Header title="Mes Parcelles" subtitle={`${myParcels.length} parcelles · ${totalHa.toFixed(2)} ha cartographiés`} />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: myParcels.length, color: 'text-primary-600' },
          { label: 'Conformes', value: myParcels.filter(p => p.eudrStatus === 'compliant').length, color: 'text-green-600' },
          { label: 'Non conformes', value: myParcels.filter(p => p.eudrStatus === 'non_compliant').length, color: 'text-red-600' },
          { label: 'En attente', value: myParcels.filter(p => p.eudrStatus === 'pending').length, color: 'text-yellow-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher FIELD ID, producteur, village..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {[
            { value: 'all', label: 'Toutes' },
            { value: 'compliant', label: '🟢' },
            { value: 'non_compliant', label: '🔴' },
            { value: 'pending', label: '🟡' },
          ].map((f) => (
            <button key={f.value} onClick={() => setFilterStatus(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterStatus === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/agent/mapping')}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Nouvelle parcelle
        </button>
      </div>

      {/* Map */}
      <div className="h-[440px] rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <MapContainer center={[7.67, -5.68]} zoom={13} className="h-full w-full">
          {centerOn && <MapAutoCenter lat={centerOn.lat} lng={centerOn.lng} />}
          <LayersControl position="topright">
            <BaseLayer checked name="Satellite Google">
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" />
            </BaseLayer>
            <BaseLayer name="Hybride Google">
              <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google" />
            </BaseLayer>
            <BaseLayer name="OpenStreetMap">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            </BaseLayer>
          </LayersControl>

          {filtered.map((parcel) => {
            const coords = parcel.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
            const colors = EUDR_COLORS[parcel.eudrStatus ?? 'pending']
            return (
              <Polygon
                key={parcel.id}
                positions={coords}
                pathOptions={{
                  color: colors.stroke, fillColor: colors.fill,
                  fillOpacity: selected?.id === parcel.id ? 0.7 : 0.4,
                  weight: selected?.id === parcel.id ? 3 : 2,
                }}
                eventHandlers={{ click: () => focusParcel(parcel) }}
              >
                <Popup>
                  <div className="min-w-48">
                    <p className="font-bold text-gray-800 text-sm font-mono">{parcel.fieldId}</p>
                    <p className="text-xs text-gray-500 mt-1">👨‍🌾 {producerName(parcel.producerId)}</p>
                    <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                      <p>📍 {parcel.village} · {parcel.section}</p>
                      <p>🌿 {parcel.culture} · 📐 {parcel.areaHectares.toFixed(2)} ha</p>
                    </div>
                    <div className={`mt-2 text-xs font-semibold px-2 py-1 rounded-lg ${
                      parcel.eudrStatus === 'compliant' ? 'bg-green-100 text-green-700' :
                      parcel.eudrStatus === 'non_compliant' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      Score EUDR : {parcel.eudrScore ?? '—'}%
                    </div>
                  </div>
                </Popup>
              </Polygon>
            )
          })}
        </MapContainer>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  p.eudrStatus === 'compliant' ? 'bg-green-500' :
                  p.eudrStatus === 'non_compliant' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-gray-800 font-mono">{p.fieldId}</p>
                  <p className="text-xs text-gray-500">{producerName(p.producerId)} · {p.village} · {p.areaHectares.toFixed(2)} ha</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {p.isSynced ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-orange-400" />}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  p.eudrStatus === 'compliant' ? 'bg-green-100 text-green-700' :
                  p.eudrStatus === 'non_compliant' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {p.eudrScore ?? '—'}%
                </span>
                <button onClick={() => focusParcel(p)} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Voir
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-gray-400">
              Aucune parcelle. Cliquez sur « Nouvelle parcelle » pour démarrer un mapping.
            </p>
          )}
        </div>
      </div>

      {/* Floating panel */}
      {selected && (
        <div className="fixed bottom-6 right-6 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-[1000]">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-bold text-gray-800 font-mono text-sm">{selected.fieldId}</p>
              <p className="text-xs text-gray-500">{producerName(selected.producerId)}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Superficie', value: `${selected.areaHectares.toFixed(2)} ha` },
              { label: 'Périmètre', value: `${selected.perimeterMeters} m` },
              { label: 'Culture', value: selected.culture },
              { label: 'Score EUDR', value: `${selected.eudrScore ?? '—'}%` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400">{label}</p>
                <p className="font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
