import { useEffect } from 'react'
import { isRemembered } from '../store/authStorage'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'

const IDLE_MS = 30 * 60 * 1000
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

/** « Rester connecté » décoché (poste partagé) : déconnexion après 30 minutes sans activité. */
export function useIdleLogout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  useEffect(() => {
    if (!isAuthenticated || isRemembered()) return
    let timer = 0
    const fire = async () => {
      try { sessionStorage.setItem('geocollect-logout-reason', 'Déconnexion automatique après 30 minutes d’inactivité.') } catch { /* indisponible */ }
      useAppStore.getState().clearData()
      await useAuthStore.getState().logout()
      window.location.replace('/login')
    }
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(fire, IDLE_MS) }
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => { window.clearTimeout(timer); EVENTS.forEach((e) => window.removeEventListener(e, reset)) }
  }, [isAuthenticated])
}
