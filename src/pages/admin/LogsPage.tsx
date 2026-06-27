import { useMemo, useState } from 'react'
import { Search, MapPin, UserPlus, CheckCircle2, XCircle, Clock, Filter } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAppStore } from '../../store/appStore'

interface LogEntry {
  id: string
  type: 'parcel' | 'producer' | 'validation'
  icon: React.ReactNode
  color: string
  title: string
  detail: string
  actor: string
  timestamp: string
}

export default function LogsPage() {
  const { parcels, producers, agents, cooperatives } = useAppStore()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const agentName = (id: string) => agents.find((a) => a.id === id)?.fullName ?? 'Agent inconnu'
  const coopName = (id: string) => cooperatives.find((c) => c.id === id)?.name ?? '—'

  // Build an activity log from existing data
  const logs = useMemo<LogEntry[]>(() => {
    const entries: LogEntry[] = []

    parcels.forEach((p) => {
      entries.push({
        id: `parc-${p.id}`,
        type: 'parcel',
        icon: <MapPin className="w-4 h-4" />,
        color: 'bg-primary-50 text-primary-600',
        title: `Parcelle mappée — ${p.fieldId}`,
        detail: `${p.areaHectares.toFixed(2)} ha · ${p.culture} · ${p.village} (${coopName(p.cooperativeId)})`,
        actor: agentName(p.agentId),
        timestamp: p.createdAt,
      })
      entries.push({
        id: `val-${p.id}`,
        type: 'validation',
        icon: p.eudrStatus === 'compliant'
          ? <CheckCircle2 className="w-4 h-4" />
          : p.eudrStatus === 'non_compliant'
            ? <XCircle className="w-4 h-4" />
            : <Clock className="w-4 h-4" />,
        color: p.eudrStatus === 'compliant'
          ? 'bg-green-50 text-green-600'
          : p.eudrStatus === 'non_compliant'
            ? 'bg-red-50 text-red-600'
            : 'bg-yellow-50 text-yellow-600',
        title: `Validation EUDR — ${p.fieldId}`,
        detail: `Score ${p.eudrScore ?? '—'}% · ${
          p.eudrStatus === 'compliant' ? 'Conforme' :
          p.eudrStatus === 'non_compliant' ? 'Non conforme' : 'En attente'
        }`,
        actor: 'Polygon Validator EUDR by JDK',
        timestamp: p.updatedAt,
      })
    })

    producers.forEach((p) => {
      entries.push({
        id: `prod-${p.id}`,
        type: 'producer',
        icon: <UserPlus className="w-4 h-4" />,
        color: 'bg-blue-50 text-blue-600',
        title: `Producteur enregistré — ${p.fullName}`,
        detail: `${p.fieldIdBase} · ${p.village} (${coopName(p.cooperativeId)})`,
        actor: agentName(p.assignedAgentId ?? ''),
        timestamp: p.createdAt,
      })
    })

    return entries.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels, producers, agents, cooperatives])

  const filtered = logs.filter((l) => {
    const matchSearch = !search ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.detail.toLowerCase().includes(search.toLowerCase()) ||
      l.actor.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || l.type === filterType
    return matchSearch && matchType
  })

  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch { return s }
  }

  return (
    <div className="p-6 space-y-5">
      <Header title="Journaux d'activités" subtitle={`${logs.length} évènements enregistrés`} />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans les journaux..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {[
            { value: 'all', label: 'Tout' },
            { value: 'parcel', label: 'Parcelles' },
            { value: 'validation', label: 'Validations' },
            { value: 'producer', label: 'Producteurs' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterType(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterType === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filtered.map((l) => (
            <div key={l.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50 transition">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${l.color}`}>
                {l.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{l.title}</p>
                <p className="text-xs text-gray-500">{l.detail}</p>
                <p className="text-xs text-gray-400 mt-0.5">par {l.actor}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">{fmtDate(l.timestamp)}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-gray-400">Aucun évènement trouvé.</p>
          )}
        </div>
      </div>
    </div>
  )
}
