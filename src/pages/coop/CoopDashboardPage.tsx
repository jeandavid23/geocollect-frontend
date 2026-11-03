import {
  Map, UserPlus, Upload, Package, TreePine, ShieldCheck, FileBarChart, Send, BookOpen, Link2,
} from 'lucide-react'
import QuickActions from '../../components/ui/QuickActions'
import NextActions from '../../components/coop/NextActions'
import { useLivePolling } from '../../hooks/useLivePolling'
import Header from '../../components/layout/Header'
import AnalyticsPanel from '../../components/analytics/AnalyticsPanel'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'

export default function CoopDashboardPage() {
  useLivePolling()
  const user = useAuthStore((s) => s.user)
  const { parcels, cooperatives } = useAppStore()

  const coopId = user?.cooperativeId ?? 'coop-001'
  const coopParcels = parcels.filter((p) => p.cooperativeId === coopId)
  const coopName = cooperatives.find((c) => c.id === coopId)?.name ?? user?.fullName ?? 'votre coopérative'

  return (
    <div className="p-6 space-y-6">
      <Header
        title="Tableau de bord Coopérative"
        subtitle={`Espace ${coopName} · Vue d'ensemble de vos activités`}
      />
      <NextActions />
      <QuickActions actions={[
        { label: 'Importer / ajouter des producteurs', icon: <Upload className="w-4 h-4" />, to: '/coop/producers', tone: 'primary' },
        { label: 'Nouvel agent mappeur', icon: <UserPlus className="w-4 h-4" />, to: '/coop/agents', tone: 'blue' },
        { label: 'Registre', icon: <BookOpen className="w-4 h-4" />, to: '/coop/registry', module: 'registry' },
        { label: 'Analyse déforestation', icon: <TreePine className="w-4 h-4" />, to: '/coop/deforestation', module: 'deforestation', tone: 'green' },
        { label: 'Polygon Validator', icon: <ShieldCheck className="w-4 h-4" />, to: '/coop/validator', module: 'validator', tone: 'green' },
        { label: 'Polygon & GMR', icon: <Link2 className="w-4 h-4" />, to: '/coop/gmr', module: 'gmr', tone: 'green' },
        { label: 'Nouvelle fiche de lot', icon: <Package className="w-4 h-4" />, to: '/coop/lots', module: 'lots' },
        { label: 'Export TRACES (EUDR)', icon: <FileBarChart className="w-4 h-4" />, to: '/coop/reports#traces', hint: 'Fichier GeoJSON pour la déclaration de diligence raisonnable' },
        { label: 'Rapports et exports', icon: <FileBarChart className="w-4 h-4" />, to: '/coop/reports', tone: 'purple' },
        { label: 'Carte', icon: <Map className="w-4 h-4" />, to: '/map' },
        { label: 'Message aux agents', icon: <Send className="w-4 h-4" />, message: 'agents', tone: 'amber' },
        { label: 'Contacter mon super admin', icon: <Send className="w-4 h-4" />, message: 'manager' },
      ]} />

      <AnalyticsPanel />

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
                      {p.eudrStatus === 'compliant' ? 'Conforme' :
                       p.eudrStatus === 'non_compliant' ? 'Non conforme' :
                       'En attente'}
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
