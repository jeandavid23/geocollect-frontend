import Header from '../../components/layout/Header'
import Shipments from '../../components/plant/Shipments'
import { useAuthStore } from '../../store/authStore'

/** Compte usine : expéditions sortantes vers les acheteurs ou l'export, avec la référence DDS. */
export default function PlantShipmentsPage() {
  const plant = useAuthStore((s) => s.user?.plantName)
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Expéditions" subtitle={`${plant ?? 'Usine'} · conteneurs, connaissements et déclarations de diligence raisonnée (DDS)`} />
      <Shipments />
    </div>
  )
}
