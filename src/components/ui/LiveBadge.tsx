import { useEffect, useState } from 'react'
import { Radio } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

/** Badge « temps réel » : montre que les données se rafraîchissent et depuis combien de temps. */
export default function LiveBadge() {
  const { isLive, lastSync, pollersActive } = useAppStore()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  if (!isLive || pollersActive === 0) return null
  const secs = lastSync ? Math.round((Date.now() - lastSync) / 1000) : null
  const label = secs == null ? 'connexion…' : secs < 3 ? "à l'instant" : secs < 60 ? `il y a ${secs}s` : `il y a ${Math.round(secs / 60)} min`
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-full font-medium" title="Les données se mettent à jour automatiquement">
      <Radio className="w-3.5 h-3.5 animate-pulse" />
      Temps réel · {label}
    </span>
  )
}
