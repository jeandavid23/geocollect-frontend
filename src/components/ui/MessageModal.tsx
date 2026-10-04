import { useEffect, useState } from 'react'
import { Send, X, Loader2, AlertTriangle } from 'lucide-react'
import { messagesApi, type MessageTarget } from '../../api/notifications'
import { useAppStore } from '../../store/appStore'
import { apiErrorMessage } from '../../utils/retry'

interface Props {
  open: boolean
  onClose: () => void
  defaultTarget?: string          // clé proposée par défaut (ex. « agents », « my_cooperatives »)
  defaultTitle?: string
}

/** Envoi d'un message aux personnes de sa hiérarchie (la liste des destinataires vient du serveur). */
export default function MessageModal({ open, onClose, defaultTarget, defaultTitle }: Props) {
  const addNotification = useAppStore((s) => s.addNotification)
  const [targets, setTargets] = useState<MessageTarget[] | null>(null)
  const [target, setTarget] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [level, setLevel] = useState<'info' | 'warning' | 'success'>('info')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError(''); setTitle(defaultTitle ?? ''); setMessage(''); setLevel('info')
    messagesApi.targets().then(({ data }) => {
      setTargets(data)
      setTarget(data.find((t) => t.key === defaultTarget)?.key ?? data[0]?.key ?? '')
    }).catch((err) => { setTargets([]); setError(apiErrorMessage(err)) })
  }, [open, defaultTarget, defaultTitle])

  if (!open) return null

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || !title.trim()) return
    setBusy(true); setError('')
    try {
      const { data } = await messagesApi.send({ target, title: title.trim(), message: message.trim(), level })
      addNotification({ type: 'success', title: 'Message envoyé', message: `${data.sent} destinataire(s) prévenu(s).` })
      onClose()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  return (
    <div className="fixed inset-0 z-[1500] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={send} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold text-gray-900 flex items-center gap-2"><Send className="w-4 h-4 text-primary-600" /> Envoyer un message</p>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <label className="block text-xs text-gray-600">Destinataires
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={input} disabled={!targets}>
            {!targets && <option>Chargement…</option>}
            {targets?.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-600">Objet
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={input} placeholder="Ex. : Réunion des agents lundi 8 h" />
        </label>
        <label className="block text-xs text-gray-600">Message
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={4} className={input} placeholder="Votre message…" />
        </label>
        <div className="flex gap-2 text-xs">
          {([['info', 'Information', 'bg-blue-50 text-blue-700'], ['warning', 'Important', 'bg-amber-50 text-amber-800'], ['success', 'Bonne nouvelle', 'bg-green-50 text-green-700']] as const).map(([k, l, c]) => (
            <button type="button" key={k} onClick={() => setLevel(k)} className={`px-3 py-1.5 rounded-lg font-medium ${level === k ? c + ' ring-2 ring-offset-1 ring-primary-400' : 'bg-gray-50 text-gray-500'}`}>{l}</button>
          ))}
        </div>
        {error && <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3"><AlertTriangle className="w-4 h-4 mt-0.5" /> {error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={busy || !target || !title.trim()} className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer
          </button>
        </div>
      </form>
    </div>
  )
}
