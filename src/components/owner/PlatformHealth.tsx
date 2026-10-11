import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Database, Map, Trash2, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react'
import api from '../../api/client'
import { trashApi } from '../../api/platform'

interface Health { status: string; database: string; db_ms: number; version: string; uptime_s: number }

/** Santé de la plateforme : serveur, base, PostGIS, données de référence, corbeille, supervision Grafana. */
export default function PlatformHealth() {
  const [h, setH] = useState<Health | null>(null)
  const [spatial, setSpatial] = useState<{ postgis: boolean; land_zones: number } | null>(null)
  const [trash, setTrash] = useState<number | null>(null)
  const [down, setDown] = useState(false)
  useEffect(() => {
    api.get<Health>('/monitoring/health/').then(({ data }) => setH(data)).catch(() => setDown(true))
    api.get('/parcels/spatial/status/').then(({ data }) => setSpatial(data)).catch(() => {})
    trashApi.list().then(({ data }) => setTrash(data.length)).catch(() => {})
  }, [])
  const up = h ? `${Math.floor(h.uptime_s / 86400)} j ${Math.floor((h.uptime_s % 86400) / 3600)} h` : '—'
  const card = 'rounded-xl border border-gray-100 p-3'
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 font-semibold text-gray-900"><Activity className="h-4 w-4 text-primary-700" /> Santé de la plateforme</p>
        <a href="https://honestrabbit215.grafana.net" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary-700 hover:underline">Supervision Grafana <ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className={card}>
          <p className="text-xs text-gray-500">Serveur</p>
          <p className={`flex items-center gap-1.5 font-semibold ${down ? 'text-red-700' : 'text-green-700'}`}>{down ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{down ? 'Injoignable' : h ? 'En service' : '…'}</p>
          <p className="text-[11px] text-gray-400">version {h?.version?.slice(0, 7) ?? '—'} · depuis {up}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500">Base de données</p>
          <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Database className="h-4 w-4 text-gray-400" />{h ? `${Math.round(h.db_ms)} ms` : '—'}</p>
          <p className="text-[11px] text-gray-400">{h?.database === 'ok' ? 'répond normalement' : h ? h.database : ''}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500">Calculs spatiaux</p>
          <p className="font-semibold text-gray-900">{spatial ? (spatial.postgis ? 'PostGIS' : 'Python') : '—'}</p>
          <p className="text-[11px] text-gray-400">{spatial ? (spatial.postgis ? 'index spatial actif' : 'PostGIS non activé') : ''}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-gray-500">Zones foncières</p>
          <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Map className="h-4 w-4 text-gray-400" />{spatial ? spatial.land_zones.toLocaleString('fr-FR') : '—'}</p>
          <p className="text-[11px] text-gray-400">forêts classées, parcs, enclaves</p>
        </div>
        <Link to="/owner/trash" className={`${card} hover:bg-gray-50`}>
          <p className="text-xs text-gray-500">Corbeille</p>
          <p className="flex items-center gap-1.5 font-semibold text-gray-900"><Trash2 className="h-4 w-4 text-gray-400" />{trash ?? '—'}</p>
          <p className="text-[11px] text-gray-400">compte(s) restaurable(s)</p>
        </Link>
      </div>
    </section>
  )
}
