import { useState } from 'react'
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, User as UserIcon, Loader2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'

export default function AccountPage() {
  const user = useAuthStore((s) => s.user)
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const roleLabel =
    user?.role === 'super_admin' ? 'Super Administrateur' :
    user?.role === 'cooperative' ? 'Coopérative' : 'Agent Mappeur'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (newPwd.length < 6) { setMsg({ type: 'err', text: 'Le nouveau mot de passe doit faire au moins 6 caractères.' }); return }
    if (newPwd !== confirm) { setMsg({ type: 'err', text: 'Les deux mots de passe ne correspondent pas.' }); return }
    setLoading(true)
    try {
      await authApi.changePassword(oldPwd, newPwd)
      setMsg({ type: 'ok', text: 'Mot de passe modifié avec succès.' })
      setOldPwd(''); setNewPwd(''); setConfirm('')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const text = detail?.old_password ? 'Mot de passe actuel incorrect.'
        : detail?.detail ? String(detail.detail)
        : "Échec — vérifiez votre connexion au serveur."
      setMsg({ type: 'err', text })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-5">
      <Header title="Mon compte" subtitle="Gérez vos informations et votre mot de passe" />

      {/* Profile card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-700 font-black text-xl">
          {user?.fullName?.charAt(0) ?? <UserIcon className="w-6 h-6" />}
        </div>
        <div>
          <p className="font-bold text-gray-900">{user?.fullName}</p>
          <p className="text-sm text-gray-500">{roleLabel}</p>
          <p className="text-xs font-mono text-gray-400 mt-0.5">Identifiant : {user?.username}</p>
        </div>
      </div>

      {/* Change password */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-2 text-gray-800">
          <KeyRound className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold">Changer mon mot de passe</h3>
        </div>

        {msg && (
          <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
          <input type={show ? 'text' : 'password'} value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} required
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required
              className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
          <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} required
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {loading ? 'Modification...' : 'Modifier le mot de passe'}
        </button>
      </form>
    </div>
  )
}
