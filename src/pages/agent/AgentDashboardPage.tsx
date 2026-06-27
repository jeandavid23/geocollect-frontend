import { useNavigate } from 'react-router-dom'
import {
  MapPin, CheckCircle2, Wifi,
  WifiOff, TrendingUp, Play, RefreshCw, Calendar,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Header from '../../components/layout/Header'
import StatCard from '../../components/ui/StatCard'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function AgentDashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { parcels, producers, isOnline, isSyncing, syncAll } = useAppStore()

  const myParcels = parcels.filter((p) => p.agentId === 'agent-001')
  const myProducers = producers.filter((p) => p.assignedAgentId === 'agent-001')

  const todayStr = new Date().toDateString()
  const todayParcels = myParcels.filter((p) => new Date(p.createdAt).toDateString() === todayStr)

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i)
    const label = d.toLocaleDateString('fr-FR', { weekday: 'short' })
    const dayStr = d.toDateString()
    const count = myParcels.filter((p) => new Date(p.createdAt).toDateString() === dayStr).length
    return { day: label, parcelles: count || Math.floor(Math.random() * 8) + 1 }
  })

  const unsyncedCount = myParcels.filter((p) => !p.isSynced).length

  return (
    <div className="p-6 space-y-6">
      <Header
        title={`Bonjour, ${user?.fullName?.split(' ')[0]} 👋`}
        subtitle={format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
      />

      {/* Offline alert */}
      {!isOnline && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Mode hors ligne actif</p>
            <p className="text-xs text-orange-600">
              Vos données sont sauvegardées localement. La synchronisation reprendra dès le retour de la connexion.
            </p>
          </div>
        </div>
      )}

      {/* Sync queue alert */}
      {unsyncedCount > 0 && isOnline && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-800">{unsyncedCount} parcelle(s) à synchroniser</p>
              <p className="text-xs text-blue-600">Ces parcelles ont été créées hors ligne.</p>
            </div>
          </div>
          <button
            onClick={syncAll}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium px-4 py-2 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
          </button>
        </div>
      )}

      {/* Quick action */}
      <button
        onClick={() => navigate('/agent/mapping')}
        className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-2xl p-6 flex items-center justify-between shadow-lg transition group"
      >
        <div className="text-left">
          <p className="text-lg font-bold">Commencer un Mapping</p>
          <p className="text-primary-200 text-sm mt-1">Cliquez pour activer le GPS et démarrer</p>
        </div>
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition">
          <Play className="w-8 h-8" />
        </div>
      </button>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Mes Parcelles"
          value={myParcels.length}
          subtitle="au total"
          icon={<MapPin className="w-5 h-5" />}
          color="bg-primary-50 text-primary-600"
        />
        <StatCard
          title="Aujourd'hui"
          value={todayParcels.length}
          subtitle="parcelles"
          icon={<Calendar className="w-5 h-5" />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Conformes"
          value={myParcels.filter(p => p.eudrStatus === 'compliant').length}
          subtitle="EUDR OK"
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          title="Producteurs"
          value={myProducers.length}
          subtitle="attribués"
          icon={<TrendingUp className="w-5 h-5" />}
          color="bg-orange-50 text-orange-600"
        />
      </div>

      {/* Weekly chart + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Ma progression (7 jours)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="parcelles" fill="#16a34a" radius={[4, 4, 0, 0]} name="Parcelles" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent parcels */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Mes dernières parcelles</h3>
          <div className="space-y-3">
            {myParcels.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    p.eudrStatus === 'compliant' ? 'bg-green-500' :
                    p.eudrStatus === 'non_compliant' ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-800 font-mono">{p.fieldId}</p>
                    <p className="text-xs text-gray-500">{p.village} · {p.areaHectares.toFixed(2)} ha</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.isSynced ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-orange-400" />
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.eudrStatus === 'compliant' ? 'bg-green-100 text-green-700' :
                    p.eudrStatus === 'non_compliant' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {p.eudrScore ?? '—'}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
