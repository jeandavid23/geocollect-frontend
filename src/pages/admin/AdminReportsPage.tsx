import Header from '../../components/layout/Header'
import SavedReports from '../../components/reports/SavedReports'
import { useAuthStore } from '../../store/authStore'

/** Rapports des traitements et imports de toutes les coopératives accessibles (super admin : les siennes). */
export default function AdminReportsPage() {
  const isOwner = useAuthStore((s) => s.user?.role === 'owner')
  return (
    <div className="p-6 space-y-5">
      <Header title="Rapports des coopératives" subtitle={isOwner ? 'Toutes les coopératives de la plateforme' : 'Uniquement les coopératives que vous gérez'} />
      <SavedReports showCooperative />
    </div>
  )
}
