import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Building2, UserCog, MapPin, Sprout, ShieldCheck, Loader2, ArrowRight, AlertTriangle, Bell, BarChart3, Boxes, FileSpreadsheet, Info } from 'lucide-react'
import Header from '../../components/layout/Header'
import { platformApi, MODULE_LABELS, ALL_MODULES, type PlatformOverview, type ModuleUsage } from '../../api/platform'
import type { ModuleId } from '../../types'
import { exportExcel } from '../../utils/featureExport'
import MessageModal from '../../components/ui/MessageModal'
import DemoRequests from '../../components/owner/DemoRequests'
import { apiErrorMessage } from '../../utils/retry'

/** Vue d'ensemble du propriétaire : toute la plateforme et chacun de ses clients. */
export default function PlatformPage() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [error, setError] = useState('')
  const [bulkBusy, setBulkBusy] = useState('')
  const [bulkMsg, setBulkMsg] = useState('')
  const [announce, setAnnounce] = useState(false)

  const load = useCallback(() => {
    platformApi.overview().then(({ data }) => setData(data)).catch((err) => setError(apiErrorMessage(err)))
  }, [])
  useEffect(() => { load() }, [load])

  // Outils mesurés (les autres modules sont des écrans de données)
  const TOOLS: ModuleId[] = ['deforestation', 'validator', 'selfintersection', 'gmr']
  const usageTotal = (u?: ModuleUsage) => TOOLS.reduce((s, m) => s + (u?.[m]?.runs ?? 0), 0)
  const maxItems = Math.max(1, ...TOOLS.map((m) => data?.usage?.[m]?.items ?? 0))

  // Clients dont la licence liste ses modules et n'a pas ce module
  const missing = (m: ModuleId) => (data?.clients ?? []).filter((c) => c.license.modules && !c.license.modules.includes(m)).length
  const holders = (m: ModuleId) => (data?.clients ?? []).filter((c) => !c.license.modules || c.license.modules.includes(m)).length

  const bulk = async (m: ModuleId, grant: boolean) => {
    const verb = grant ? 'Activer' : 'Retirer'
    if (!window.confirm(`${verb} « ${MODULE_LABELS[m]} » pour tous les clients à licence restreinte ?`)) return
    setBulkBusy(m); setBulkMsg('')
    try {
      const { data: r } = await platformApi.bulkModule(m, grant)
      setBulkMsg(`${MODULE_LABELS[m]} : ${grant ? 'activé' : 'retiré'} pour ${r.changed} client(s).`)
      load()
    } catch (err) {
      setBulkMsg(apiErrorMessage(err))
    } finally {
      setBulkBusy('')
    }
  }

  const exportClients = () => {
    if (!data) return
    exportExcel([{
      name: 'Clients', rows: data.clients.map((c) => ({
        Organisation: c.license.organization || c.full_name, Responsable: c.full_name, Identifiant: c.username,
        'E-mail': c.email, Téléphone: c.phone, Statut: !c.is_active ? 'Suspendu' : c.license.is_expired ? 'Expiré' : 'Actif',
        Coopératives: c.license.cooperatives_used, 'Coopératives max.': c.license.max_cooperatives ?? 'illimité',
        Agents: c.license.agents_used, 'Agents max. / coop': c.license.max_agents_per_coop ?? 'illimité',
        Parcelles: c.parcels ?? 0, Hectares: c.hectares ?? 0,
        "Fin d'abonnement": c.license.expires_at ? new Date(c.license.expires_at).toLocaleDateString('fr-FR') : 'Sans fin',
        Modules: c.license.modules ? c.license.modules.map((m) => MODULE_LABELS[m] ?? m).join(', ') : 'Tous',
        [`Traitements ${data.usage_days} j`]: usageTotal(c.usage),
        'Dernière connexion': c.last_login ? new Date(c.last_login).toLocaleString('fr-FR') : '—',
        'Créé le': new Date(c.created_at).toLocaleDateString('fr-FR'),
      })),
    }], `clients_geocollect_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setAnnounce(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100"><Bell className="w-4 h-4" /> Envoyer une annonce</button>
        <Link to="/owner/admins" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100"><ShieldCheck className="w-4 h-4" /> Nouveau client</Link>
        <Link to="/admin" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100"><BarChart3 className="w-4 h-4" /> Tableau de bord de toutes les coopératives</Link>
        <Link to="/admin/logs" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 text-gray-700 text-sm font-medium hover:bg-gray-100"><Info className="w-4 h-4" /> Journaux</Link>
      </div>
      <MessageModal open={announce} defaultTarget="all" onClose={() => setAnnounce(false)} />

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

      <DemoRequests />

      {data && (
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 flex items-center gap-2 mb-3"><Bell className="w-4 h-4 text-amber-600" /> Points d'attention</p>
          {data.alerts.length === 0 ? <p className="text-sm text-gray-500">Rien à signaler : tous les abonnements sont actifs et à jour.</p> : (
            <ul className="space-y-1.5">
              {data.alerts.map((a, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm rounded-xl px-3 py-2 ${a.level === 'error' ? 'bg-red-50 text-red-800' : a.level === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
                  {a.level === 'info' ? <Info className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <span className="flex-1">{a.message}</span>
                  <Link to={a.kind === 'unassigned' ? '/admin/cooperatives' : '/owner/admins'} className="text-xs font-semibold underline whitespace-nowrap">Traiter</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="font-semibold text-gray-900 flex items-center gap-2 mb-1"><BarChart3 className="w-4 h-4 text-primary-600" /> Utilisation des outils</p>
            <p className="text-xs text-gray-500 mb-4">{data.usage_days} derniers jours · tous clients</p>
            <div className="space-y-3">
              {TOOLS.map((m) => {
                const u = data.usage?.[m]
                return (
                  <div key={m}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{MODULE_LABELS[m]}</span>
                      <span className="text-gray-500"><b className="text-gray-800">{(u?.items ?? 0).toLocaleString('fr-FR')}</b> polygones · {u?.runs ?? 0} traitement(s)</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{ width: `${((u?.items ?? 0) / maxItems) * 100}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="font-semibold text-gray-900 flex items-center gap-2 mb-1"><Boxes className="w-4 h-4 text-purple-600" /> Déploiement des modules</p>
            <p className="text-xs text-gray-500 mb-3">Activer ou retirer un module pour tous les clients d'un coup (les clients sans licence ont déjà tout).</p>
            <div className="divide-y divide-gray-50">
              {ALL_MODULES.map((m) => (
                <div key={m} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1 text-gray-800">{MODULE_LABELS[m]}</span>
                  <span className="text-xs text-gray-500 w-24 text-right">{holders(m)} / {data.clients.length} client(s)</span>
                  <button onClick={() => bulk(m, true)} disabled={!!bulkBusy || missing(m) === 0} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 disabled:opacity-40">Activer pour tous</button>
                  <button onClick={() => bulk(m, false)} disabled={!!bulkBusy} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 disabled:opacity-40">Retirer</button>
                </div>
              ))}
            </div>
            {bulkMsg && <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mt-2">{bulkMsg}</p>}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <p className="font-semibold text-gray-900 flex items-center gap-2"><Sprout className="w-4 h-4 text-green-600" /> Vos clients</p>
          <div className="flex items-center gap-4">
            <button onClick={exportClients} disabled={!data?.clients.length} className="text-sm text-green-700 font-medium flex items-center gap-1 disabled:opacity-40"><FileSpreadsheet className="w-4 h-4" /> Exporter Excel</button>
            <Link to="/owner/admins" className="text-sm text-primary-700 font-medium flex items-center gap-1">Gérer les accès <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
        {!data ? (
          <p className="px-5 py-8 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>
        ) : data.clients.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500">Aucun client pour le moment. <Link to="/owner/admins" className="text-primary-700 underline">Créez un super admin</Link> pour chaque client.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>{['Client', 'Statut', 'Coopératives', 'Agents', 'Parcelles', 'Fin d\'abonnement', 'Modules', 'Traitements'].map((h) => <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>)}</tr>
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
                      <td className="px-4 py-2.5 text-xs" title={TOOLS.map((m) => `${MODULE_LABELS[m]} : ${c.usage?.[m]?.runs ?? 0}`).join('\n')}>{usageTotal(c.usage)} <span className="text-gray-400">/ {data.usage_days} j</span></td>
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
