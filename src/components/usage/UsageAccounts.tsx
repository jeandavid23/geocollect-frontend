import { useMemo, useState } from 'react'
import { FileSpreadsheet, Search } from 'lucide-react'
import Button from '../ui/Button'
import { SortTh, useSort } from '../ui/table'
import { ROLE_LABEL, USAGE_STATUS, type UsageAccount, type UsageStatus } from '../../api/usage'
import { exportExcel } from '../../utils/featureExport'
import { fr } from '../../utils/lotSheet'

const STATUS_ORDER: Record<UsageStatus, number> = { actif: 0, peu_actif: 1, inactif: 2, jamais: 3 }

export const lastSeen = (iso: string | null) => {
  if (!iso) return 'jamais'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return days <= 0 ? `aujourd'hui ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : days === 1 ? 'hier' : `il y a ${days} j`
}

/** Activité compte par compte : dernière visite, jours actifs, sessions, pages vues, connexions, actions. */
export default function UsageAccounts({ accounts, showAdmin }: { accounts: UsageAccount[]; showAdmin: boolean }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<UsageStatus | ''>('')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return accounts.filter((a) => (!status || a.status === status)
      && (!needle || `${a.name} ${a.username} ${a.organisation} ${a.admin_name}`.toLowerCase().includes(needle)))
  }, [accounts, q, status])
  const { sorted, sort, toggle } = useSort(rows, {
    name: (a) => a.name, seen: (a) => (a.last_seen ? new Date(a.last_seen).getTime() : 0), days: (a) => a.days_active,
    views: (a) => a.page_views, actions: (a) => a.actions, status: (a) => STATUS_ORDER[a.status],
  }, 'usage-accounts')
  const excel = () => exportExcel([{ name: 'Comptes', rows: sorted.map((a) => ({
    compte: a.name, identifiant: a.username, role: ROLE_LABEL[a.role], organisation: a.organisation, client: a.admin_name,
    derniere_visite: a.last_seen ?? '', statut: USAGE_STATUS[a.status].label, jours_actifs: a.days_active, sessions: a.sessions,
    pages_vues: a.page_views, connexions: a.logins, actions: a.actions })) }], `utilisation_comptes_${new Date().toISOString().slice(0, 10)}.xlsx`)
  const td = 'px-5 py-2.5'
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un compte, une coopérative…" aria-label="Rechercher"
            className="w-72 rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value as UsageStatus | '')} aria-label="Statut"
          className="rounded-md border border-gray-300 px-2 py-2 text-sm">
          <option value="">Tous les statuts</option>
          {(Object.keys(USAGE_STATUS) as UsageStatus[]).map((s) => <option key={s} value={s}>{USAGE_STATUS[s].label}</option>)}
        </select>
        <span className="text-xs text-gray-500">{sorted.length} compte(s)</span>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={excel}>Excel</Button>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500"><tr>
            <SortTh label="Compte" k="name" sort={sort} onSort={toggle} /><th className="px-5 py-3 text-left font-medium">Organisation</th>
            <SortTh label="Dernière visite" k="seen" sort={sort} onSort={toggle} /><SortTh label="Jours actifs" k="days" sort={sort} onSort={toggle} />
            <th className="px-5 py-3 text-left font-medium">Sessions</th><SortTh label="Pages vues" k="views" sort={sort} onSort={toggle} />
            <th className="px-5 py-3 text-left font-medium">Connexions</th><SortTh label="Actions" k="actions" sort={sort} onSort={toggle} />
            <SortTh label="Statut" k="status" sort={sort} onSort={toggle} />
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((a) => (
              <tr key={a.id} className={a.is_active ? '' : 'opacity-60'}>
                <td className={td}>{a.name}<span className="block text-xs text-gray-400">{a.username} · {ROLE_LABEL[a.role]}{a.is_active ? '' : ' · désactivé'}</span></td>
                <td className={td}>{a.organisation || '—'}{showAdmin && <span className="block text-xs text-gray-400">{a.admin_name}</span>}</td>
                <td className={`${td} whitespace-nowrap`}>{lastSeen(a.last_seen)}</td>
                <td className={`${td} tabular-nums`}>{a.days_active}</td><td className={`${td} tabular-nums`}>{fr(a.sessions, 0)}</td>
                <td className={`${td} tabular-nums`}>{fr(a.page_views, 0)}</td><td className={`${td} tabular-nums`}>{fr(a.logins, 0)}</td>
                <td className={`${td} tabular-nums`}>{fr(a.actions, 0)}</td>
                <td className={td}><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${USAGE_STATUS[a.status].tone}`}>{USAGE_STATUS[a.status].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
