import {
  Users, MapPin, Leaf, UserCog, CheckCircle2, XCircle, Clock,
  TrendingUp, BarChart3, Trophy, Map,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import Header from '../../components/layout/Header'
import StatCard from '../../components/ui/StatCard'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'

export default function CoopDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { getCooperativeStats, parcels, agents } = useAppStore()

  const coopId = user?.cooperativeId ?? 'coop-001'
  const stats = getCooperativeStats(coopId)
  const coopParcels = parcels.filter((p) => p.cooperativeId === coopId)
  const coopAgents = agents.filter((a) => a.cooperativeId === coopId)

  return (
    <div className="p-6 space-y-6">
      <Header
        title="Tableau de bord Coopérative"
        subtitle={`Espace COOPACI BEOUMI · Vue d'ensemble de vos activités`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Producteurs" value={stats.totalProducers} icon={<Users className="w-5 h-5" />} color="bg-blue-50 text-blue-600" />
        <StatCard title="Parcelles" value={stats.totalParcels} icon={<MapPin className="w-5 h-5" />} color="bg-primary-50 text-primary-600" />
        <StatCard title="Hectares" value={`${stats.totalHectares.toFixed(1)}`} subtitle="ha cartographiés" icon={<Leaf className="w-5 h-5" />} color="bg-green-50 text-green-600" />
        <StatCard title="Agents" value={stats.totalAgents} icon={<UserCog className="w-5 h-5" />} color="bg-orange-50 text-orange-600" />
        <StatCard title="Villages" value={stats.totalVillages} icon={<Map className="w-5 h-5" />} color="bg-purple-50 text-purple-600" />
        <StatCard title="Sections" value={stats.totalSections} icon={<BarChart3 className="w-5 h-5" />} color="bg-teal-50 text-teal-600" />
      </div>

      {/* EUDR status */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-green-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.eudrCompliant}</p>
              <p className="text-xs text-gray-500">Conformes EUDR</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${stats.totalParcels ? (stats.eudrCompliant / stats.totalParcels) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {stats.totalParcels ? Math.round((stats.eudrCompliant / stats.totalParcels) * 100) : 0}%
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.eudrNonCompliant}</p>
              <p className="text-xs text-gray-500">Non conformes</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full"
              style={{ width: `${stats.totalParcels ? (stats.eudrNonCompliant / stats.totalParcels) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {stats.totalParcels ? Math.round((stats.eudrNonCompliant / stats.totalParcels) * 100) : 0}%
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-yellow-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700">{stats.pendingValidation}</p>
              <p className="text-xs text-gray-500">En attente</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 rounded-full"
              style={{ width: `${stats.totalParcels ? (stats.pendingValidation / stats.totalParcels) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {stats.totalParcels ? Math.round((stats.pendingValidation / stats.totalParcels) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Progress charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Progression journalière (7j)</h3>
            <TrendingUp className="w-5 h-5 text-primary-500" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.dailyProgress}>
              <defs>
                <linearGradient id="gradDaily" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="parcels" stroke="#16a34a" fill="url(#gradDaily)" strokeWidth={2} name="Parcelles" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top agents */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Top Agents</h3>
            <Trophy className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="space-y-3">
            {coopAgents.map((agent, i) => (
              <div key={agent.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-gray-100 text-gray-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{agent.fullName}</p>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{ width: `${Math.min(100, ((agent.parcelCount ?? 0) / 100) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{agent.parcelCount}</p>
                  <p className="text-xs text-gray-400">parcelles</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent parcels */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Parcelles récentes</h3>
          <span className="text-xs text-gray-400">{coopParcels.length} au total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="text-left px-5 py-3 font-medium">FIELD ID</th>
                <th className="text-left px-5 py-3 font-medium">Village</th>
                <th className="text-left px-5 py-3 font-medium">Section</th>
                <th className="text-left px-5 py-3 font-medium">Superficie</th>
                <th className="text-left px-5 py-3 font-medium">Score EUDR</th>
                <th className="text-left px-5 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coopParcels.slice(0, 8).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 text-sm font-mono font-medium text-gray-800">{p.fieldId}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{p.village}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{p.section}</td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-800">{p.areaHectares.toFixed(2)} ha</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-16">
                        <div
                          className={`h-full rounded-full ${(p.eudrScore ?? 0) >= 80 ? 'bg-green-500' : (p.eudrScore ?? 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${p.eudrScore ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{p.eudrScore ?? '—'}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      p.eudrStatus === 'compliant' ? 'bg-green-100 text-green-700' :
                      p.eudrStatus === 'non_compliant' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {p.eudrStatus === 'compliant' ? '🟢 Conforme' :
                       p.eudrStatus === 'non_compliant' ? '🔴 Non conforme' :
                       '🟡 En attente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
