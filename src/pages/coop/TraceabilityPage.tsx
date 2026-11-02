import { useState } from 'react'
import { BarChart3, Factory, Scale, Truck } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useStickyState } from '../../components/ui/table'
import DeliveriesTab from '../../components/trace/DeliveriesTab'
import VolumesTab from '../../components/trace/VolumesTab'
import TransportSlips from '../../components/trace/TransportSlips'
import ProcessingTab from '../../components/trace/ProcessingTab'
import { currentCampaign } from '../../api/trace'

const TABS = [
  { id: 'pesees', label: 'Pesées', icon: Scale },
  { id: 'volumes', label: 'Volumes par producteur', icon: BarChart3 },
  { id: 'transport', label: "Fiches d'accompagnement", icon: Truck },
  { id: 'usine', label: 'Usinage et transformation', icon: Factory },
] as const
type TabId = (typeof TABS)[number]['id']

/**
 * Traçabilité des volumes, de la coopérative jusqu'à l'usine :
 * pesée du producteur → lot → fiche d'accompagnement → réception → usinage → transformation.
 */
export default function TraceabilityPage() {
  const [tab, setTab] = useStickyState<TabId>('trace:tab', 'pesees')
  const [campaign, setCampaign] = useState(currentCampaign())
  const y = Number(currentCampaign().slice(0, 4))
  const campaigns = [0, 1, 2].map((k) => `${y - k}-${y - k + 1}`)

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Traçabilité des volumes" subtitle="De la pesée du producteur jusqu'à l'usine : pesées, volumes, lots, transport, usinage et transformation" />
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1" aria-label="Sections de la traçabilité">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${tab === id ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              <Icon className="h-4 w-4" />{label}</button>
          ))}
        </nav>
        <span className="flex-1" />
        {(tab === 'pesees' || tab === 'volumes') && (
          <label className="flex items-center gap-2 text-sm text-gray-600">Campagne
            <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              {campaigns.map((c) => <option key={c}>{c}</option>)}</select></label>
        )}
      </div>
      {tab === 'pesees' && <DeliveriesTab campaign={campaign} />}
      {tab === 'volumes' && <VolumesTab campaign={campaign} />}
      {tab === 'transport' && <TransportSlips />}
      {tab === 'usine' && <ProcessingTab />}
    </div>
  )
}
