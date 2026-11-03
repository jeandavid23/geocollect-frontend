import Header from '../../components/layout/Header'
import PlantDashboard from '../../components/plant/PlantDashboard'
import { useAuthStore } from '../../store/authStore'

/** Compte usine : activité sur 12 mois. */
export default function PlantDashboardPage() {
  const plant = useAuthStore((s) => s.user?.plantName)
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Tableau de bord" subtitle={`${plant ?? 'Usine'} · réceptions, qualité, rendements et expéditions sur 12 mois`} />
      <PlantDashboard />
    </div>
  )
}
