import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Header from '../../components/layout/Header'
import PlantActivity from '../../components/plant/PlantActivity'
import { plantsApi, type Plant } from '../../api/trace'

/** Propriétaire et super admin : toutes les données d'une usine (l'usine saisit elle-même ses opérations). */
export default function PlantDetailPage() {
  const { id = '' } = useParams()
  const [plant, setPlant] = useState<Plant | null>(null)
  useEffect(() => { plantsApi.list().then(({ data }) => setPlant(data.find((p) => p.id === id) ?? null)).catch(() => setPlant(null)) }, [id])
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Link to="/admin/plants" className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"><ArrowLeft className="h-4 w-4" />Usines</Link>
      <Header title={plant?.name ?? 'Usine'} subtitle={plant ? `${plant.location || ''}${plant.location ? ' · ' : ''}${plant.cooperatives.map((c) => c.name).join(', ')}` : ''} />
      <PlantActivity plant={id} />
    </div>
  )
}
