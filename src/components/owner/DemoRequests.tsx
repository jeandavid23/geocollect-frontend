import { useEffect, useState } from 'react'
import { Inbox, Phone, Mail , Trash2 } from 'lucide-react'
import api from '../../api/client'

interface Demo { id: string; full_name: string; organization: string; profile: string; phone: string; email: string; producers: number | null; plan: string; message: string; status: string; created_at: string }
const PROFILE: Record<string, string> = { cooperative: 'Coopérative', exportateur: 'Exportateur', certification: 'Certification', autre: 'Autre' }
const STATUS: Record<string, string> = { nouvelle: 'Nouvelle', contactee: 'Contactée', demo: 'Démo faite', client: 'Devenue cliente', sans_suite: 'Sans suite' }

/** Demandes de démonstration reçues depuis la page de présentation (propriétaire). */
export default function DemoRequests() {
  const [items, setItems] = useState<Demo[] | null>(null)
  useEffect(() => { api.get<Demo[]>('/contact/demo/list/').then(({ data }) => setItems(data)).catch(() => setItems([])) }, [])
  const setStatus = async (d: Demo, status: string) => {
    const { data } = await api.patch<Demo>(`/contact/demo/${d.id}/`, { status })
    setItems((l) => (l ?? []).map((x) => (x.id === d.id ? data : x)))
  }
  const fresh = (items ?? []).filter((d) => d.status === 'nouvelle').length
  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <p className="flex items-center gap-2 font-semibold text-gray-900"><Inbox className="h-4 w-4 text-primary-700" /> Demandes de démo {fresh > 0 && <span className="rounded-full bg-primary-700 px-2 py-0.5 text-xs text-white">{fresh} nouvelle(s)</span>}</p>
        <a href="/" target="_blank" rel="noreferrer" className="text-sm text-primary-700 hover:underline">Voir la page publique</a>
      </div>
      {items === null ? <p className="px-5 py-6 text-sm text-gray-500">Chargement…</p> : items.length === 0 ? <p className="px-5 py-6 text-sm text-gray-500">Aucune demande pour le moment.</p> : (
        <div className="divide-y divide-gray-100">
          {items.map((d) => (
            <div key={d.id} className="flex flex-wrap items-start gap-4 px-5 py-3 text-sm">
              <div className="min-w-[220px] flex-1">
                <p className="font-semibold text-gray-900">{d.organization} <span className="font-normal text-gray-500">· {PROFILE[d.profile] ?? d.profile}</span></p>
                <p className="text-gray-600">{d.full_name}{d.producers ? ` · ${d.producers.toLocaleString('fr-FR')} producteurs` : ''}{d.plan ? ` · formule ${d.plan}` : ''}</p>
                {d.message && <p className="mt-1 text-gray-500">{d.message}</p>}
                <p className="mt-1 text-xs text-gray-400">{new Date(d.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <a href={`https://wa.me/${d.phone.replace(/\D/g, '').replace(/^0/, '2250')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary-700 hover:underline"><Phone className="h-3.5 w-3.5" />{d.phone}</a>
                {d.email && <a href={`mailto:${d.email}`} className="flex items-center gap-1.5 text-primary-700 hover:underline"><Mail className="h-3.5 w-3.5" />{d.email}</a>}
              </div>
              <select value={d.status} onChange={(e) => setStatus(d, e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-xs">
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={async () => { if (!window.confirm(`Supprimer la demande de ${d.organization} ?`)) return; await api.delete(`/contact/demo/${d.id}/`); setItems((l) => (l ?? []).filter((x) => x.id !== d.id)) }}
                title="Supprimer la demande" className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
