import { useState } from 'react'
import Header from '../../components/layout/Header'
import DemoRequests, { DEMO_STATUS } from '../../components/owner/DemoRequests'

/** Prospects : demandes de démo reçues depuis la page publique, suivies jusqu'à la signature. */
export default function ProspectsPage() {
  const [status, setStatus] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Prospects" subtitle="Demandes de démo reçues depuis la page de présentation — de la prise de contact à la signature" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[['', 'Toutes'], ...Object.entries(DEMO_STATUS)].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`rounded-xl border p-3 text-left ${status === k ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-600' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
            <p className="text-xs text-gray-500">{l}</p>
            <p className="text-xl font-semibold tabular-nums text-gray-900">{k ? counts[k] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0)}</p>
          </button>
        ))}
      </div>
      <DemoRequests status={status || undefined} onLoaded={(items) => {
        const c: Record<string, number> = {}
        items.forEach((d) => { c[d.status] = (c[d.status] ?? 0) + 1 })
        setCounts(c)
      }} />
    </div>
  )
}
