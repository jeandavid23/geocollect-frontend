import { useEffect, useState } from 'react'
import { Search, KeyRound, RefreshCw, ShieldCheck, Loader2, AlertTriangle, Power } from 'lucide-react'
import Header from '../../components/layout/Header'
import CredentialsModal from '../../components/ui/CredentialsModal'
import { usersApi, type ApiUser } from '../../api/users'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', cooperative: 'Coopérative', agent: 'Agent',
}
const ROLE_COLOR: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  cooperative: 'bg-blue-100 text-blue-700',
  agent: 'bg-green-100 text-green-700',
}

export default function AccountsPage() {
  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [resetting, setResetting] = useState<string | null>(null)
  const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await usersApi.list()
      const list = Array.isArray(data) ? data : data.results
      setUsers(list)
    } catch {
      setError("Impossible de charger les comptes — connectez-vous en admin avec un compte réel (backend) et vérifiez que le serveur est démarré.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const handleReset = async (u: ApiUser) => {
    if (!confirm(`Réinitialiser le mot de passe de « ${u.full_name} » ? Un nouveau mot de passe sera généré.`)) return
    setResetting(u.id)
    try {
      const { data } = await usersApi.resetPassword(u.id)
      setCredentials({ name: data.full_name, username: data.username, password: data.new_password })
    } catch {
      alert("Échec de la réinitialisation.")
    } finally {
      setResetting(null)
    }
  }

  const handleToggle = async (u: ApiUser) => {
    try {
      await usersApi.toggleActive(u.id)
      load()
    } catch { alert('Échec.') }
  }

  const filtered = users.filter((u) => {
    const s = !search || u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.cooperative_name ?? '').toLowerCase().includes(search.toLowerCase())
    const r = filterRole === 'all' || u.role === filterRole
    return s && r
  })

  return (
    <div className="p-6 space-y-5">
      <Header title="Comptes & Accès" subtitle="Tous les identifiants de la plateforme" />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-800">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>Les mots de passe sont chiffrés et ne peuvent pas être affichés. En cas d'oubli, utilisez <strong>« Réinitialiser »</strong> : un nouveau mot de passe est généré et envoyé par email à l'utilisateur.</span>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher identifiant, nom, coopérative..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none">
          <option value="all">Tous les rôles</option>
          <option value="cooperative">Coopératives</option>
          <option value="agent">Agents</option>
          <option value="super_admin">Admins</option>
        </select>
        <button onClick={load} className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-2.5 rounded-xl text-sm font-medium">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement des comptes...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3 text-sm text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="text-left px-5 py-3 font-medium">Nom</th>
                  <th className="text-left px-5 py-3 font-medium">Identifiant</th>
                  <th className="text-left px-5 py-3 font-medium">Rôle</th>
                  <th className="text-left px-5 py-3 font-medium">Coopérative</th>
                  <th className="text-left px-5 py-3 font-medium">Email</th>
                  <th className="text-left px-5 py-3 font-medium">Statut</th>
                  <th className="text-left px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{u.full_name}</td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-700">{u.username}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{u.cooperative_name ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{u.email ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleReset(u)} disabled={resetting === u.id}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                          {resetting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                          Réinitialiser
                        </button>
                        {u.role !== 'super_admin' && (
                          <button onClick={() => handleToggle(u)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
                            <Power className="w-3.5 h-3.5" /> {u.is_active ? 'Désactiver' : 'Activer'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">Aucun compte trouvé.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">{filtered.length} compte(s)</div>
        </div>
      )}

      {credentials && (
        <CredentialsModal
          title="Nouveau mot de passe généré"
          subtitle={credentials.name}
          username={credentials.username}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  )
}
