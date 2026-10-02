import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

/**
 * Rafraîchissement automatique « temps quasi réel » : recharge les données
 * toutes les `intervalMs` millisecondes tant que la page est affichée et visible.
 * Dès qu'un agent enregistre une parcelle, l'admin et la coopérative la voient au tour suivant.
 * Se met en pause quand l'onglet est en arrière-plan (économise serveur et batterie).
 */
export function useLivePolling(intervalMs = 15000) {
  const refreshData = useAppStore((s) => s.refreshData)
  const setPolling = useAppStore((s) => s.setPolling)
  const isLive = useAppStore((s) => s.isLive)

  useEffect(() => {
    if (!isLive) return
    setPolling(true)
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer) return
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') refreshData()
      }, intervalMs)
    }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }

    // premier rafraîchissement rapide à l'ouverture de la page, puis à intervalle régulier
    const kick = setTimeout(() => refreshData(), 1500)
    start()
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshData() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => { clearTimeout(kick); stop(); document.removeEventListener('visibilitychange', onVisibility); setPolling(false) }
  }, [isLive, intervalMs, refreshData, setPolling])
}
