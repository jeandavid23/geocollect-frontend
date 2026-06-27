import { useState } from 'react'
import { Search, MapPin, Phone, Mail, X, Building2, Activity } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAppStore } from '../../store/appStore'
import type { Agent } from '../../types'

export default function AdminAgentsPage() {
  const { agents, cooperatives, parcels, producers } = useAppStore()
  const [search, setSearch] = useState('')
  const [filterCoop, setFilterCoop] = useState('all')
  const [selected, setSelected] = useState<Agent | null>(null)

  const coopName = (id: string) => cooperatives.find((c) => c.id === id)?.name ?? '—'
  const agentStats = (agentId: string) => {
    const ap = parcels.filter((p) => p.agentId === agentId)
    return {
      parcels: ap.length,
      hectares: ap.reduce((s, p) => s + p.areaHectares, 0),
      producers: producers.filter((p) => p.assignedAgentId === agentId).length,
    }
  }

  const filtered = agents.filter((a) => {
    const matchSearch = !search ||
      a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.zone.toLowerCase().includes(search.toLowerCase())
    const matchCoop = filterCoop === 'all' || a.cooperativeId === filterCoop
    return matchSearch && matchCoop
  })

  return (
    <div className="p-6 space-y-5">
      <Header title="Agents Mappeurs" subtitle={`${agents.length} agents sur la plateforme`} />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher agent, code, zone..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterCoop}
          onChange={(e) => setFilterCoop(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
        >
          <option value="all">Toutes les coopératives</option>
          {cooperatives.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((a) => {
          const st = agentStats(a.id)
          return (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition text-left"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold text-lg">
                  {a.fullName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{a.fullName}</p>
                  <p className="text-xs text-gray-500 font-mono">{a.code}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {a.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-3">
                <Building2 className="w-3.5 h-3.5" /> {coopName(a.cooperativeId)}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{st.parcels}</p>
                  <p className="text-xs text-gray-400">Parcelles</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{st.hectares.toFixed(1)}</p>
                  <p className="text-xs text-gray-400">Hectares</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{st.producers}</p>
                  <p className="text-xs text-gray-400">Producteurs</p>
                </div>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-sm text-gray-400 py-10">Aucun agent trouvé.</p>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-100 z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Fiche Agent</h3>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto bg-primary-100 flex items-center justify-center text-2xl font-black text-primary-700">
                {selected.fullName.charAt(0)}
              </div>
              <p className="font-bold text-gray-900 mt-2">{selected.fullName}</p>
              <p className="text-xs font-mono text-gray-500">{selected.code}</p>
            </div>
            <div className="space-y-2">
              {[
                { icon: <Building2 className="w-4 h-4" />, label: 'Coopérative', value: coopName(selected.cooperativeId) },
                { icon: <MapPin className="w-4 h-4" />, label: 'Zone', value: selected.zone },
                { icon: <Phone className="w-4 h-4" />, label: 'Téléphone', value: selected.phone },
                { icon: <Mail className="w-4 h-4" />, label: 'Email', value: selected.email },
                { icon: <Activity className="w-4 h-4" />, label: 'Dernière activité', value: selected.lastActivity ?? '—' },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <span className="text-gray-400">{icon}</span>
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{value}</p>
                  </div>
                </div>
              ))}
            </div>
            {(() => { const st = agentStats(selected.id); return (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-primary-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-primary-700">{st.parcels}</p>
                  <p className="text-xs text-primary-600">Parcelles</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-green-700">{st.hectares.toFixed(1)}</p>
                  <p className="text-xs text-green-600">Hectares</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-blue-700">{st.producers}</p>
                  <p className="text-xs text-blue-600">Producteurs</p>
                </div>
              </div>
            )})()}
          </div>
        </div>
      )}
    </div>
  )
}
