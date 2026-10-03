import { useAuthStore } from '../store/authStore'
import type { ModuleId } from '../types'

/** Vrai si le module est inclus dans l'abonnement de l'organisation de l'utilisateur. */
export function useHasModule(module: ModuleId): boolean {
  const modules = useAuthStore((s) => s.user?.modules ?? null)
  return modules === null || modules.includes(module)
}
