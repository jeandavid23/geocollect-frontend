import { Search, Plus, Eye, Users, Leaf, X, Save, Loader2 } from 'lucide-react'
import { useState } from 'react'
import Header from '../../components/layout/Header'
import { useAppStore } from '../../store/appStore'
import CredentialsModal from '../../components/ui/CredentialsModal'
import { cooperativesApi } from '../../api/cooperatives'
import type { Cooperative } from '../../types'

const EMPTY_FORM = {
  name: '', region: '', country: "Côte d'Ivoire",
  rccm: '', agrement: '', pca: '', adg: '', director: '', sigManager: '',
  phone: '', email: '', address: '',
}

export default function CooperativesPage() {
  const { cooperatives, producers, parcels, agents, addCooperative, addNotification } = useAppStore()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selected, setSelected] = useState<Cooperative | null>(null)
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(null)

  const filtered = cooperatives.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.region.toLowerCase().includes(search.toLowerCase())
  )

  const setField = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    const localId = crypto.randomUUID()
    const baseCoop: Cooperative = {
      id: localId,
      name: form.name.trim(),
      rccm: form.rccm.trim(), agrement: form.agrement.trim(),
      pca: form.pca.trim(), adg: form.adg.trim(), director: form.director.trim(),
      sigManager: form.sigManager.trim(), phone: form.phone.trim(),
      email: form.email.trim(), address: form.address.trim(),
      region: form.region.trim(), country: form.country.trim(),
      isActive: true, createdAt: new Date().toISOString(),
      producerCount: 0, parcelCount: 0, totalHectares: 0, agentCount: 0,
    }

    try {
      // Create the cooperative + its login account on the Django backend
      const { data } = await cooperativesApi.create({
        name: form.name.trim(),
        region: form.region.trim(), country: form.country.trim(),
        rccm: form.rccm.trim(), agrement: form.agrement.trim(),
        pca: form.pca.trim(), adg: form.adg.trim(), director: form.director.trim(),
        sig_manager: form.sigManager.trim(), phone: form.phone.trim(),
        email: form.email.trim(), address: form.address.trim(),
      })
      addCooperative({ ...baseCoop, id: data.id })
      setForm(EMPTY_FORM)
      setShowForm(false)
      setCredentials({ name: data.name, username: data.account_username, password: data.account_password })
    } catch {
      // Backend unreachable → create locally only (no login account)
      addCooperative(baseCoop)
      addNotification({
        type: 'warning',
        title: 'Coopérative créée (hors ligne)',
        message: 'Aucun compte de connexion généré — backend Django injoignable. Démarrez le serveur pour créer des accès.',
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  // Live counts for a cooperative
  const counts = (id: string) => ({
    producers: producers.filter((p) => p.cooperativeId === id).length,
    parcels: parcels.filter((p) => p.cooperativeId === id).length,
    agents: agents.filter((a) => a.cooperativeId === id).length,
  })

  return (
    <div className="p-6 space-y-5">
      <Header title="Gestion des Coopératives" subtitle={`${cooperatives.length} coopératives actives`} />

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une coopérative..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Nouvelle coopérative
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((c) => {
          const ct = counts(c.id)
          return (
            <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Leaf className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.region} · {c.country}</p>
                  </div>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Active</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{ct.producers}</p>
                  <p className="text-xs text-gray-400">Producteurs</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{ct.parcels}</p>
                  <p className="text-xs text-gray-400">Parcelles</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2 text-center">
                  <p className="text-lg font-bold text-gray-800">{ct.agents}</p>
                  <p className="text-xs text-gray-400">Agents</p>
                </div>
              </div>

              <div className="space-y-1 text-xs text-gray-600 mb-4">
                <p><span className="text-gray-400">RCCM:</span> {c.rccm || '—'}</p>
                <p><span className="text-gray-400">PCA:</span> {c.pca || '—'}</p>
                <p><span className="text-gray-400">Resp. SIG:</span> {c.sigManager || '—'}</p>
                <p><span className="text-gray-400">Email:</span> {c.email || '—'}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-primary-200 text-primary-600 hover:bg-primary-50 py-2 rounded-xl text-xs font-medium transition"
                >
                  <Eye className="w-3.5 h-3.5" /> Voir
                </button>
                <button
                  onClick={() => setSelected(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-primary-50 hover:bg-primary-100 text-primary-700 py-2 rounded-xl text-xs font-medium transition"
                >
                  <Users className="w-3.5 h-3.5" /> Agents
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── New cooperative form modal ───────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900">Nouvelle coopérative</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la coopérative *</label>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)} required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="COOPACI BEOUMI" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Région</label>
                  <input value={form.region} onChange={(e) => setField('region', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Bélier" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
                  <input value={form.country} onChange={(e) => setField('country', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RCCM</label>
                  <input value={form.rccm} onChange={(e) => setField('rccm', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agrément</label>
                  <input value={form.agrement} onChange={(e) => setField('agrement', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PCA</label>
                  <input value={form.pca} onChange={(e) => setField('pca', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsable SIG</label>
                  <input value={form.sigManager} onChange={(e) => setField('sigManager', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input value={form.phone} onChange={(e) => setField('phone', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input value={form.address} onChange={(e) => setField('address', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated login credentials */}
      {credentials && (
        <CredentialsModal
          title="Accès coopérative créé"
          subtitle={credentials.name}
          username={credentials.username}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}

      {/* ─── Detail panel ─────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-100 z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Détails coopérative</h3>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto bg-primary-100 flex items-center justify-center">
                <Leaf className="w-8 h-8 text-primary-600" />
              </div>
              <p className="font-bold text-gray-900 mt-2">{selected.name}</p>
              <p className="text-xs text-gray-500">{selected.region} · {selected.country}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(() => { const ct = counts(selected.id); return [
                { label: 'Producteurs', value: ct.producers },
                { label: 'Parcelles', value: ct.parcels },
                { label: 'Agents', value: ct.agents },
              ]})().map(({ label, value }) => (
                <div key={label} className="bg-primary-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-primary-700">{value}</p>
                  <p className="text-xs text-primary-600">{label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { label: 'RCCM', value: selected.rccm },
                { label: 'Agrément', value: selected.agrement },
                { label: 'PCA', value: selected.pca },
                { label: 'ADG', value: selected.adg },
                { label: 'Directeur', value: selected.director },
                { label: 'Resp. SIG', value: selected.sigManager },
                { label: 'Téléphone', value: selected.phone },
                { label: 'Email', value: selected.email },
                { label: 'Adresse', value: selected.address },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value || '—'}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase">Agents</p>
              {agents.filter((a) => a.cooperativeId === selected.id).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                  <span className="font-medium text-gray-700">{a.fullName}</span>
                  <span className="text-xs text-gray-500 font-mono">{a.code}</span>
                </div>
              ))}
              {agents.filter((a) => a.cooperativeId === selected.id).length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucun agent enregistré.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
