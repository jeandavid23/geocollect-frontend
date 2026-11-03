import { useEffect, useState } from 'react'
import Header from '../../components/layout/Header'
import { NAV_ITEMS } from '../../components/layout/Sidebar'
import { Kpi, MonthlyBars, Panel, RankBars, ShareBar } from '../../components/analytics/charts'
import UsageAccounts, { lastSeen } from '../../components/usage/UsageAccounts'
import { USAGE_PERIODS, usageApi, type UsageGroup, type UsageOverview, type UsagePeriod } from '../../api/usage'
import { useAuthStore } from '../../store/authStore'
import { CHART } from '../../theme/tokens'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'

const DEVICE_LABEL = { ordinateur: 'Ordinateur', mobile: 'Téléphone', tablette: 'Tablette' } as const
const DEVICE_COLOR = { ordinateur: CHART.series1, mobile: CHART.series2, tablette: CHART.axis } as const
const EXTRA_PAGES: Record<string, string> = { '/account': 'Mon compte', '/notifications': 'Notifications', '/map': 'Carte' }
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const count = (v: number) => fr(v, 0)

/** Libellé lisible d'une adresse normalisée (« /coop/lots/:id » → « Fiches de lot · détail »). */
function pageLabel(path: string) {
  if (EXTRA_PAGES[path]) return EXTRA_PAGES[path]
  const routes = NAV_ITEMS.map((n) => ({ to: n.to.split('#')[0], label: n.label })).sort((a, b) => b.to.length - a.to.length)
  const exact = routes.find((r) => r.to === path)
  if (exact) return exact.label
  const parent = routes.find((r) => r.to.length > 1 && path.startsWith(`${r.to}/`))
  return parent ? `${parent.label} · détail` : path
}

function Groups({ title, subtitle, groups }: { title: string; subtitle: string; groups: UsageGroup[] }) {
  if (!groups.length) return null
  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Nom', 'Comptes', 'Actifs (7 j)', 'Pages vues', 'Connexions', 'Actions', 'Dernière activité'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">{groups.map((g) => (
          <tr key={`${g.id}${g.name}`}><td className="px-3 py-2">{g.name}</td><td className="px-3 py-2 tabular-nums">{g.accounts}</td>
            <td className="px-3 py-2 tabular-nums">{g.active} <span className="text-xs text-gray-400">({fr(g.accounts ? (100 * g.active) / g.accounts : 0, 0)} %)</span></td>
            <td className="px-3 py-2 tabular-nums">{count(g.page_views)}</td><td className="px-3 py-2 tabular-nums">{count(g.logins)}</td>
            <td className="px-3 py-2 tabular-nums">{count(g.actions)}</td><td className="whitespace-nowrap px-3 py-2">{lastSeen(g.last_seen)}</td></tr>))}
        </tbody>
      </table></div>
    </Panel>
  )
}

/**
 * Utilisation de la plateforme, compte par compte (comme un outil d'audience, mais calculé par GeoCollect) :
 * propriétaire → tous les clients ; super admin → ses coopératives et usines ; coopérative → ses comptes.
 */
export default function UsagePage() {
  const role = useAuthStore((s) => s.user?.role)
  const [days, setDays] = useState<UsagePeriod>(30)
  const [scope, setScope] = useState('')                 // « admin:<id> » ou « coop:<id> »
  const [data, setData] = useState<UsageOverview | null>(null)
  const [options, setOptions] = useState<{ admins: UsageGroup[]; coops: UsageGroup[] }>({ admins: [], coops: [] })
  const [error, setError] = useState('')
  useEffect(() => {
    const [kind, id] = scope.split(':')
    setData(null); setError('')
    usageApi.overview(days, kind === 'admin' ? { admin: id } : kind === 'coop' ? { cooperative: id } : {})
      .then(({ data: d }) => { setData(d); if (!scope) setOptions({ admins: d.by_admin.filter((g) => g.id), coops: d.by_cooperative }) })
      .catch((e) => setError(apiErrorMessage(e)))
  }, [days, scope])

  const isOwner = role === 'owner'
  const t = data?.totals
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Utilisation" subtitle={isOwner ? 'Activité des comptes de tous les clients' : role === 'cooperative' ? 'Activité des comptes de votre coopérative' : 'Activité des comptes de vos coopératives et usines'} />
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Période" className="inline-flex rounded-lg border border-gray-300 p-0.5">
          {USAGE_PERIODS.map((p) => (
            <button key={p} role="radio" aria-checked={days === p} onClick={() => setDays(p)}
              className={`rounded-md px-3 py-1.5 text-sm ${days === p ? 'bg-primary-700 font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p} jours</button>
          ))}
        </div>
        {role !== 'cooperative' && (options.admins.length > 1 || options.coops.length > 0) && (
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Filtrer" className="rounded-md border border-gray-300 px-2 py-2 text-sm">
            <option value="">{isOwner ? 'Tous les clients' : 'Toutes mes coopératives'}</option>
            {isOwner && options.admins.length > 0 && <optgroup label="Clients (super admins)">{options.admins.map((g) => <option key={`a${g.id}`} value={`admin:${g.id}`}>{g.name}</option>)}</optgroup>}
            {options.coops.length > 0 && <optgroup label="Coopératives">{options.coops.map((g) => <option key={`c${g.id}`} value={`coop:${g.id}`}>{g.name}</option>)}</optgroup>}
          </select>
        )}
        <span className="text-xs text-gray-500">Pages de l'application web ; connexions et actions comprennent l'application mobile. Données conservées 180 jours.</span>
      </div>
      {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
      {!data || !t ? (!error && <p className="text-sm text-gray-500">Calcul des statistiques…</p>) : <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Actifs aujourd'hui" value={count(t.active_today)} hint={`${count(t.active_7d)} sur 7 jours · ${count(t.accounts)} comptes`} />
          <Kpi label={`Actifs sur ${data.days} jours`} value={count(t.active_period)} hint={`${fr(t.accounts ? (100 * t.active_period) / t.accounts : 0, 0)} % des comptes`} />
          <Kpi label="Sessions" value={count(t.sessions)} hint={t.avg_session_minutes != null ? `${fr(t.avg_session_minutes, 1)} min en moyenne · ${fr(t.pages_per_session ?? 0, 1)} pages` : '—'} />
          <Kpi label="Comptes inactifs" value={count(t.dormant)} tone={t.dormant ? 'warning' : undefined} hint="aucune visite depuis 30 jours, ou jamais" />
          <Kpi label="Pages vues" value={count(t.page_views)} />
          <Kpi label="Connexions" value={count(t.logins)} />
          <Kpi label="Actions enregistrées" value={count(t.actions)} hint="parcelles, pesées, lots, imports…" />
          <Kpi label="Jours couverts" value={`${data.days}`} hint={`du ${new Date(data.start).toLocaleDateString('fr-FR')} au ${new Date(data.end).toLocaleDateString('fr-FR')}`} />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel title="Utilisateurs actifs par jour">
            <MonthlyBars data={data.daily} xKey="day" xFormat={dayLabel} period="jour" unit="comptes" height={220}
              series={[{ key: 'active_users', label: 'Utilisateurs actifs', color: CHART.series1 }]} />
          </Panel>
          <Panel title="Pages vues par jour">
            <MonthlyBars data={data.daily} xKey="day" xFormat={dayLabel} period="jour" unit="pages" height={220}
              series={[{ key: 'page_views', label: 'Pages vues', color: CHART.series2 }]} />
          </Panel>
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Panel title="Pages les plus consultées" className="xl:col-span-2">
            <RankBars rows={data.top_pages.map((p) => ({ label: pageLabel(p.path), detail: `${p.users} compte(s)`, value: p.views }))}
              format={(v) => `${fr(v, 0)} vues`} empty="Aucune page vue sur la période." />
          </Panel>
          <Panel title="Appareils" subtitle="Sessions par type d'appareil">
            <ShareBar parts={data.devices.map((d) => ({ label: DEVICE_LABEL[d.device], value: d.sessions, color: DEVICE_COLOR[d.device] }))} />
          </Panel>
        </div>
        <Panel title="Heures d'utilisation" subtitle="Pages vues selon l'heure (heure d'Abidjan)">
          <MonthlyBars data={data.hours.map((h) => ({ ...h, hour: String(h.hour) }))} xKey="hour" xFormat={(h) => `${h} h`} period="heure"
            unit="pages" height={180} series={[{ key: 'page_views', label: 'Pages vues', color: CHART.series1 }]} />
        </Panel>
        {isOwner && !scope && <Groups title="Par client" subtitle="Super admins et les comptes de leurs coopératives et usines" groups={data.by_admin} />}
        {role !== 'cooperative' && <Groups title="Par coopérative" subtitle="Comptes de la coopérative et ses agents" groups={data.by_cooperative} />}
        <UsageAccounts accounts={data.accounts} showAdmin={isOwner} />
      </>}
    </div>
  )
}
