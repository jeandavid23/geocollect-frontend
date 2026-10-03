import { BadgeCheck, CalendarClock, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { MODULE_LABELS, ALL_MODULES } from '../../api/platform'

/** Abonnement du super admin connecté : quotas consommés, modules, échéance. */
export default function LicenseCard() {
  const user = useAuthStore((s) => s.user)
  const l = user?.license
  if (user?.role !== 'super_admin' || !l) return null
  const days = l.expires_at ? Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86400000) : null
  const soon = days != null && days <= 30
  return (
    <section className={`rounded-2xl border p-4 flex flex-wrap items-center gap-x-8 gap-y-3 ${soon ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
      <p className="flex items-center gap-2 font-semibold text-gray-900">
        <BadgeCheck className="w-5 h-5 text-primary-600" /> Votre abonnement{l.organization && ` · ${l.organization}`}
      </p>
      <p className="text-sm text-gray-600">Coopératives : <b>{l.cooperatives_used}</b> / {l.max_cooperatives ?? 'illimité'}</p>
      <p className="text-sm text-gray-600">Agents : <b>{l.agents_used}</b>{l.max_agents_per_coop != null && ` (max ${l.max_agents_per_coop} par coopérative)`}</p>
      <p className={`text-sm flex items-center gap-1.5 ${soon ? 'text-amber-800 font-medium' : 'text-gray-600'}`}>
        {soon ? <AlertTriangle className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
        {l.expires_at ? `Échéance : ${new Date(l.expires_at).toLocaleDateString('fr-FR')}${days != null && days >= 0 ? ` (${days} j)` : ''}` : 'Sans échéance'}
      </p>
      <div className="flex flex-wrap gap-1 w-full">
        {(l.modules ?? ALL_MODULES).map((m) => (
          <span key={m} className="text-[11px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{MODULE_LABELS[m]}</span>
        ))}
      </div>
    </section>
  )
}
