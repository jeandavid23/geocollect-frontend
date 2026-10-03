import { useCallback, useEffect, useState } from 'react'
import {
  Plus, X, Save, Loader2, ShieldCheck, ShieldOff, KeyRound, Trash2, Pencil, Building2, AlertTriangle, Search,
} from 'lucide-react'
import Header from '../../components/layout/Header'
import CredentialsModal from '../../components/ui/CredentialsModal'
import { useAppStore } from '../../store/appStore'
import {
  platformApi, MODULE_LABELS, ALL_MODULES, type PlatformAdmin, type AdminCreatePayload,
} from '../../api/platform'
import { apiErrorMessage } from '../../utils/retry'
import type { ModuleId } from '../../types'

interface FormState {
  full_name: string; organization: string; email: string; phone: string; username: string; password: string
  max_cooperatives: string; max_agents_per_coop: string; modules: ModuleId[]; expires_at: string; notes: string
}
const EMPTY: FormState = {
  full_name: '', organization: '', email: '', phone: '', username: '', password: '',
  max_cooperatives: '', max_agents_per_coop: '', modules: [...ALL_MODULES], expires_at: '', notes: '',
}
const toNum = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v))))

function formFromAdmin(a: PlatformAdmin): FormState {
  const l = a.license
  return {
    full_name: a.full_name, organization: l.organization || '', email: a.email || '', phone: a.phone || '',
    username: a.username, password: '',
    max_cooperatives: l.max_cooperatives == null ? '' : String(l.max_cooperatives),
    max_agents_per_coop: l.max_agents_per_coop == null ? '' : String(l.max_agents_per_coop),
    modules: l.modules ?? [...ALL_MODULES], expires_at: l.expires_at ?? '', notes: a.notes || '',
  }
}

function statusOf(a: PlatformAdmin) {
  if (!a.is_active) return { label: 'Suspendu', cls: 'bg-red-100 text-red-700' }
  if (a.license.is_expired) return { label: 'Abonnement expiré', cls: 'bg-amber-100 text-amber-800' }
  return { label: 'Actif', cls: 'bg-green-100 text-green-700' }
}

export default function SuperAdminsPage() {
  const { addNotification, cooperatives, updateCooperative } = useAppStore()
  const [admins, setAdmins] = useState<PlatformAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<PlatformAdmin | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [credentials, setCredentials] = useState<{ title: string; username: string; password: string } | null>(null)
  const [detail, setDetail] = useState<PlatformAdmin | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const { data } = await platformApi.admins()
      setAdmins(data)
    } catch (err) {
      addNotification({ type: 'error', title: 'Super admins', message: apiErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [addNotification])
  useEffect(() => { load() }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleModule = (m: ModuleId) =>
    set('modules', form.modules.includes(m) ? form.modules.filter((x) => x !== m) : [...form.modules, m])

  const openNew = () => { setForm(EMPTY); setFormError(''); setEditing('new') }
  const openEdit = (a: PlatformAdmin) => { setForm(formFromAdmin(a)); setFormError(''); setEditing(a) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setSaving(true); setFormError('')
    const license = {
      organization: form.organization.trim(),
      max_cooperatives: toNum(form.max_cooperatives),
      max_agents_per_coop: toNum(form.max_agents_per_coop),
      modules: form.modules,
      expires_at: form.expires_at || null,
      notes: form.notes,
    }
    try {
      if (editing === 'new') {
        const payload: AdminCreatePayload = {
          ...license, full_name: form.full_name.trim(), email: form.email.trim(), phone: form.phone.trim(),
          username: form.username.trim() || undefined, password: form.password || undefined,
        }
        const { data } = await platformApi.createAdmin(payload)
        setCredentials({ title: data.full_name, username: data.account_username, password: data.account_password })
      } else if (editing) {
        await platformApi.updateAdmin(editing.id, {
          ...license, full_name: form.full_name.trim(), email: form.email.trim(), phone: form.phone.trim(),
        })
        addNotification({ type: 'success', title: 'Super admin mis à jour', message: form.full_name })
      }
      setEditing(null)
      load()
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const first = data && Object.entries(data).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : String(v)}`)[0]
      setFormError(first || apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (a: PlatformAdmin) => {
    const suspend = a.is_active
    if (suspend && !confirm(`Suspendre « ${a.license.organization || a.full_name} » ?\n\nLe super admin, toutes ses coopératives et tous ses agents ne pourront plus se connecter (effet sous une minute).`)) return
    setBusyId(a.id)
    try {
      await platformApi.updateAdmin(a.id, { is_active: !a.is_active })
      addNotification({ type: suspend ? 'warning' : 'success', title: suspend ? 'Accès suspendu' : 'Accès réactivé', message: a.full_name })
      load()
    } catch (err) {
      addNotification({ type: 'error', title: 'Échec', message: apiErrorMessage(err) })
    } finally { setBusyId(null) }
  }

  const resetPassword = async (a: PlatformAdmin) => {
    if (!confirm(`Générer un nouveau mot de passe pour ${a.full_name} ? L'ancien ne fonctionnera plus.`)) return
    setBusyId(a.id)
    try {
      const { data } = await platformApi.resetPassword(a.id)
      setCredentials({ title: data.full_name, username: data.username, password: data.new_password })
    } catch (err) {
      addNotification({ type: 'error', title: 'Échec', message: apiErrorMessage(err) })
    } finally { setBusyId(null) }
  }

  const remove = async (a: PlatformAdmin) => {
    if (!confirm(`Supprimer définitivement le compte de ${a.full_name} ?`)) return
    setBusyId(a.id)
    try {
      await platformApi.deleteAdmin(a.id)
      addNotification({ type: 'success', title: 'Super admin supprimé', message: a.full_name })
      load()
    } catch (err) {
      addNotification({ type: 'error', title: 'Suppression impossible', message: apiErrorMessage(err) })
    } finally { setBusyId(null) }
  }

  const openDetail = async (a: PlatformAdmin) => {
    try {
      const { data } = await platformApi.admin(a.id)
      setDetail(data)
    } catch (err) {
      addNotification({ type: 'error', title: 'Détail', message: apiErrorMessage(err) })
    }
  }

  const transfer = async (coopId: string, target: string) => {
    try {
      const { data } = await platformApi.assignCooperative(coopId, target || null)
      updateCooperative(coopId, { managedBy: data.managed_by, managedByName: data.managed_by_name })
      addNotification({ type: 'success', title: 'Coopérative transférée', message: target ? (admins.find((x) => x.id === target)?.full_name ?? '') : 'Gérée par vous' })
      if (detail) openDetail(detail)
      load()
    } catch (err) {
      addNotification({ type: 'error', title: 'Transfert impossible', message: apiErrorMessage(err) })
    }
  }

  const q = search.trim().toLowerCase()
  const shown = admins.filter((a) => !q || `${a.full_name} ${a.username} ${a.license.organization} ${a.email}`.toLowerCase().includes(q))
  const input = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const quota = (used: number, max: number | null) => (max == null ? `${used} / illimité` : `${used} / ${max}`)

  return (
    <div className="p-6 space-y-5">
      <Header title="Super administrateurs" subtitle="Vos clients : comptes, abonnements, quotas et modules autorisés" />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client, un identifiant…"
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouveau super admin
        </button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-500">
          Aucun super admin. Créez-en un pour chaque client à qui vous vendez la plateforme.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {shown.map((a) => {
            const st = statusOf(a)
            const l = a.license
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">{l.organization || a.full_name}</p>
                    <p className="text-xs text-gray-500">{a.full_name} · <span className="font-mono">{a.username}</span></p>
                    <p className="text-xs text-gray-400">{a.email || '—'} {a.phone && `· ${a.phone}`}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-sm font-bold text-gray-800">{quota(l.cooperatives_used, l.max_cooperatives)}</p>
                    <p className="text-[11px] text-gray-500">Coopératives</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-sm font-bold text-gray-800">{l.agents_used}</p>
                    <p className="text-[11px] text-gray-500">Agents ({l.max_agents_per_coop == null ? 'illimité' : `${l.max_agents_per_coop} max/coop`})</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-2">
                    <p className="text-sm font-bold text-gray-800">{l.expires_at ? new Date(l.expires_at).toLocaleDateString('fr-FR') : 'Sans fin'}</p>
                    <p className="text-[11px] text-gray-500">Fin d'abonnement</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(l.modules ?? ALL_MODULES).map((m) => (
                    <span key={m} className="text-[11px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{MODULE_LABELS[m]}</span>
                  ))}
                  {l.modules && l.modules.length === 0 && <span className="text-[11px] text-gray-400">Fonctions de base uniquement</span>}
                </div>
                <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
                  <button onClick={() => openEdit(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100"><Pencil className="w-3.5 h-3.5" /> Droits</button>
                  <button onClick={() => openDetail(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100"><Building2 className="w-3.5 h-3.5" /> Coopératives</button>
                  <button onClick={() => resetPassword(a)} disabled={busyId === a.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100"><KeyRound className="w-3.5 h-3.5" /> Mot de passe</button>
                  <button onClick={() => toggleActive(a)} disabled={busyId === a.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${a.is_active ? 'text-amber-700 hover:bg-amber-50' : 'text-green-700 hover:bg-green-50'}`}>
                    {a.is_active ? <><ShieldOff className="w-3.5 h-3.5" /> Suspendre</> : <><ShieldCheck className="w-3.5 h-3.5" /> Réactiver</>}
                  </button>
                  <button onClick={() => remove(a)} disabled={busyId === a.id} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /> Supprimer</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Création / modification des droits */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-gray-900">{editing === 'new' ? 'Nouveau super admin' : `Droits de ${editing.full_name}`}</h3>
                <p className="text-xs text-gray-500">Le client ne verra que ses propres coopératives, agents et données.</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-5">
              <section className="space-y-3">
                <p className="text-sm font-semibold text-gray-800">Client</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-gray-600">Nom du responsable *<input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required className={`${input} mt-1`} /></label>
                  <label className="text-xs text-gray-600">Organisation cliente<input value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="ex. Exportateur ABC" className={`${input} mt-1`} /></label>
                  <label className="text-xs text-gray-600">E-mail<input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={`${input} mt-1`} /></label>
                  <label className="text-xs text-gray-600">Téléphone<input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={`${input} mt-1`} /></label>
                  {editing === 'new' && <>
                    <label className="text-xs text-gray-600">Identifiant (facultatif)<input value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="généré automatiquement" className={`${input} mt-1`} /></label>
                    <label className="text-xs text-gray-600">Mot de passe (facultatif)<input value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="généré automatiquement" className={`${input} mt-1`} /></label>
                  </>}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-sm font-semibold text-gray-800">Abonnement et quotas</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="text-xs text-gray-600">Coopératives max.<input type="number" min="0" value={form.max_cooperatives} onChange={(e) => set('max_cooperatives', e.target.value)} placeholder="illimité" className={`${input} mt-1`} /></label>
                  <label className="text-xs text-gray-600">Agents max. par coopérative<input type="number" min="0" value={form.max_agents_per_coop} onChange={(e) => set('max_agents_per_coop', e.target.value)} placeholder="illimité" className={`${input} mt-1`} /></label>
                  <label className="text-xs text-gray-600">Fin d'abonnement<input type="date" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} className={`${input} mt-1`} /></label>
                </div>
                <p className="text-[11px] text-gray-400">Champs vides = sans limite. À l'échéance, le client et toutes ses coopératives sont bloqués jusqu'au renouvellement.</p>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Modules autorisés</p>
                <p className="text-[11px] text-gray-400">Producteurs, parcelles, cartographie GPS, agents, carte et rapports sont toujours inclus.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {ALL_MODULES.map((m) => (
                    <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer border ${form.modules.includes(m) ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-600'}`}>
                      <input type="checkbox" checked={form.modules.includes(m)} onChange={() => toggleModule(m)} /> {MODULE_LABELS[m]}
                    </label>
                  ))}
                </div>
              </section>

              <label className="block text-xs text-gray-600">Notes internes (non visibles par le client)
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={`${input} mt-1`} />
              </label>

              {formError && <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3"><AlertTriangle className="w-4 h-4 mt-0.5" /> {formError}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editing === 'new' ? "Créer l'accès" : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coopératives d'un client + transfert */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Coopératives de {detail.license.organization || detail.full_name}</h3>
                <p className="text-xs text-gray-500">Transférez une coopérative vers un autre client, ou gardez-la sous votre gestion.</p>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-3">
              {(detail.cooperatives ?? []).length === 0 && <p className="text-sm text-gray-500">Aucune coopérative rattachée.</p>}
              {(detail.cooperatives ?? []).map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="flex-1 min-w-40">
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.region || '—'} · {c.n_agents} agent(s) {!c.is_active && '· désactivée'}</p>
                  </div>
                  <select defaultValue={detail.id} onChange={(e) => transfer(c.id, e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
                    {admins.map((a) => <option key={a.id} value={a.id}>{a.license.organization || a.full_name}</option>)}
                    <option value="">Moi (propriétaire)</option>
                  </select>
                </div>
              ))}
              {cooperatives.some((c) => !c.managedBy) && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Rattacher une de vos coopératives à ce client</p>
                  <div className="space-y-1.5">
                    {cooperatives.filter((c) => !c.managedBy).map((c) => (
                      <button key={c.id} onClick={() => transfer(c.id, detail.id)} className="w-full flex justify-between items-center px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm hover:bg-primary-50">
                        <span>{c.name}</span><span className="text-xs text-primary-700">Rattacher →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {credentials && (
        <CredentialsModal
          title="Accès super admin"
          subtitle={`Transmettez ces identifiants à ${credentials.title}. Le mot de passe ne sera plus affiché.`}
          username={credentials.username}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  )
}
