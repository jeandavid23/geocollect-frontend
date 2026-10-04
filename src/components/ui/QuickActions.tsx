import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import MessageModal from './MessageModal'
import { useAuthStore } from '../../store/authStore'
import type { ModuleId } from '../../types'

export interface QuickAction {
  label: string
  icon: React.ReactNode
  to?: string                  // page à ouvrir
  onClick?: () => void         // ou action directe
  message?: string             // ou fenêtre « Envoyer un message » avec ce destinataire proposé
  module?: ModuleId            // masqué si le module n'est pas dans l'abonnement
  tone?: 'primary' | 'green' | 'blue' | 'amber' | 'purple' | 'gray'
  hint?: string
}

const TONE: Record<NonNullable<QuickAction['tone']>, string> = {
  primary: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
  green: 'bg-green-50 text-green-700 hover:bg-green-100',
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  amber: 'bg-amber-50 text-amber-800 hover:bg-amber-100',
  purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  gray: 'bg-gray-50 text-gray-700 hover:bg-gray-100',
}

/** Barre d'actions rapides des tableaux de bord. */
export default function QuickActions({ actions, title = 'Actions rapides' }: { actions: QuickAction[]; title?: string }) {
  const navigate = useNavigate()
  const modules = useAuthStore((s) => s.user?.modules ?? null)
  const [messageTarget, setMessageTarget] = useState<string | null>(null)
  const shown = actions.filter((a) => !a.module || modules === null || modules.includes(a.module))

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" /> {title}</p>
      <div className="flex flex-wrap gap-2">
        {shown.map((a) => (
          <button key={a.label} title={a.hint}
            onClick={() => (a.message !== undefined ? setMessageTarget(a.message) : a.to ? navigate(a.to) : a.onClick?.())}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition ${TONE[a.tone ?? 'gray']}`}>
            <span className="w-4 h-4 flex items-center justify-center">{a.icon}</span>{a.label}
          </button>
        ))}
      </div>
      <MessageModal open={messageTarget !== null} defaultTarget={messageTarget ?? undefined} onClose={() => setMessageTarget(null)} />
    </section>
  )
}
