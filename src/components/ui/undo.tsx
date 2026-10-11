import { useEffect, useState, useSyncExternalStore } from 'react'
import { RotateCcw, X } from 'lucide-react'

/**
 * « Annuler » pendant 5 secondes après une action courante (vider un champ, retirer une ligne, changer un statut),
 * à la place d'une fenêtre de confirmation :
 *   offerUndo('Champ « Téléphone » vidé', () => setValues(prev))
 * `onExpire` (facultatif) : à exécuter si l'utilisateur n'a PAS annulé (ex. envoi différé au serveur).
 */
interface Item { id: number; message: string; undo: () => void | Promise<void>; onExpire?: () => void; at: number }
const DURATION = 5000
let items: Item[] = []
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function offerUndo(message: string, undo: Item['undo'], onExpire?: () => void) {
  // une seule offre à la fois : la précédente est validée
  items.forEach((i) => i.onExpire?.())
  const it: Item = { id: ++seq, message, undo, onExpire, at: Date.now() }
  items = [it]
  emit()
  setTimeout(() => {
    if (items.some((i) => i.id === it.id)) { items = items.filter((i) => i.id !== it.id); it.onExpire?.(); emit() }
  }, DURATION)
}

export function UndoHost() {
  const list = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => items)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!list.length) return
    const t = setInterval(() => tick((x) => x + 1), 100)
    return () => clearInterval(t)
  }, [list])
  const it = list[0]
  if (!it) return null
  const left = Math.max(0, DURATION - (Date.now() - it.at))
  const close = () => { items = []; it.onExpire?.(); emit() }
  const cancel = async () => { items = []; emit(); await it.undo() }
  return (
    <div className="fixed bottom-5 left-1/2 z-[1500] w-[min(92vw,420px)] -translate-x-1/2 overflow-hidden rounded-xl bg-gray-900 text-white shadow-2xl" role="status" aria-live="polite">
      <div className="flex items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-sm">{it.message}</p>
        <button onClick={cancel} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-[#e9c98b] hover:bg-white/20">
          <RotateCcw className="h-4 w-4" /> Annuler <span className="tabular-nums text-xs text-white/60">{Math.ceil(left / 1000)}</span>
        </button>
        <button onClick={close} aria-label="Fermer" className="rounded p-1 text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="h-1 bg-white/10"><div className="h-full bg-[#e9c98b] transition-[width] duration-100 ease-linear" style={{ width: `${(left / DURATION) * 100}%` }} /></div>
    </div>
  )
}
