import { useLang } from '../../i18n'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react'
import Button from './Button'

/**
 * Fenêtres de dialogue aux couleurs de GeoCollect, à la place des fenêtres grises du navigateur :
 *   if (!(await confirmDialog({ title, message, tone: 'danger' }))) return
 *   await alertDialog({ title, message })
 *   const name = await promptDialog({ title, label, defaultValue })
 * Échap annule, Entrée valide. Un seul `<DialogHost />` est monté dans l'application.
 */
type Tone = 'primary' | 'danger' | 'success' | 'info'
interface Base { title: string; message?: React.ReactNode; details?: string[]; tone?: Tone }
export interface ConfirmOptions extends Base {
  confirmLabel?: string; cancelLabel?: string
  requireText?: string                 // ex. « SUPPRIMER » : à saisir pour valider
  /** 3e choix (ex. « Ne pas enregistrer ») : la promesse renvoie alors 'alt' */
  altLabel?: string
}
export interface PromptOptions extends Base { label?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; validate?: (v: string) => string | null }

type Request =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean | 'alt') => void }
  | { kind: 'alert'; opts: Base & { confirmLabel?: string }; resolve: () => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }

let queue: Request[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const push = (r: Request) => { queue = [...queue, r]; emit() }
const shift = () => { queue = queue.slice(1); emit() }

export function confirmDialog(opts: ConfirmOptions & { altLabel: string }): Promise<boolean | 'alt'>
export function confirmDialog(opts: ConfirmOptions): Promise<boolean>
export function confirmDialog(opts: ConfirmOptions) {
  return new Promise<boolean | 'alt'>((resolve) => push({ kind: 'confirm', opts, resolve }))
}
export const alertDialog = (opts: Base & { confirmLabel?: string }) =>
  new Promise<void>((resolve) => push({ kind: 'alert', opts, resolve }))
export const promptDialog = (opts: PromptOptions) =>
  new Promise<string | null>((resolve) => push({ kind: 'prompt', opts, resolve }))

const ICON = {
  danger: <AlertTriangle className="h-5 w-5 text-red-600" />,
  primary: <Info className="h-5 w-5 text-primary-700" />,
  info: <Info className="h-5 w-5 text-sky-700" />,
  success: <CheckCircle2 className="h-5 w-5 text-green-600" />,
}
const RING = { danger: 'bg-red-50', primary: 'bg-primary-50', info: 'bg-sky-50', success: 'bg-green-50' }

export function DialogHost() {
  const current = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => queue[0])
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  const en = useLang((s) => s.lang) === 'en'

  useEffect(() => {
    setError(null)
    setText(current?.kind === 'prompt' ? current.opts.defaultValue ?? '' : '')
    const t = setTimeout(() => (inputRef.current ?? okRef.current)?.focus(), 30)
    return () => clearTimeout(t)
  }, [current])

  if (!current) return null
  const o = current.opts
  const tone: Tone = o.tone ?? (current.kind === 'confirm' ? 'primary' : 'info')
  const needText = current.kind === 'confirm' ? current.opts.requireText : undefined
  const blocked = !!needText && text.trim().toUpperCase() !== needText.toUpperCase()

  const cancel = () => {
    if (current.kind === 'confirm') current.resolve(false)
    else if (current.kind === 'prompt') current.resolve(null)
    else current.resolve()
    shift()
  }
  const ok = () => {
    if (current.kind === 'confirm') { if (blocked) return; current.resolve(true) }
    else if (current.kind === 'prompt') {
      const v = text.trim()
      const err = current.opts.validate?.(v) ?? null
      if (err) { setError(err); return }
      current.resolve(v)
    } else current.resolve()
    shift()
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancel() }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel() } if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); ok() } }}>
      <div role="dialog" aria-modal="true" aria-labelledby="gc-dialog-title"
        className="w-full max-w-md animate-[login-card-in_.35s_cubic-bezier(.2,.8,.2,1)_both] rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${RING[tone]}`}>{ICON[tone]}</span>
          <div className="min-w-0 flex-1">
            <h2 id="gc-dialog-title" className="text-base font-semibold text-gray-900">{o.title}</h2>
            {o.message && <div className="mt-1 whitespace-pre-line text-sm text-gray-600">{o.message}</div>}
            {!!o.details?.length && (
              <ul className="mt-3 max-h-48 space-y-1 overflow-auto rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                {o.details.map((d, i) => <li key={i} className="flex gap-2"><span className="text-gray-400">•</span>{d}</li>)}
              </ul>
            )}
          </div>
          <button onClick={cancel} aria-label="Fermer" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>

        {(current.kind === 'prompt' || needText) && (
          <label className="mt-4 block text-xs text-gray-600">
            {current.kind === 'prompt' ? current.opts.label : <>Pour confirmer, saisissez <b className="text-red-700">{needText}</b></>}
            <input ref={inputRef} value={text} onChange={(e) => { setText(e.target.value); setError(null) }}
              placeholder={current.kind === 'prompt' ? current.opts.placeholder : needText}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:border-primary-600 focus:ring-primary-600/30'}`} />
            {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
          </label>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {current.kind !== 'alert' && <Button variant="secondary" onClick={cancel}>{current.kind === 'confirm' ? current.opts.cancelLabel ?? (en ? 'Cancel' : 'Annuler') : (en ? 'Cancel' : 'Annuler')}</Button>}
          {current.kind === 'confirm' && current.opts.altLabel && (
            <Button variant="secondary" onClick={() => { current.resolve('alt'); shift() }}>{current.opts.altLabel}</Button>
          )}
          <Button ref={okRef} variant={tone === 'danger' ? 'danger' : 'primary'} onClick={ok}
            disabledReason={blocked ? `Saisissez ${needText} pour confirmer` : undefined}>
            {o && 'confirmLabel' in o && o.confirmLabel ? o.confirmLabel : current.kind === 'alert' ? (en ? 'OK' : 'Compris') : current.kind === 'prompt' ? (en ? 'Confirm' : 'Valider') : (en ? 'Confirm' : 'Confirmer')}
          </Button>
        </div>
      </div>
    </div>
  )
}
