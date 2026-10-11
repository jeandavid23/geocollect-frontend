import { apiErrorMessage } from '../../utils/retry'
import Button from '../../components/ui/Button'
import { useStickyState, useSort, SortTh, SelectionBar } from '../../components/ui/table'
import { queryParam } from '../../utils/query'
import EmptyState from '../../components/ui/EmptyState'
import { confirmDialog } from '../../components/ui/dialog'
import { parcelsApi } from '../../api/parcels'
import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Polygon, Popup, LayersControl, useMap } from 'react-leaflet'
import { Search, Filter, X, MapPin, Layers, Eye, EyeOff , Trash2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useLivePolling } from '../../hooks/useLivePolling'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { useHasModule } from '../../utils/modules'
import { useAppStore } from '../../store/appStore'
import type { Parcel } from '../../types'
import LegacyParcelsLayer, { MapLegend, LEGACY_COLOR } from '../../components/map/LegacyParcelsLayer'
import LegacyImportModal from '../../components/map/LegacyImportModal'
import FitToData from '../../components/map/FitToData'

const { BaseLayer } = LayersControl

const EUDR_COLORS = {
  compliant: { fill: '#16a34a', stroke: '#15803d' },
  non_compliant: { fill: '#dc2626', stroke: '#b91c1c' },
  pending: { fill: '#f59e0b', stroke: '#d97706' },
}

function MapAutoCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  map.setView([lat, lng], 15)
  return null
}

export default function CoopParcelsPage() {
  useLivePolling()
  const user = useAuthStore((s) => s.user)
  const hasLegacy = useHasModule('legacy')
  const { parcels, producers, agents, legacyParcels } = useAppStore()
  const coopId = user?.cooperativeId ?? 'coop-001'
  const [showLegacyImport, setShowLegacyImport] = useState(false)
  const [showLegacy, setShowLegacy] = useState(true)
  const coopLegacy = useMemo(() => legacyParcels.filter((p) => p.cooperativeId === coopId), [legacyParcels, coopId])

  const [search, setSearch] = useState(() => queryParam('q'))   // ?q= : recherche globale (Ctrl+K)
  const [params] = useSearchParams()
  const [filterStatus, setFilterStatus] = useStickyState('parcels:eudr', 'all', ['compliant', 'non_compliant', 'pending'].includes(params.get('eudr') ?? '') ? params.get('eudr') : null)
  const [filterAgent, setFilterAgent] = useStickyState('parcels:agent', 'all')
  const [selected, setSelected] = useState<Parcel | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const removeParcelsNow = async (ids: string[]) => {
    if (!ids.length || !(await confirmDialog({ tone: 'danger', title: `Supprimer ${ids.length} parcelle(s) mappée(s) ?`, message: "Suppression définitive. Le producteur repasse « à mapper » s'il n'a plus aucun polygone.", confirmLabel: 'Supprimer' }))) return
    setDeleting(true)
    try {
      if (useAppStore.getState().isLive) await parcelsApi.bulkDelete(ids)
      useAppStore.getState().removeParcels(ids)
      useAppStore.getState().addNotification({ type: 'success', title: `${ids.length} parcelle(s) supprimée(s)`, message: 'Suppression enregistrée.' })
      setChecked(new Set()); setSelected(null)
    } catch (err) {
      useAppStore.getState().addNotification({ type: 'error', title: 'Suppression impossible', message: apiErrorMessage(err) })
    } finally { setDeleting(false) }
  }
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number } | null>(null)

  const coopParcels = parcels.filter((p) => p.cooperativeId === coopId)
  const coopAgents = agents.filter((a) => a.cooperativeId === coopId)
  const agentName = (id: string) => agents.find((a) => a.id === id)?.fullName ?? '—'
  const producerName = (id: string) => producers.find((p) => p.id === id)?.fullName ?? '—'

  const filtered = useMemo(() => coopParcels.filter((p) => {
    const matchStatus = filterStatus === 'all' || p.eudrStatus === filterStatus
    const matchAgent = filterAgent === 'all' || p.agentId === filterAgent
    const matchSearch = !search ||
      p.fieldId.toLowerCase().includes(search.toLowerCase()) ||
      p.village.toLowerCase().includes(search.toLowerCase()) ||
      producerName(p.producerId).toLowerCase().includes(search.toLowerCase()) ||
      agentName(p.agentId).toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchAgent && matchSearch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [coopParcels, search, filterStatus, filterAgent])
  const EUDR_ORDER: Record<string, number> = { non_compliant: 0, pending: 1, compliant: 2 }
  const { sorted, sort, toggle: toggleSort } = useSort(filtered, {
    field: (p) => p.fieldId, producer: (p) => producerName(p.producerId), agent: (p) => agentName(p.agentId), village: (p) => p.village,
    culture: (p) => p.culture, area: (p) => p.areaHectares, eudr: (p) => EUDR_ORDER[p.eudrStatus ?? 'pending'],
  }, 'parcels')

  const focusParcel = (p: Parcel) => {
    setSelected(p)
    const coords = p.geometry.coordinates[0]
    const c = coords[Math.floor(coords.length / 2)]
    setCenterOn({ lat: c[1], lng: c[0] })
  }

  return (
    <div className="p-6 space-y-5">
      <Header title="Parcelles de la coopérative" subtitle={`${coopParcels.length} parcelles cartographiées par ${coopAgents.length} agents · ${coopLegacy.length} anciens polygones`} />

      {/* Anciens polygones (module de l'abonnement) */}
      {hasLegacy && <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowLegacyImport(true)}
          className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition hover:opacity-90"
          style={{ background: LEGACY_COLOR }}
        >
          <Layers className="w-4 h-4" /> Importer les anciens polygones (KML, GPKG, SHP)
        </button>
        {coopLegacy.length > 0 && (
          <button
            onClick={() => setShowLegacy((v) => !v)}
            className="flex items-center gap-2 border border-gray-200 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50"
          >
            {showLegacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showLegacy ? 'Masquer' : 'Afficher'} les anciens polygones
          </button>
        )}
      </div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher FIELD ID, producteur, agent..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none">
          <option value="all">Tous les agents</option>
          {coopAgents.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {[
            { value: 'all', label: 'Toutes' },
            { value: 'compliant', label: 'Conformes' },
            { value: 'non_compliant', label: 'Non conformes' },
            { value: 'pending', label: 'En attente' },
          ].map((f) => (
            <button key={f.value} onClick={() => setFilterStatus(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterStatus === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="relative h-[480px] rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <MapContainer center={[7.67, -5.68]} zoom={13} className="h-full w-full">
          <FitToData geometries={[...coopParcels.map((p) => p.geometry), ...coopLegacy.map((p) => p.geometry)]} />
          {showLegacy && <LegacyParcelsLayer parcels={coopLegacy} />}
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
                    <p className="text-xs text-gray-500 mt-1">Producteur : {producerName(parcel.producerId)}</p>
                    <p className="text-xs text-gray-500">Agent : {agentName(parcel.agentId)}</p>
                    <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                      <p>{parcel.village} · {parcel.section}</p>
                      <p>{parcel.culture} · {parcel.areaHectares.toFixed(2)} ha</p>
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
        <MapLegend legacyCount={showLegacy ? coopLegacy.length : 0} mappedCount={filtered.length} />
      </div>
      {showLegacyImport && <LegacyImportModal onClose={() => setShowLegacyImport(false)} />}

      {/* Table with agent info */}
      <SelectionBar count={checked.size} onClear={() => setChecked(new Set())}>
        <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} loading={deleting} onClick={() => removeParcelsNow([...checked])}>Supprimer</Button>
      </SelectionBar>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-3 py-3"><input type="checkbox" aria-label="Tout sélectionner" checked={filtered.length > 0 && filtered.every((p) => checked.has(p.id))}
                  onChange={(e) => setChecked(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())} /></th>
                <SortTh label="FIELD ID" k="field" sort={sort} onSort={toggleSort} />
                <SortTh label="Producteur" k="producer" sort={sort} onSort={toggleSort} />
                <SortTh label="Agent mappeur" k="agent" sort={sort} onSort={toggleSort} />
                <SortTh label="Village" k="village" sort={sort} onSort={toggleSort} />
                <SortTh label="Culture" k="culture" sort={sort} onSort={toggleSort} />
                <SortTh label="Superficie" k="area" sort={sort} onSort={toggleSort} />
                <SortTh label="EUDR" k="eudr" sort={sort} onSort={toggleSort} />
                <th className="text-left px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 transition ${checked.has(p.id) ? 'bg-primary-50/60' : ''}`}>
                  <td className="px-3 py-3"><input type="checkbox" checked={checked.has(p.id)} onChange={() => setChecked((c) => { const n = new Set(c); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })} /></td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-700">{p.fieldId}</td>
                  <td className="px-5 py-3 text-sm text-gray-700">{producerName(p.producerId)}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{agentName(p.agentId)}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{p.village}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{p.culture}</td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-800">{p.areaHectares.toFixed(2)} ha</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      p.eudrStatus === 'compliant' ? 'bg-green-100 text-green-700' :
                      p.eudrStatus === 'non_compliant' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.eudrScore ?? '—'}%
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => focusParcel(p)} className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> Localiser
                      </button>
                      <button onClick={() => removeParcelsNow([p.id])} disabled={deleting} title="Supprimer la parcelle" className="text-gray-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9}>{coopParcels.length === 0 ? (
                  <EmptyState title="Aucune parcelle mappée pour l'instant"
                    text="Les parcelles apparaissent ici dès que vos agents les relèvent au GPS (application mobile ou site). Vos anciens polygones restent visibles sur la carte."
                    actions={[{ label: 'Producteurs à mapper', to: '/coop/producers?map=todo' }, { label: 'Créer un agent', to: '/coop/agents' }, { label: 'Importer d’anciens polygones', onClick: () => setShowLegacyImport(true) }]} />
                ) : <p className="px-5 py-10 text-center text-sm text-gray-400">Aucune parcelle ne correspond à la recherche ou au filtre.</p>}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected parcel floating panel */}
      {selected && (
        <div className="fixed bottom-6 right-6 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-[1000]">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-bold text-gray-800 font-mono text-sm">{selected.fieldId}</p>
              <p className="text-xs text-gray-500">{producerName(selected.producerId)}</p>
              <p className="text-xs text-gray-400">Agent : {agentName(selected.agentId)}</p>
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
