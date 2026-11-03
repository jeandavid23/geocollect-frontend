import Header from '../../components/layout/Header'
import PlantStock from '../../components/plant/PlantStock'
import { useAuthStore } from '../../store/authStore'

/** Compte usine : ce qui est en route, en magasin et prêt à expédier. */
export default function PlantStockPage() {
  const plant = useAuthStore((s) => s.user?.plantName)
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Stock" subtitle={`${plant ?? 'Usine'} · camions en route, cacao à usiner, produits finis à expédier`} />
      <PlantStock />
    </div>
  )
}
