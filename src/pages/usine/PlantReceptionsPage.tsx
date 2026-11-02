import Header from '../../components/layout/Header'
import TransportSlips from '../../components/trace/TransportSlips'
import { useAuthStore } from '../../store/authStore'

/** Compte usine : fiches d'accompagnement adressées à l'usine, réception (poids à l'arrivée) et impression. */
export default function PlantReceptionsPage() {
  const plant = useAuthStore((s) => s.user?.plantName)
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Réceptions" subtitle={`${plant ?? 'Usine'} · lots expédiés par les coopératives : pesez à l'arrivée et enregistrez la réception`} />
      <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
        Chaque camion arrive avec sa fiche d'accompagnement. Vérifiez les plombs, pesez le chargement, puis cliquez sur l'icône de réception :
        l'écart avec le poids au départ est calculé et reste tracé. Les lots reçus deviennent disponibles pour l'usinage.
      </p>
      <TransportSlips />
    </div>
  )
}
