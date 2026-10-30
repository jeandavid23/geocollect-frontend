import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { onWake, shouldPoll } from '../utils/activity'

/**
 * Rafraîchissement automatique « temps quasi réel » : recharge les données
 * toutes les `intervalMs` millisecondes tant que la page est affichée et visible.
 * Dès qu'un agent enregistre une parcelle, l'admin et la coopérative la voient au tour suivant.
 * Se met en pause quand l'onglet est en arrière-plan ou que personne n'a touché l'écran depuis 10 minutes
 * (économise serveur, base de données et batterie).
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
        if (shouldPoll()) refreshData()          // onglet visible ET utilisateur présent (voir utils/activity)
      }, intervalMs)
    }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }

    // premier rafraîchissement rapide à l'ouverture de la page, puis à intervalle régulier
    const kick = setTimeout(() => refreshData(), 1500)
    start()
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshData() }
    document.addEventListener('visibilitychange', onVisibility)
    const offWake = onWake(() => refreshData())  // retour devant l'écran : données à jour tout de suite

    return () => {
      clearTimeout(kick); stop(); offWake()
      document.removeEventListener('visibilitychange', onVisibility); setPolling(false)
    }
  }, [isLive, intervalMs, refreshData, setPolling])
}
