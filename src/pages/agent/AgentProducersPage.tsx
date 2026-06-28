import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Satellite, CheckCircle2, Clock } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'

export default function AgentProducersPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { producers, parcels } = useAppStore()
  const coopId = user?.cooperativeId ?? 'coop-001'

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all')

  const coopProducers = producers.filter((p) => p.cooperativeId === coopId)
  const parcelCount = (pid: string) => parcels.filter((pc) => pc.producerId === pid).length

  const filtered = coopProducers.filter((p) => {
    const matchSearch = !search ||
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.village.toLowerCase().includes(search.toLowerCase()) ||
      p.fieldIdBase.toLowerCase().includes(search.toLowerCase())
    const n = parcelCount(p.id)
    const matchFilter = filter === 'all' || (filter === 'todo' ? n === 0 : n > 0)
    return matchSearch && matchFilter
  })

  const todo = coopProducers.filter((p) => parcelCount(p.id) === 0).length
  const done = coopProducers.length - todo

  return (
    <div className="p-6 space-y-5">
      <Header title="Producteurs à mapper" subtitle={`${coopProducers.length} producteurs dans votre coopérative`} />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: coopProducers.length, color: 'text-primary-600' },
          { label: 'À mapper', value: todo, color: 'text-orange-600' },
          { label: 'Déjà mappés', value: done, color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher producteur, village, FIELD ID..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        {[
          { v: 'all', l: 'Tous' },
          { v: 'todo', l: 'À mapper' },
          { v: 'done', l: 'Mappés' },
        ].map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v as typeof filter)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${
              filter === f.v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>{f.l}</button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filtered.map((p) => {
            const n = parcelCount(p.id)
            return (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    p.gender === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
                  }`}>{p.firstName.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.fullName}</p>
                    <p className="text-xs text-gray-500 font-mono">{p.fieldIdBase} · {p.village}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {n > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {n} parcelle{n > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                      <Clock className="w-3.5 h-3.5" /> à mapper
                    </span>
                  )}
                  <button
                    onClick={() => navigate('/agent/mapping')}
                    className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                  >
                    <Satellite className="w-3.5 h-3.5" /> Mapper
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
              <MapPin className="w-8 h-8 text-gray-300" />
              Aucun producteur. La coopérative doit en enregistrer.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
