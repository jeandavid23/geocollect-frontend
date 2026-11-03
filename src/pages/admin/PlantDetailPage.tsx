import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Header from '../../components/layout/Header'
import PlantDashboard from '../../components/plant/PlantDashboard'
import PlantStock from '../../components/plant/PlantStock'
import Shipments from '../../components/plant/Shipments'
import { plantsApi, type Plant } from '../../api/trace'

const TABS = [['dashboard', 'Tableau de bord'], ['stock', 'Stock'], ['shipments', 'Expéditions']] as const
type Tab = typeof TABS[number][0]

/** Super admin : activité d'une de ses usines (lecture ; l'usine saisit elle-même ses opérations). */
export default function PlantDetailPage() {
  const { id = '' } = useParams()
  const [plant, setPlant] = useState<Plant | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  useEffect(() => { plantsApi.list().then(({ data }) => setPlant(data.find((p) => p.id === id) ?? null)).catch(() => setPlant(null)) }, [id])
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Link to="/admin/plants" className="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"><ArrowLeft className="h-4 w-4" />Usines</Link>
      <Header title={plant?.name ?? 'Usine'} subtitle={plant ? `${plant.location || ''}${plant.location ? ' · ' : ''}${plant.cooperatives.map((c) => c.name).join(', ')}` : ''} />
      <div role="tablist" className="flex gap-1 border-b border-gray-200">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>
        ))}
      </div>
      {tab === 'dashboard' && <PlantDashboard plant={id} />}
      {tab === 'stock' && <PlantStock plant={id} />}
      {tab === 'shipments' && <Shipments plant={id} canEdit={false} />}
    </div>
  )
}
