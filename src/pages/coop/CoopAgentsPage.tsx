import { useState } from 'react'
import { Plus, X, Save, Trash2, MapPin, Phone, Mail, Power, Loader2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import CredentialsModal from '../../components/ui/CredentialsModal'
import { agentsApi } from '../../api/agents'
import type { Agent } from '../../types'

const EMPTY_FORM = { fullName: '', phone: '', email: '', zone: '' }

export default function CoopAgentsPage() {
  const user = useAuthStore((s) => s.user)
  const { agents, parcels, producers, cooperatives, addAgent, removeAgent, toggleAgentActive, addNotification } = useAppStore()
  const coopId = user?.cooperativeId ?? 'coop-001'
  const coop = cooperatives.find((c) => c.id === coopId)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<Agent | null>(null)
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(null)

  const coopAgents = agents.filter((a) => a.cooperativeId === coopId)
  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const stats = (agentId: string) => {
    const ap = parcels.filter((p) => p.agentId === agentId)
    return {
      parcels: ap.length,
      hectares: ap.reduce((s, p) => s + p.areaHectares, 0),
      producers: producers.filter((p) => p.assignedAgentId === agentId).length,
    }
  }

  // Generate a unique agent code, e.g. AG-BEOU-004
  const nextCode = () => {
    const prefix = `AG-${(coop?.name ?? 'COOP').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}`
    const n = coopAgents.length + 1
    return `${prefix}-${String(n).padStart(3, '0')}`
  }

  const MAX_AGENTS = 10

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim()) return
    if (coopAgents.length >= MAX_AGENTS) {
      addNotification({ type: 'warning', title: 'Limite atteinte', message: `Maximum ${MAX_AGENTS} agents par coopérative.` })
      return
    }
    setSaving(true)

    const code = nextCode()
    const baseAgent: Agent = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      cooperativeId: coopId,
      code,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      zone: form.zone.trim() || 'Non assignée',
      isActive: true,
      createdAt: new Date().toISOString(),
      parcelCount: 0,
      hectares: 0,
    }

    try {
      // Create the agent + its login account on the Django backend
      const { data } = await agentsApi.create({
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        code,
        zone: form.zone.trim() || 'Non assignée',
      })
      addAgent({ ...baseAgent, id: data.id, code: data.code || code })
      setForm(EMPTY_FORM)
      setShowForm(false)
      setCredentials({ name: baseAgent.fullName, username: data.account_username, password: data.account_password })
    } catch {
      // Backend unreachable → local only (no login account)
      addAgent(baseAgent)
      addNotification({
        type: 'warning',
        title: 'Agent ajouté (hors ligne)',
        message: 'Aucun compte de connexion généré — backend Django injoignable. Démarrez le serveur pour créer des accès.',
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (agent: Agent) => {
    removeAgent(agent.id)
    addNotification({ type: 'info', title: 'Agent retiré', message: `${agent.fullName} ne fait plus partie de la coopérative.` })
    setConfirmDelete(null)
  }

  return (
    <div className="p-6 space-y-5">
      <Header title="Agents de la coopérative" subtitle={`${coopAgents.length} agents mappeurs`} />

      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
          <Plus className="w-4 h-4" /> Ajouter un agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {coopAgents.map((a) => {
          const st = stats(a.id)
          return (
            <div key={a.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                  a.isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {a.fullName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{a.fullName}</p>
                  <p className="text-xs text-gray-500 font-mono">{a.code}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {a.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-600 mb-4">
                <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {a.zone}</p>
                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> {a.phone || '—'}</p>
                <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> {a.email || '—'}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{st.parcels}</p>
                  <p className="text-xs text-gray-400">Parcelles</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{st.hectares.toFixed(1)}</p>
                  <p className="text-xs text-gray-400">Ha</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{st.producers}</p>
                  <p className="text-xs text-gray-400">Prod.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => toggleAgentActive(a.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 py-2 rounded-xl text-xs font-medium transition">
                  <Power className="w-3.5 h-3.5" /> {a.isActive ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => setConfirmDelete(a)}
                  className="flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 py-2 px-3 rounded-xl text-xs font-medium transition">
                  <Trash2 className="w-3.5 h-3.5" /> Retirer
                </button>
              </div>
            </div>
          )
        })}
        {coopAgents.length === 0 && (
          <p className="col-span-full text-center text-sm text-gray-400 py-10">
            Aucun agent. Cliquez sur « Ajouter un agent » pour commencer.
          </p>
        )}
      </div>

      {/* Add agent modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Ajouter un agent mappeur</h3>
                <p className="text-xs text-gray-500">Code attribué : <span className="font-mono">{nextCode()}</span></p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                <input value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Kouassi Bernard" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input value={form.phone} onChange={(e) => setField('phone', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="+225 07 ..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="agent@..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone d'intervention</label>
                <input value={form.zone} onChange={(e) => setField('zone', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Zone Nord-Beoumi" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Création...' : 'Créer l\'accès'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated login credentials */}
      {credentials && (
        <CredentialsModal
          title="Accès agent créé"
          subtitle={credentials.name}
          username={credentials.username}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="font-bold text-gray-900">Retirer cet agent ?</h3>
            <p className="text-sm text-gray-500 mt-1">
              <strong>{confirmDelete.fullName}</strong> ne fera plus partie de la coopérative. Cette action est irréversible.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition">Retirer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
