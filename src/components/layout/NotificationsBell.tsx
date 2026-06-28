import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import { notificationsApi, type ApiNotification } from '../../api/notifications'
import { useAuthStore } from '../../store/authStore'

const TYPE_DOT: Record<string, string> = {
  success: 'bg-green-500', info: 'bg-blue-500', warning: 'bg-yellow-500', error: 'bg-red-500',
}

export default function NotificationsBell({ collapsed }: { collapsed: boolean }) {
  const token = useAuthStore((s) => s.token)
  const [items, setItems] = useState<ApiNotification[]>([])
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const isLive = !!token && !token.startsWith('mock')

  const load = async () => {
    if (!isLive) return
    try {
      const { data } = await notificationsApi.list()
      const list = Array.isArray(data) ? data : (data.results ?? [])
      setItems(list)
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    load()
    if (isLive) {
      timer.current = setInterval(load, 30000) // rafraîchit toutes les 30s
    }
    return () => { if (timer.current) clearInterval(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive])

  const unread = items.filter((n) => !n.is_read).length

  const markAllRead = async () => {
    try { await notificationsApi.markRead() } catch { /* ignore */ }
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const fmt = (s: string) => {
    try { return new Date(s).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
    catch { return s }
  }

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); if (!open && unread) markAllRead() }}
        className="relative flex items-center gap-3 w-full px-3 py-2 rounded-xl text-primary-200 hover:bg-primary-800 hover:text-white text-sm transition">
        <Bell className="w-5 h-5 flex-shrink-0" />
        {!collapsed && 'Notifications'}
        {unread > 0 && (
          <span className="absolute top-1 left-6 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-0 left-full ml-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[1000] max-h-96 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-bold text-gray-900 text-sm">Notifications 🔔</p>
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Tout lu
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Aucune notification</p>
            ) : items.map((n) => (
              <div key={n.id} className={`px-4 py-3 flex gap-3 ${n.is_read ? '' : 'bg-primary-50/40'}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${TYPE_DOT[n.type] ?? 'bg-gray-400'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{n.title}</p>
                  {n.message && <p className="text-xs text-gray-500">{n.message}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {n.cooperative_name ? `${n.cooperative_name} · ` : ''}{fmt(n.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
