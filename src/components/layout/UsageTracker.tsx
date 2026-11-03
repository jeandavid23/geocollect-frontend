import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPage } from '../../utils/usageTracker'

/** Enregistre chaque changement de page (statistiques d'utilisation). */
export default function UsageTracker() {
  const { pathname } = useLocation()
  useEffect(() => { trackPage(pathname) }, [pathname])
  return null
}
