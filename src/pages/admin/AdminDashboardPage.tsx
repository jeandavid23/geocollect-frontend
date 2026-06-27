import {
  Building2, Users, MapPin, UserCog, Leaf, TrendingUp,
  CheckCircle2, XCircle, Clock, BarChart3, Shield, Activity,
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Header from '../../components/layout/Header'
import StatCard from '../../components/ui/StatCard'
import { useAppStore } from '../../store/appStore'
import { MOCK_COOPERATIVES } from '../../utils/mockData'

const COLORS = ['#16a34a', '#dc2626', '#f59e0b']

export default function AdminDashboardPage() {
  const { cooperatives, producers, parcels, agents } = useAppStore()

  const totalHa = parcels.reduce((s, p) => s + p.areaHectares, 0)
  const compliant = parcels.filter((p) => p.eudrStatus === 'compliant').length
  const nonCompliant = parcels.filter((p) => p.eudrStatus === 'non_compliant').length
  const pending = parcels.filter((p) => p.eudrStatus === 'pending').length

  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 13 + i)
    return {
      date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      parcelles: Math.floor(Math.random() * 20) + 3,
      hectares: Math.round((Math.random() * 40 + 8) * 10) / 10,
    }
  })

  const eudrData = [
    { name: 'Conforme', value: compliant },
    { name: 'Non conforme', value: nonCompliant },
    { name: 'En attente', value: pending },
  ]

  const coopPerf = MOCK_COOPERATIVES.map((c) => ({
    name: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name,
    parcelles: c.parcelCount ?? 0,
    hectares: c.totalHectares ?? 0,
  }))

  return (
    <div className="p-6 space-y-6">
      <Header
        title="Tableau de bord Administrateur"
        subtitle="Vue globale de la plateforme GeoCollect EUDR"
      />

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Coopératives"
          value={cooperatives.length}
          subtitle="actives sur la plateforme"
          icon={<Building2 className="w-6 h-6" />}
          color="bg-blue-50 text-blue-600"
          trend={{ value: 12, label: 'ce mois' }}
        />
        <StatCard
          title="Producteurs"
          value={producers.length}
          subtitle="enregistrés"
          icon={<Users className="w-6 h-6" />}
          color="bg-primary-50 text-primary-600"
          trend={{ value: 8, label: 'ce mois' }}
        />
        <StatCard
          title="Parcelles"
          value={parcels.length}
          subtitle={`${totalHa.toFixed(1)} ha cartographiés`}
          icon={<MapPin className="w-6 h-6" />}
          color="bg-green-50 text-green-600"
          trend={{ value: 15, label: 'cette semaine' }}
        />
        <StatCard
          title="Agents Mappeurs"
          value={agents.length}
          subtitle="actifs sur le terrain"
          icon={<UserCog className="w-6 h-6" />}
          color="bg-orange-50 text-orange-600"
        />
      </div>

      {/* EUDR Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Conformes EUDR"
          value={compliant}
          subtitle={`${Math.round((compliant / parcels.length) * 100)}% des parcelles`}
          icon={<CheckCircle2 className="w-6 h-6" />}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          title="Non conformes"
          value={nonCompliant}
          subtitle="à corriger"
          icon={<XCircle className="w-6 h-6" />}
          color="bg-red-50 text-red-600"
        />
        <StatCard
          title="En attente"
          value={pending}
          subtitle="validation requise"
          icon={<Clock className="w-6 h-6" />}
          color="bg-yellow-50 text-yellow-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Évolution du mapping (14 jours)</h3>
            <TrendingUp className="w-5 h-5 text-primary-500" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="gradParcelles" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="parcelles" stroke="#16a34a" fill="url(#gradParcelles)" strokeWidth={2} name="Parcelles" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* EUDR Pie */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Statut EUDR</h3>
            <Shield className="w-5 h-5 text-primary-500" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={eudrData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                {eudrData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {eudrData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  {d.name}
                </div>
                <span className="font-semibold text-gray-700">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cooperative performance + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coop Performance */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Performance par coopérative</h3>
            <BarChart3 className="w-5 h-5 text-primary-500" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={coopPerf} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="parcelles" fill="#16a34a" radius={[0, 4, 4, 0]} name="Parcelles" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cooperatives list */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Coopératives actives</h3>
            <Activity className="w-5 h-5 text-primary-500" />
          </div>
          <div className="space-y-3">
            {MOCK_COOPERATIVES.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.region} · {c.agentCount} agents</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{c.parcelCount}</p>
                  <p className="text-xs text-gray-500">parcelles</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
