import { Lock } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import type { ModuleId } from '../../types'
import { MODULE_LABELS } from '../../api/platform'

/** Affiche la page seulement si le module est inclus dans l'abonnement de l'organisation. */
export default function RequireModule({ module, children }: { module: ModuleId; children: React.ReactNode }) {
  const modules = useAuthStore((s) => s.user?.modules ?? null)
  if (modules === null || modules.includes(module)) return <>{children}</>
  return (
    <div className="p-10 flex flex-col items-center text-center gap-3">
      <span className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center"><Lock className="w-7 h-7 text-gray-400" /></span>
      <p className="text-lg font-bold text-gray-900">Module non inclus dans votre abonnement</p>
      <p className="text-sm text-gray-500 max-w-md">
        « {MODULE_LABELS[module]} » n'est pas activé pour votre organisation. Contactez votre administrateur
        ou GeoLab Service (jeandavidkyao@gmail.com) pour l'ajouter.
      </p>
    </div>
  )
}
