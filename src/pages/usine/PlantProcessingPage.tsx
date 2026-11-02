import Header from '../../components/layout/Header'
import ProcessingTab from '../../components/trace/ProcessingTab'
import { useAuthStore } from '../../store/authStore'

/** Compte usine : usinage et transformation des lots reçus, chaîne de traçabilité et certificats. */
export default function PlantProcessingPage() {
  const plant = useAuthStore((s) => s.user?.plantName)
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Usinage et transformation" subtitle={`${plant ?? 'Usine'} · bilan matière et traçabilité jusqu'aux producteurs`} />
      <ProcessingTab />
    </div>
  )
}
