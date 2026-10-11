import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, Trash2, X, Mail, ShieldCheck, MessageSquare, Activity, Wrench, CreditCard, Loader2 } from 'lucide-react'
import Header from '../components/layout/Header'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { confirmDialog } from '../components/ui/dialog'
import { notificationsApi, type ApiNotification, type NotificationPrefs } from '../api/notifications'
import { useStickyState } from '../components/ui/table'

const CAT: Record<string, { label: string; icon: React.ReactNode }> = {
  security: { label: 'Sécurité', icon: <ShieldCheck className="h-4 w-4" /> },
  message: { label: 'Messages', icon: <MessageSquare className="h-4 w-4" /> },
  subscription: { label: 'Abonnement', icon: <CreditCard className="h-4 w-4" /> },
  activity: { label: 'Activité', icon: <Activity className="h-4 w-4" /> },
  tool: { label: 'Analyses', icon: <Wrench className="h-4 w-4" /> },
}
const DOT: Record<string, string> = { success: 'bg-green-500', info: 'bg-sky-500', warning: 'bg-amber-500', error: 'bg-red-500' }

/** Toutes les notifications (filtres par catégorie, non lues) et préférences d'envoi par e-mail. */
export default function NotificationsPage() {
  const [category, setCategory] = useStickyState('notifications:category', '')
  const [unread, setUnread] = useStickyState('notifications:unread', false)
  const [items, setItems] = useState<ApiNotification[] | null>(null)
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [saving, setSaving] = useState('')

  const load = () => notificationsApi.list({ category: category || undefined, unread, limit: 300 })
    .then(({ data }) => setItems(Array.isArray(data) ? data : data.results ?? [])).catch(() => setItems([]))
  useEffect(() => { setItems(null); load() }, [category, unread]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { notificationsApi.prefs().then(({ data }) => setPrefs(data)).catch(() => {}) }, [])

  const toggleEmail = async (key: string, value: boolean) => {
    setSaving(key)
    try { setPrefs((await notificationsApi.savePrefs({ [key]: value })).data) } finally { setSaving('') }
  }
  const markAll = async () => { await notificationsApi.markRead(); load() }
  const clearAll = async () => {
    if (!(await confirmDialog({ tone: 'danger', title: 'Effacer toutes vos notifications ?', confirmLabel: 'Tout effacer' }))) return
    await notificationsApi.clear(); load()
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Notifications" subtitle="Tout ce qui s'est passé sur votre compte et vos coopératives" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {[['', 'Toutes'], ...Object.entries(CAT).map(([k, v]) => [k, v.label])].map(([k, l]) => (
              <button key={k} onClick={() => setCategory(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${category === k ? 'bg-primary-700 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>{l}</button>
            ))}
            <label className="ml-1 flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Non lues seulement</label>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" icon={<CheckCheck className="h-3.5 w-3.5" />} onClick={markAll}>Tout marquer lu</Button>
              <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={clearAll}>Tout effacer</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {items === null ? <p className="flex items-center gap-2 p-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
              : items.length === 0 ? <EmptyState icon={<Bell className="h-7 w-7" />} title="Aucune notification" text={unread || category ? 'Rien pour ce filtre.' : 'Les connexions, imports, analyses et messages apparaîtront ici.'} />
              : (
                <ul className="divide-y divide-gray-50">
                  {items.map((n) => (
                    <li key={n.id} className={`group relative flex gap-3 px-5 py-3.5 ${n.is_read ? '' : 'bg-primary-50/40'}`}>
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${DOT[n.type] ?? 'bg-gray-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        {n.message && <p className="mt-0.5 text-sm text-gray-600">{n.message}</p>}
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                          <span className="inline-flex items-center gap-1">{CAT[n.category ?? 'activity']?.icon}{CAT[n.category ?? 'activity']?.label}</span>
                          <span>{new Date(n.created_at).toLocaleString('fr-FR')}</span>
                          {n.cooperative_name && <span>· {n.cooperative_name}</span>}
                        </p>
                      </div>
                      <button onClick={async () => { await notificationsApi.clear(n.id); setItems((l) => (l ?? []).filter((x) => x.id !== n.id)) }}
                        aria-label="Effacer" title="Effacer" className="self-start rounded p-1 text-gray-300 opacity-0 hover:text-red-600 group-hover:opacity-100"><X className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </section>

        <aside className="h-fit space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 font-semibold text-gray-900"><Mail className="h-4 w-4 text-primary-700" /> Recevoir aussi par e-mail</p>
          {prefs && !prefs.email && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Aucune adresse e-mail sur votre compte : ajoutez-la dans <Link to="/account" className="underline">Mon compte</Link>.</p>
          )}
          {prefs ? prefs.categories.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-gray-50">
              <input type="checkbox" className="mt-1" checked={c.email} disabled={saving === c.key} onChange={(e) => toggleEmail(c.key, e.target.checked)} />
              <span><span className="block text-sm font-medium text-gray-800">{c.label}</span><span className="block text-xs text-gray-500">{c.description}</span></span>
            </label>
          )) : <p className="text-sm text-gray-500">Chargement…</p>}
          <p className="text-[11px] text-gray-400">L'envoi par SMS sera proposé plus tard. Les notifications restent toujours visibles dans l'application.</p>
        </aside>
      </div>
    </div>
  )
}
