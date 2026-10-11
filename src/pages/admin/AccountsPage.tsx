import { apiErrorMessage } from '../../utils/retry'
import { confirmDialog, alertDialog } from '../../components/ui/dialog'
import { useEffect, useState } from 'react'
import { Search, KeyRound, RefreshCw, ShieldCheck, Loader2, AlertTriangle, Power , Trash2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import CredentialsModal from '../../components/ui/CredentialsModal'
import { usersApi, type ApiUser } from '../../api/users'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { confirmAccountDeletion } from '../../utils/confirmDeletion'

const ROLE_LABEL: Record<string, string> = {
  owner: 'Super Super Admin', super_admin: 'Super Admin', cooperative: 'Coopérative', agent: 'Agent',
}
const ROLE_COLOR: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  super_admin: 'bg-purple-100 text-purple-700',
  cooperative: 'bg-blue-100 text-blue-700',
  agent: 'bg-green-100 text-green-700',
}

export default function AccountsPage() {
  const me = useAuthStore((s) => s.user)
  // Le propriétaire gère et supprime tous les comptes (sauf le sien) ; un super admin, ceux de ses coopératives
  const isOwner = me?.role === 'owner'
  const canManage = (u: ApiUser) =>
    u.id !== me?.id && (isOwner || (u.role !== 'owner' && u.role !== 'super_admin'))
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const toggleCheck = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const deleteChecked = async () => {
    const list = users.filter((u) => checked.has(u.id))
    if (!list.length || !(await confirmAccountDeletion(list.map((u) => u.id), `${list.length} compte(s) (${list.slice(0, 6).map((u) => u.username).join(', ')}${list.length > 6 ? '…' : ''})`))) return
    setDeleting(true)
    try {
      const { data } = await usersApi.bulkDelete(list.map((u) => u.id))
      if (data.refused.length) await alertDialog({ tone: 'info', title: `${data.deleted} compte(s) supprimé(s)`, message: 'Non supprimé(s) :', details: data.refused.map((r) => `${r.username} : ${r.detail}`) })
      setChecked(new Set()); load(); useAppStore.getState().refreshData()
    } catch (err) { await alertDialog({ tone: 'danger', title: 'Suppression impossible', message: apiErrorMessage(err) }) } finally { setDeleting(false) }
  }
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
    if (!(await confirmDialog({ title: 'Réinitialiser le mot de passe ?', message: `Un mot de passe provisoire sera généré pour « ${u.full_name} » ; il devra le changer à sa prochaine connexion.`, confirmLabel: 'Réinitialiser' }))) return
    setResetting(u.id)
    try {
      const { data } = await usersApi.resetPassword(u.id)
      setCredentials({ name: data.full_name, username: data.username, password: data.new_password })
    } catch {
      await alertDialog({ tone: 'danger', title: 'Échec de la réinitialisation' })
    } finally {
      setResetting(null)
    }
  }

  const handleToggle = async (u: ApiUser) => {
    try {
      await usersApi.toggleActive(u.id)
      load()
    } catch (err) { await alertDialog({ tone: 'danger', title: 'Action impossible', message: apiErrorMessage(err) }) }
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
          <option value="super_admin">Super admins</option>
          {me?.role === 'owner' && <option value="owner">Super Super Admin</option>}
        </select>
        {isOwner && checked.size > 0 && (
          <button onClick={deleteChecked} disabled={deleting}
            className="flex items-center gap-2 border border-red-200 text-red-700 hover:bg-red-50 px-3 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Supprimer la sélection ({checked.size})
          </button>
        )}
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
                  {isOwner && <th className="pl-5 py-3 w-8">
                    <input type="checkbox" aria-label="Tout sélectionner"
                      checked={filtered.some((u) => canManage(u)) && filtered.filter(canManage).every((u) => checked.has(u.id))}
                      onChange={(e) => setChecked(e.target.checked ? new Set(filtered.filter(canManage).map((u) => u.id)) : new Set())} />
                  </th>}
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
                  <tr key={u.id} className={`hover:bg-gray-50 transition ${checked.has(u.id) ? 'bg-red-50/40' : ''}`}>
                    {isOwner && <td className="pl-5 py-3">
                      {canManage(u) && <input type="checkbox" checked={checked.has(u.id)} onChange={() => toggleCheck(u.id)} aria-label={`Sélectionner ${u.username}`} />}
                    </td>}
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
                        {canManage(u) && <button onClick={() => handleReset(u)} disabled={resetting === u.id}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium">
                          {resetting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                          Réinitialiser
                        </button>}
                        {isOwner && canManage(u) && (
                          <button onClick={async () => {
                            if (!(await confirmDialog({ title: 'Réinitialiser la double authentification ?', message: `${u.full_name} devra la reconfigurer à sa prochaine connexion (téléphone perdu ou changé).`, confirmLabel: 'Réinitialiser' }))) return
                            try { const { data } = await authApi.mfaReset(u.id); await alertDialog({ tone: 'success', title: 'Double authentification réinitialisée', message: data.detail }) }
                            catch (err) { await alertDialog({ tone: 'danger', title: 'Action impossible', message: apiErrorMessage(err) }) }
                          }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" /> 2FA
                          </button>
                        )}
                        {canManage(u) && (
                          <button onClick={() => handleToggle(u)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
                            <Power className="w-3.5 h-3.5" /> {u.is_active ? 'Désactiver' : 'Activer'}
                          </button>
                        )}
                        {canManage(u) && (
                          <button onClick={async () => {
                            if (!(await confirmAccountDeletion([u.id], `le compte « ${u.full_name} » (${u.username})`))) return
                            try { await usersApi.remove(u.id); load(); useAppStore.getState().refreshData() }
                            catch (err) { await alertDialog({ tone: 'danger', title: 'Suppression impossible', message: apiErrorMessage(err) }) }
                          }} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium">
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={isOwner ? 8 : 7} className="px-5 py-10 text-center text-sm text-gray-400">Aucun compte trouvé.</td></tr>
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
