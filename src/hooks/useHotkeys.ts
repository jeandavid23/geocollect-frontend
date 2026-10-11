import { useEffect, useRef } from 'react'

/** Échap ferme, Ctrl+S (⌘S) enregistre — pour les panneaux et fenêtres de travail. */
export function useHotkeys({ escape, save }: { escape?: () => void; save?: () => void }) {
  const ref = useRef({ escape, save })
  ref.current = { escape, save }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // une fenêtre de confirmation ouverte au-dessus garde la main
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (e.key === 'Escape' && ref.current.escape) { ref.current.escape(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && ref.current.save) { e.preventDefault(); ref.current.save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
