import { Eye, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'

const HOME: Record<string, string> = { owner: '/owner', super_admin: '/admin', cooperative: '/coop', agent: '/agent' }

/** Bandeau du mode « Voir comme » : consultation en lecture seule, retour au compte d'origine. */
export default function ImpersonationBanner() {
  const { impersonator, user } = useAuthStore()
  if (!impersonator) return null
  const back = () => {
    useAppStore.getState().clearData()
    useAuthStore.getState().stopImpersonation()
    window.location.replace(HOME[useAuthStore.getState().user?.role ?? ''] ?? '/')
  }
  return (
    <div className="flex flex-wrap items-center gap-3 bg-[#e9c98b] px-4 py-2 text-sm text-[#3b2a12]">
      <Eye className="h-4 w-4 flex-shrink-0" />
      <span className="min-w-0 flex-1">Vous consultez l'espace de <b>{user?.fullName}</b> en <b>lecture seule</b> (support). Aucune modification n'est possible.</span>
      <button onClick={back} className="flex items-center gap-1.5 rounded-lg bg-[#3b2a12] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
        <LogOut className="h-3.5 w-3.5" /> Revenir à mon compte
      </button>
    </div>
  )
}
