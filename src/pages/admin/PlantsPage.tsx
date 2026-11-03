import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Factory, KeyRound, Plus } from 'lucide-react'
import Header from '../../components/layout/Header'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { alertDialog, promptDialog } from '../../components/ui/dialog'
import { useAppStore } from '../../store/appStore'
import { PLANT_ROLES, plantsApi, TRACE_MODES, type Plant, type PlantRole, type TraceMode } from '../../api/trace'
import { apiErrorMessage } from '../../utils/retry'

const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'

function CoopPicker({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const { cooperatives } = useAppStore()
  if (!cooperatives.length) return <p className="text-xs text-gray-500">Aucune coopérative.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {cooperatives.map((c) => (
        <label key={c.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${selected.has(c.id) ? 'border-primary-600 bg-primary-50 text-primary-800' : 'border-gray-200'}`}>
          <input type="checkbox" className="sr-only" checked={selected.has(c.id)}
            onChange={() => { const s = new Set(selected); if (s.has(c.id)) s.delete(c.id); else s.add(c.id); onChange(s) }} />{c.name}
        </label>
      ))}
    </div>
  )
}

/** Mode de traçabilité et seuils d'alerte d'une usine (enregistrés dès qu'ils changent). */
function PlantSettings({ plant, onSave }: { plant: Plant; onSave: (data: Parameters<typeof plantsApi.update>[1]) => void }) {
  const [gap, setGap] = useState(String(plant.gap_alert_pct))
  const [loss, setLoss] = useState(String(plant.loss_alert_pct))
  const commit = (field: 'gap_alert_pct' | 'loss_alert_pct', v: string, current: number) => {
    const n = Number(v.replace(',', '.'))
    if (n > 0 && n !== current) onSave({ [field]: n })
  }
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-3">
      <label className="text-xs text-gray-600 sm:col-span-3">Mode de traçabilité
        <select value={plant.traceability_mode} onChange={(e) => onSave({ traceability_mode: e.target.value as TraceMode })} className={input}>
          {(Object.keys(TRACE_MODES) as TraceMode[]).map((m) => <option key={m} value={m}>{TRACE_MODES[m].label}</option>)}
        </select>
        <span className="mt-1 block text-gray-500">{TRACE_MODES[plant.traceability_mode].help}</span>
      </label>
      <label className="text-xs text-gray-600">Alerte écart de transport (%)
        <input inputMode="decimal" value={gap} onChange={(e) => setGap(e.target.value)} onBlur={() => commit('gap_alert_pct', gap, plant.gap_alert_pct)} className={input} /></label>
      <label className="text-xs text-gray-600">Alerte perte à l'usinage (%)
        <input inputMode="decimal" value={loss} onChange={(e) => setLoss(e.target.value)} onBlur={() => commit('loss_alert_pct', loss, plant.loss_alert_pct)} className={input} /></label>
    </div>
  )
}

/** Usines du client : coopératives qui les livrent, comptes « usine » (réceptions, usinage, transformation). */
export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [coops, setCoops] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const load = () => plantsApi.list().then(({ data }) => setPlants(data)).catch(() => setPlants([]))
  useEffect(() => { load() }, [])

  const create = async () => {
    setBusy(true)
    try { await plantsApi.create({ name, location, cooperatives: [...coops] }); setAdding(false); setName(''); setLocation(''); setCoops(new Set()); load() }
    catch (err) { await alertDialog({ tone: 'danger', title: 'Création impossible', message: apiErrorMessage(err) }) } finally { setBusy(false) }
  }
  const update = async (p: Plant, data: Parameters<typeof plantsApi.update>[1]) => {
    try { await plantsApi.update(p.id, data); load() } catch (err) { await alertDialog({ tone: 'danger', title: 'Modification impossible', message: apiErrorMessage(err) }) }
  }
  const setRole = async (p: Plant, user: string, role: PlantRole) => {
    try { await plantsApi.setRole(p.id, user, role); load() } catch (err) { await alertDialog({ tone: 'danger', title: 'Modification impossible', message: apiErrorMessage(err) }) }
  }
  const account = async (p: Plant, role: PlantRole) => {
    const username = await promptDialog({ title: `${PLANT_ROLES[role].label} — ${p.name}`, label: 'Identifiant de connexion', placeholder: 'usine.sanpedro',
      confirmLabel: 'Créer le compte', validate: (v) => (/^[\w.@+-]{3,}$/.test(v.trim()) ? null : '3 caractères au moins, sans espace.') })
    if (!username) return
    try {
      const { data } = await plantsApi.createAccount(p.id, { username: username.trim(), full_name: p.name, plant_role: role })
      await alertDialog({ tone: 'success', title: 'Compte usine créé', message: `Identifiant : ${data.username}\nMot de passe provisoire : ${data.temporary_password}\n\nTransmettez-le à l'usine : il devra être changé à la première connexion. Il ne sera plus affiché.` })
      load()
    } catch (err) { await alertDialog({ tone: 'danger', title: 'Création impossible', message: apiErrorMessage(err) }) }
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Header title="Usines" subtitle="Usines et magasins d'exportation qui reçoivent les lots de vos coopératives" />
      <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
        Un compte usine voit uniquement les fiches d'accompagnement qui lui sont adressées. Le <b>responsable d'usine</b> enregistre la réception
        (poids, contrôle qualité), l'usinage, la transformation et les expéditions, et édite les certificats ; l'<b>opérateur de pesée</b> ne fait que
        réceptionner les camions. Aucun n'a accès aux producteurs ni aux autres données des coopératives.
      </p>
      {!adding && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Nouvelle usine</Button>}
      {adding && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-gray-600">Nom de l'usine<input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
            <label className="text-xs text-gray-600">Localité<input value={location} onChange={(e) => setLocation(e.target.value)} className={input} /></label>
          </div>
          <p className="text-xs text-gray-600">Coopératives qui livrent cette usine</p>
          <CoopPicker selected={coops} onChange={setCoops} />
          <div className="flex gap-2"><Button loading={busy} onClick={create} disabledReason={!name.trim() ? "Indiquez le nom de l'usine" : undefined}>Créer</Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>Annuler</Button></div>
        </section>
      )}
      {plants === null ? <p className="text-sm text-gray-500">Chargement…</p> : plants.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white"><EmptyState icon={<Factory className="h-7 w-7" />} title="Aucune usine"
          text="Créez l'usine ou le magasin qui reçoit les lots, choisissez les coopératives qui la livrent, puis créez son compte." /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {plants.map((p) => (
            <section key={p.id} className={`space-y-3 rounded-2xl border bg-white p-5 ${p.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start gap-3">
                <Factory className="mt-1 h-5 w-5 text-primary-700" />
                <div><p className="font-semibold text-gray-900">{p.name}</p><p className="text-sm text-gray-500">{p.location || '—'}</p></div>
                <span className="flex-1" />
                <Link to={`/admin/plants/${p.id}`} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary-700 hover:bg-primary-50"><BarChart3 className="h-4 w-4" />Activité</Link>
                <Button size="sm" variant={p.is_active ? 'secondary' : 'subtle'} onClick={() => update(p, { is_active: !p.is_active })}>{p.is_active ? 'Désactiver' : 'Réactiver'}</Button>
              </div>
              <div><p className="mb-1 text-xs text-gray-500">Coopératives qui la livrent</p>
                <CoopPicker selected={new Set(p.cooperatives.map((c) => c.id))} onChange={(s) => update(p, { cooperatives: [...s] })} /></div>
              <div>
                <p className="mb-1 text-xs text-gray-500">Comptes</p>
                {(p.accounts ?? []).length ? <ul className="divide-y divide-gray-100 text-sm">{p.accounts!.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span>{a.full_name} <span className="text-gray-400">· {a.username}{a.is_active ? '' : ' (désactivé)'}</span></span>
                    <select aria-label={`Rôle de ${a.username}`} value={a.plant_role} onChange={(e) => setRole(p, a.id, e.target.value as PlantRole)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs">
                      {(Object.keys(PLANT_ROLES) as PlantRole[]).map((r) => <option key={r} value={r}>{PLANT_ROLES[r].label}</option>)}
                    </select>
                  </li>))}</ul>
                  : <p className="text-sm text-gray-500">Aucun compte.</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {(Object.keys(PLANT_ROLES) as PlantRole[]).map((r) => (
                    <Button key={r} size="sm" variant="ghost" icon={<KeyRound className="h-4 w-4" />} onClick={() => account(p, r)}>Compte {PLANT_ROLES[r].label.toLowerCase()}</Button>
                  ))}
                </div>
              </div>
              <PlantSettings key={`${p.traceability_mode}${p.gap_alert_pct}${p.loss_alert_pct}`} plant={p} onSave={(data) => update(p, data)} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
