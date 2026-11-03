import CoopCompare from '../../components/admin/CoopCompare'
import {
  UserCog, Leaf, Activity,
  Plus, Map as MapIcon, Send, FileSpreadsheet, ScrollText, Globe2, Crown, KeyRound,
} from 'lucide-react'
import QuickActions from '../../components/ui/QuickActions'
import { exportExcel } from '../../utils/featureExport'
import { useLivePolling } from '../../hooks/useLivePolling'
import Header from '../../components/layout/Header'
import AnalyticsPanel from '../../components/analytics/AnalyticsPanel'
import LicenseCard from '../../components/ui/LicenseCard'
import { useMemo } from 'react'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'

export default function AdminDashboardPage() {
  useLivePolling()
  // Données déjà cloisonnées par le serveur : un super admin ne reçoit que les coopératives qu'il gère,
  // le propriétaire (Super Super Admin) reçoit toute la plateforme.
  const { cooperatives, producers, parcels, agents, isLoading } = useAppStore()
  const isOwner = useAuthStore((s) => s.user?.role === 'owner')

  // Chiffres par coopérative, calculés sur les données reçues (uniquement les coopératives accessibles)
  const coopStats = useMemo(() => {
    const stats = new Map(cooperatives.map((c) => [c.id, { coop: c, parcels: 0, ha: 0, agents: 0, producers: 0 }]))
    for (const p of parcels) { const s = stats.get(p.cooperativeId); if (s) { s.parcels++; s.ha += p.areaHectares || 0 } }
    for (const a of agents) { const s = stats.get(a.cooperativeId); if (s) s.agents++ }
    for (const p of producers) { const s = stats.get(p.cooperativeId); if (s) s.producers++ }
    return [...stats.values()].sort((a, b) => b.parcels - a.parcels)
  }, [cooperatives, parcels, agents, producers])
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

      <CoopCompare />

      <AnalyticsPanel />

      <div>
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
