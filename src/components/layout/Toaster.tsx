import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import type { Notification } from '../../types'

const STYLE: Record<Notification['type'], { icon: React.ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 className="w-5 h-5 text-green-600" />, bar: 'bg-green-500' },
  info: { icon: <Info className="w-5 h-5 text-blue-600" />, bar: 'bg-blue-500' },
  warning: { icon: <AlertTriangle className="w-5 h-5 text-amber-600" />, bar: 'bg-amber-500' },
  error: { icon: <XCircle className="w-5 h-5 text-red-600" />, bar: 'bg-red-500' },
}
const DURATION = 6000
const MAX_VISIBLE = 4

/**
 * Messages éphémères en haut à droite : confirmations de l'application (« Producteur enregistré »…)
 * et nouvelles notifications du serveur (connexions, traitements terminés, messages reçus).
 */
export default function Toaster() {
  const notifications = useAppStore((s) => s.notifications)
  const [visible, setVisible] = useState<Notification[]>([])
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    // au premier rendu, les notifications déjà présentes ne sont pas réaffichées
    if (seen.current === null) { seen.current = new Set(notifications.map((n) => n.id)); return }
    const fresh = notifications.filter((n) => !seen.current!.has(n.id))
    if (!fresh.length) return
    fresh.forEach((n) => seen.current!.add(n.id))
    setVisible((v) => [...fresh.reverse(), ...v].slice(0, MAX_VISIBLE))
    fresh.forEach((n) => setTimeout(() => setVisible((v) => v.filter((x) => x.id !== n.id)), DURATION))
  }, [notifications])

  if (!visible.length) return null
  return (
    <div className="fixed top-4 right-4 z-[2000] space-y-2 w-[340px] max-w-[calc(100vw-2rem)]" role="status" aria-live="polite">
      {visible.map((n) => (
        <div key={n.id} className="relative bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden flex gap-3 p-3 pr-8 animate-[fadeIn_.2s_ease-out]">
          <span className={`absolute left-0 top-0 bottom-0 w-1 ${STYLE[n.type]?.bar ?? 'bg-gray-400'}`} />
          <span className="flex-shrink-0 mt-0.5">{STYLE[n.type]?.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{n.title}</p>
            {n.message && <p className="text-xs text-gray-600 mt-0.5 break-words">{n.message}</p>}
          </div>
          <button onClick={() => setVisible((v) => v.filter((x) => x.id !== n.id))} className="absolute top-2 right-2 p-1 rounded hover:bg-gray-100" aria-label="Fermer">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      ))}
    </div>
  )
}
