import { useState } from 'react'
import { KeyRound, Copy, Check, X, AlertTriangle } from 'lucide-react'

interface Props {
  title: string
  subtitle: string
  username: string
  password: string
  onClose: () => void
}

export default function CredentialsModal({ title, subtitle, username, password, onClose }: Props) {
  const [copied, setCopied] = useState<'user' | 'pass' | 'both' | null>(null)

  const copy = (text: string, which: 'user' | 'pass' | 'both') => {
    navigator.clipboard?.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  const Field = ({ label, value, which }: { label: string; value: string; which: 'user' | 'pass' }) => (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <code className="text-base font-mono font-bold text-gray-900 break-all">{value}</code>
        <button onClick={() => copy(value, which)} className="p-1.5 hover:bg-gray-200 rounded-lg flex-shrink-0" title="Copier">
          {copied === which ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Notez bien ces identifiants — le mot de passe ne sera <strong>plus affiché</strong> après fermeture. Transmettez-les à la personne concernée.
            </p>
          </div>

          <Field label="Identifiant de connexion" value={username} which="user" />
          <Field label="Mot de passe" value={password} which="pass" />

          <button
            onClick={() => copy(`Identifiant: ${username}\nMot de passe: ${password}`, 'both')}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 transition text-sm"
          >
            {copied === 'both' ? <><Check className="w-4 h-4 text-green-600" /> Copié</> : <><Copy className="w-4 h-4" /> Copier les deux</>}
          </button>

          <button
            onClick={onClose}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl transition"
          >
            J'ai noté les identifiants
          </button>
        </div>
      </div>
    </div>
  )
}
