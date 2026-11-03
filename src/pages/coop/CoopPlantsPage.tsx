import { useEffect, useState } from 'react'
import { Factory } from 'lucide-react'
import Header from '../../components/layout/Header'
import EmptyState from '../../components/ui/EmptyState'
import PlantActivity from '../../components/plant/PlantActivity'
import { plantsApi, type Plant } from '../../api/trace'

/** Coopérative : ce que deviennent ses lots dans les usines qui la servent (réceptions, usinage, stock, expéditions). */
export default function CoopPlantsPage() {
  const [plants, setPlants] = useState<Plant[] | null>(null)
  const [selected, setSelected] = useState('')
  useEffect(() => {
    plantsApi.list().then(({ data }) => { setPlants(data); setSelected((s) => s || data[0]?.id || '') }).catch(() => setPlants([]))
  }, [])
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Usines" subtitle="Réceptions, contrôle qualité, usinage, stock et expéditions de vos lots" />
      {plants === null ? <p className="text-sm text-gray-500">Chargement…</p> : plants.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white"><EmptyState icon={<Factory className="h-7 w-7" />} title="Aucune usine"
          text="Aucune usine n'est encore rattachée à votre coopérative. Votre super admin l'ajoute dans « Usines »." /></div>
      ) : <>
        {plants.length > 1 && (
          <label className="block text-sm text-gray-600">Usine{' '}
            <select value={selected} onChange={(e) => setSelected(e.target.value)} className="ml-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              {plants.map((p) => <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ''}</option>)}
            </select>
          </label>
        )}
        <p className="rounded-xl bg-info-bg p-3 text-sm text-info-text">Vous voyez ici uniquement ce qui concerne les lots de votre coopérative.</p>
        {selected && <PlantActivity key={selected} plant={selected} />}
      </>}
    </div>
  )
}
