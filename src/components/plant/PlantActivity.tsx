import { useState } from 'react'
import TransportSlips from '../trace/TransportSlips'
import ProcessingTab from '../trace/ProcessingTab'
import PlantDashboard from './PlantDashboard'
import PlantStock from './PlantStock'
import Shipments from './Shipments'

const TABS = [['dashboard', 'Tableau de bord'], ['receptions', 'Réceptions'], ['processing', 'Usinage'],
  ['stock', 'Stock'], ['shipments', 'Expéditions']] as const
type Tab = typeof TABS[number][0]

/**
 * Toutes les données d'une usine, en consultation (propriétaire, super admin, coopérative). Le serveur limite ce
 * que voit une coopérative à ce qui concerne ses propres lots.
 */
export default function PlantActivity({ plant }: { plant: string }) {
  const [tab, setTab] = useState<Tab>('dashboard')
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Données de l'usine" className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-primary-700 text-primary-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>
        ))}
      </div>
      {tab === 'dashboard' && <PlantDashboard plant={plant} />}
      {tab === 'receptions' && <TransportSlips key={plant} plant={plant} />}
      {tab === 'processing' && <ProcessingTab key={plant} plant={plant} />}
      {tab === 'stock' && <PlantStock plant={plant} />}
      {tab === 'shipments' && <Shipments plant={plant} canEdit={false} />}
    </div>
  )
}
