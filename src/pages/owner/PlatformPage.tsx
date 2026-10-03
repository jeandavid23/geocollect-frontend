import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Building2, UserCog, MapPin, Sprout, ShieldCheck, Loader2, ArrowRight, AlertTriangle } from 'lucide-react'
import Header from '../../components/layout/Header'
import { platformApi, MODULE_LABELS, ALL_MODULES, type PlatformOverview } from '../../api/platform'
import { apiErrorMessage } from '../../utils/retry'

/** Vue d'ensemble du propriétaire : toute la plateforme et chacun de ses clients. */
export default function PlatformPage() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    platformApi.overview().then(({ data }) => setData(data)).catch((err) => setError(apiErrorMessage(err)))
  }, [])

  const t = data?.totals
  const kpi = [
    { label: 'Clients (super admins)', value: t ? `${t.super_admins_active} / ${t.super_admins}` : '—', sub: 'actifs / total', icon: <ShieldCheck className="w-5 h-5" />, color: 'text-purple-700 bg-purple-50' },
    { label: 'Coopératives', value: t?.cooperatives ?? '—', sub: t?.cooperatives_unassigned ? `${t.cooperatives_unassigned} gérée(s) par vous` : 'toutes rattachées', icon: <Building2 className="w-5 h-5" />, color: 'text-blue-700 bg-blue-50' },
    { label: 'Agents mappeurs', value: t?.agents ?? '—', sub: `${t?.users ?? 0} comptes au total`, icon: <UserCog className="w-5 h-5" />, color: 'text-amber-700 bg-amber-50' },
    { label: 'Producteurs', value: t?.producers?.toLocaleString('fr-FR') ?? '—', sub: '', icon: <Users className="w-5 h-5" />, color: 'text-green-700 bg-green-50' },
    { label: 'Parcelles', value: t?.parcels?.toLocaleString('fr-FR') ?? '—', sub: t ? `${t.hectares.toLocaleString('fr-FR')} ha` : '', icon: <MapPin className="w-5 h-5" />, color: 'text-primary-700 bg-primary-50' },
  ]

  return (
    <div className="p-6 space-y-5">
      <Header title="Plateforme" subtitle="Super Super Admin — vue d'ensemble de tous vos clients" />

      {error && <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3"><AlertTriangle className="w-4 h-4 mt-0.5" /> {error}</p>}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpi.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center ${k.color}`}>{k.icon}</span>
            <p className="text-2xl font-black text-gray-900 mt-2">{k.value}</p>
            <p className="text-xs text-gray-500">{k.label}</p>
            {k.sub && <p className="text-[11px] text-gray-400">{k.sub}</p>}
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <p className="font-semibold text-gray-900 flex items-center gap-2"><Sprout className="w-4 h-4 text-green-600" /> Vos clients</p>
          <Link to="/owner/admins" className="text-sm text-primary-700 font-medium flex items-center gap-1">Gérer les accès <ArrowRight className="w-4 h-4" /></Link>
        </div>
        {!data ? (
          <p className="px-5 py-8 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>
        ) : data.clients.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500">Aucun client pour le moment. <Link to="/owner/admins" className="text-primary-700 underline">Créez un super admin</Link> pour chaque client.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>{['Client', 'Statut', 'Coopératives', 'Agents', 'Parcelles', 'Fin d\'abonnement', 'Modules'].map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.clients.map((c) => {
                  const l = c.license
                  const st = !c.is_active ? ['Suspendu', 'bg-red-100 text-red-700'] : l.is_expired ? ['Expiré', 'bg-amber-100 text-amber-800'] : ['Actif', 'bg-green-100 text-green-700']
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2.5"><p className="font-semibold text-gray-800">{l.organization || c.full_name}</p><p className="text-xs text-gray-400 font-mono">{c.username}</p></td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st[1]}`}>{st[0]}</span></td>
                      <td className="px-4 py-2.5">{l.cooperatives_used}{l.max_cooperatives != null && <span className="text-gray-400"> / {l.max_cooperatives}</span>}</td>
                      <td className="px-4 py-2.5">{l.agents_used}</td>
                      <td className="px-4 py-2.5">{(c.parcels ?? 0).toLocaleString('fr-FR')} <span className="text-xs text-gray-400">({c.hectares ?? 0} ha)</span></td>
                      <td className="px-4 py-2.5 text-xs">{l.expires_at ? new Date(l.expires_at).toLocaleDateString('fr-FR') : 'Sans fin'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{(l.modules ?? ALL_MODULES).length === ALL_MODULES.length ? 'Tous' : (l.modules ?? []).map((m) => MODULE_LABELS[m]).join(', ') || 'Base'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
