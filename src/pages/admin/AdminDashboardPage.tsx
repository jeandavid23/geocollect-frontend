import {
  Building2, Users, MapPin, UserCog, Leaf, TrendingUp,
  CheckCircle2, XCircle, Clock, BarChart3, Shield, Activity,
  Plus, Map as MapIcon, Send, FileSpreadsheet, ScrollText, Globe2, Crown, KeyRound,
} from 'lucide-react'
import QuickActions from '../../components/ui/QuickActions'
import { exportExcel } from '../../utils/featureExport'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useLivePolling } from '../../hooks/useLivePolling'
import Header from '../../components/layout/Header'
import StatCard from '../../components/ui/StatCard'
import LicenseCard from '../../components/ui/LicenseCard'
import { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'

const COLORS = ['#16a34a', '#dc2626', '#f59e0b']

export default function AdminDashboardPage() {
  useLivePolling()
  // Données déjà cloisonnées par le serveur : un super admin ne reçoit que les coopératives qu'il gère,
  // le propriétaire (Super Super Admin) reçoit toute la plateforme.
  const { cooperatives, producers, parcels, agents, isLoading } = useAppStore()
  const isOwner = useAuthStore((s) => s.user?.role === 'owner')

  const totalHa = parcels.reduce((s, p) => s + p.areaHectares, 0)
  const compliant = parcels.filter((p) => p.eudrStatus === 'compliant').length
  const nonCompliant = parcels.filter((p) => p.eudrStatus === 'non_compliant').length
  const pending = parcels.filter((p) => p.eudrStatus === 'pending').length

  // Évolution réelle du mapping : parcelles enregistrées par jour sur 14 jours
  const dailyData = useMemo(() => {
    const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const byDay = new Map<string, { n: number; ha: number }>()
    for (const p of parcels) {
      const d = new Date(p.createdAt)
      if (Number.isNaN(d.getTime())) continue
      const e = byDay.get(key(d)) ?? { n: 0, ha: 0 }
      e.n += 1; e.ha += p.areaHectares || 0
      byDay.set(key(d), e)
    }
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - 13 + i)
      const e = byDay.get(key(d))
      return {
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        parcelles: e?.n ?? 0,
        hectares: Math.round((e?.ha ?? 0) * 10) / 10,
      }
    })
  }, [parcels])
  const weekParcels = dailyData.slice(-7).reduce((s, d) => s + d.parcelles, 0)

  const eudrData = [
    { name: 'Conforme', value: compliant },
    { name: 'Non conforme', value: nonCompliant },
    { name: 'En attente', value: pending },
  ]

  // Chiffres par coopérative, calculés sur les données reçues (uniquement les coopératives accessibles)
  const coopStats = useMemo(() => {
    const stats = new Map(cooperatives.map((c) => [c.id, { coop: c, parcels: 0, ha: 0, agents: 0, producers: 0 }]))
    for (const p of parcels) { const s = stats.get(p.cooperativeId); if (s) { s.parcels++; s.ha += p.areaHectares || 0 } }
    for (const a of agents) { const s = stats.get(a.cooperativeId); if (s) s.agents++ }
    for (const p of producers) { const s = stats.get(p.cooperativeId); if (s) s.producers++ }
    return [...stats.values()].sort((a, b) => b.parcels - a.parcels)
  }, [cooperatives, parcels, agents, producers])
  const coopPerf = coopStats.slice(0, 10).map((s) => ({
    name: s.coop.name.length > 15 ? s.coop.name.slice(0, 15) + '…' : s.coop.name,
    parcelles: s.parcels,
    hectares: Math.round(s.ha * 10) / 10,
  }))
  const pct = (n: number) => (parcels.length ? Math.round((n / parcels.length) * 100) : 0)

  const exportCoops = () => exportExcel([{
    name: 'Coopératives', rows: coopStats.map((s) => ({
      Coopérative: s.coop.name, Région: s.coop.region, ...(isOwner ? { Client: s.coop.managedByName ?? 'Propriétaire' } : {}),
      Statut: s.coop.isActive ? 'Active' : 'Désactivée', Agents: s.agents, Producteurs: s.producers,
      Parcelles: s.parcels, Hectares: Math.round(s.ha * 100) / 100,
    })),
  }], `cooperatives_${new Date().toISOString().slice(0, 10)}.xlsx`)

  return (
    <div className="p-6 space-y-6">
      <Header
        title={isOwner ? 'Tableau de bord — toute la plateforme' : 'Tableau de bord Administrateur'}
        subtitle={isOwner ? 'Toutes les coopératives de tous les super admins' : 'Uniquement les coopératives que vous gérez'}
      />
      <LicenseCard />
      <QuickActions actions={[
        ...(isOwner ? [
          { label: 'Plateforme', icon: <Globe2 className="w-4 h-4" />, to: '/owner', tone: 'purple' as const },
          { label: 'Clients (super admins)', icon: <Crown className="w-4 h-4" />, to: '/owner/admins', tone: 'purple' as const },
        ] : []),
        { label: 'Nouvelle coopérative', icon: <Plus className="w-4 h-4" />, to: '/admin/cooperatives', tone: 'primary' },
        { label: 'Agents mappeurs', icon: <UserCog className="w-4 h-4" />, to: '/admin/agents', tone: 'blue' },
        { label: 'Comptes & mots de passe', icon: <KeyRound className="w-4 h-4" />, to: '/admin/accounts' },
        { label: 'Carte des parcelles', icon: <MapIcon className="w-4 h-4" />, to: '/map', tone: 'green' },
        { label: isOwner ? 'Annonce à tous' : 'Message à mes coopératives', icon: <Send className="w-4 h-4" />, message: isOwner ? 'all' : 'my_cooperatives', tone: 'amber' },
        { label: 'Exporter Excel', icon: <FileSpreadsheet className="w-4 h-4" />, onClick: exportCoops, tone: 'green', hint: 'Chiffres par coopérative' },
        { label: 'Journaux', icon: <ScrollText className="w-4 h-4" />, to: '/admin/logs' },
      ]} />

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Coopératives"
          value={cooperatives.length}
          subtitle={isOwner ? 'sur la plateforme' : 'gérées par vous'}
          icon={<Building2 className="w-6 h-6" />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Producteurs"
          value={producers.length}
          subtitle="enregistrés"
          icon={<Users className="w-6 h-6" />}
          color="bg-primary-50 text-primary-600"
        />
        <StatCard
          title="Parcelles"
          value={parcels.length}
          subtitle={`${totalHa.toFixed(1)} ha · ${weekParcels} cette semaine`}
          icon={<MapPin className="w-6 h-6" />}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          title="Agents Mappeurs"
          value={agents.length}
          subtitle={`${agents.filter((a) => a.isActive).length} actif(s) sur le terrain`}
          icon={<UserCog className="w-6 h-6" />}
          color="bg-orange-50 text-orange-600"
        />
      </div>

      {/* EUDR Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Conformes EUDR"
          value={compliant}
          subtitle={`${pct(compliant)}% des parcelles`}
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
                  <stop offset="5%" stopColor="#2c6741" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2c6741" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="parcelles" stroke="#2c6741" fill="url(#gradParcelles)" strokeWidth={2} name="Parcelles" />
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
          {coopPerf.length === 0 ? <p className="text-sm text-gray-500 py-8 text-center">{isLoading ? 'Chargement…' : 'Aucune coopérative.'}</p> : (
          <ResponsiveContainer width="100%" height={Math.max(180, coopPerf.length * 32)}>
            <BarChart data={coopPerf} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="parcelles" fill="#2c6741" radius={[0, 4, 4, 0]} name="Parcelles" />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Cooperatives list */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">{isOwner ? 'Toutes les coopératives' : 'Vos coopératives'}</h3>
            <Activity className="w-5 h-5 text-primary-500" />
          </div>
          <div className="space-y-3">
            {coopStats.length === 0 && <p className="text-sm text-gray-500">{isLoading ? 'Chargement…' : 'Aucune coopérative pour le moment.'}</p>}
            {coopStats.map(({ coop: c, parcels: n, agents: na, producers: np }) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.region} · {na} agent(s) · {np.toLocaleString('fr-FR')} producteur(s){isOwner && c.managedByName ? ` · ${c.managedByName}` : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">{n.toLocaleString('fr-FR')}</p>
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
