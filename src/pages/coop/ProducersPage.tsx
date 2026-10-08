import { useMemo, useState } from 'react'
import { Search, Plus, MapPin, X, Save, FileSpreadsheet, Trash2, Hash } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import type { Producer } from '../../types'
import { generateFieldIdBase, getNextProducerIndex } from '../../utils/fieldId'
import { apiErrorMessage } from '../../utils/retry'
import ProducerEditPanel from '../../components/producers/ProducerEditPanel'
import ProducerImportModal from '../../components/producers/ProducerImportModal'
import ProducerRecodeModal from '../../components/producers/ProducerRecodeModal'
import { producersApi } from '../../api/producers'
import { mapProducer } from '../../api/mappers'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  gender: 'M' as 'M' | 'F',
  birthYear: '',
  village: '',
  section: '',
  region: 'Bélier',
  nationalId: '',
}

export default function ProducersPage() {
  const user = useAuthStore((s) => s.user)
  const { producers, parcels, addProducer, addNotification, isLive } = useAppStore()
  const coopId = user?.cooperativeId ?? 'coop-001'
  const coopProducers = producers.filter((p) => p.cooperativeId === coopId)

  const [search, setSearch] = useState('')
  const [filterSection, setFilterSection] = useState('all')
  const [selected, setSelected] = useState<Producer | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [mapFilter, setMapFilter] = useState<'all' | 'todo' | 'done'>('all')
  const [deleting, setDeleting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showImport, setShowImport] = useState(false)
  const [showRecode, setShowRecode] = useState(false)

  // Entêtes des fichiers Excel importés (dans l'ordre du fichier) : colonnes de la vue « Fichier Excel »
  const excelHeaders = useMemo(() => {
    const seen = new Set<string>()
    for (const p of coopProducers) for (const k of Object.keys(p.extraData ?? {})) seen.add(k)
    return [...seen]
  }, [coopProducers])
  const [view, setView] = useState<'excel' | 'standard'>('excel')
  const showExcel = view === 'excel' && excelHeaders.length > 0

  // polygones d'un producteur = parcelles mappées (à jour en direct) + anciens polygones rattachés par son code
  const mappedCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const pc of parcels) m.set(pc.producerId, (m.get(pc.producerId) ?? 0) + 1)
    return m
  }, [parcels])
  const polys = (p: Producer) => (mappedCount.get(p.id) ?? 0) + (p.legacyPolygonCount ?? 0)
  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const deleteChecked = async () => {
    const ids = [...checked]
    if (!ids.length || !window.confirm(`Supprimer ${ids.length} producteur(s) ? Ceux qui ont des parcelles mappées ou une fiche de lot seront conservés.`)) return
    setDeleting(true)
    try {
      if (isLive) {
        const { data } = await producersApi.bulkDelete(ids)
        addNotification({ type: data.protected ? 'warning' : 'success', title: `${data.deleted} producteur(s) supprimé(s)`,
          message: data.protected ? `${data.protected} conservé(s) (parcelles mappées ou fiche de lot) : ${data.protected_codes.slice(0, 5).join(', ')}${data.protected > 5 ? '…' : ''}` : 'Suppression terminée.' })
        useAppStore.getState().refreshData()
      } else {
        useAppStore.getState().removeProducers(ids)
      }
      setChecked(new Set())
    } catch (err) {
      addNotification({ type: 'error', title: 'Suppression impossible', message: apiErrorMessage(err) })
    } finally { setDeleting(false) }
  }

  const sections = [...new Set(coopProducers.map((p) => p.section))]
  const filtered = coopProducers.filter((p) => {
    const matchSearch = !search ||
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.village.toLowerCase().includes(search.toLowerCase()) ||
      p.fieldIdBase.toLowerCase().includes(search.toLowerCase()) ||
      Object.values(p.extraData ?? {}).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
    const matchSection = filterSection === 'all' || p.section === filterSection
    const n = polys(p)
    const matchMap = mapFilter === 'all' || (mapFilter === 'todo' ? n === 0 : n > 0)
    return matchSearch && matchSection && matchMap
  })

  // Pagination : 100 lignes par page (des milliers de producteurs après un import Excel)
  const PAGE = 100
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(currentPage * PAGE, (currentPage + 1) * PAGE)
  // Parcelles par producteur, calculées une fois (au lieu d'un filtre par ligne)
  const parcelsByProducer = useMemo(() => {
    const m = new Map<string, { n: number; ha: number }>()
    for (const parc of parcels) {
      const v = m.get(parc.producerId) ?? { n: 0, ha: 0 }
      v.n += 1; v.ha += parc.areaHectares
      m.set(parc.producerId, v)
    }
    return m
  }, [parcels])

  const pager = (
    <div className="flex items-center gap-2">
      <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}
        className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40">‹ Précédent</button>
      <span>Page {currentPage + 1} / {pageCount}</span>
      <button disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}
        className="px-2.5 py-1 rounded-lg border border-gray-200 disabled:opacity-40">Suivant ›</button>
    </div>
  )

  const setField = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  // FIELD ID preview based on current form section
  const previewFieldId = form.section
    ? generateFieldIdBase(form.section, getNextProducerIndex(producers, form.section))
    : '—'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim() || !form.section.trim()) return

    // ─── Mode live : enregistre dans la BASE DE DONNÉES ──────────────────────
    if (isLive) {
      try {
        const { data } = await producersApi.create({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          phone: form.phone.trim(),
          national_id: form.nationalId.trim(),
          gender: form.gender,
          birth_year: form.birthYear ? Number(form.birthYear) : undefined,
          village: form.village.trim(),
          section: form.section.trim().toUpperCase(),
          region: form.region.trim(),
        })
        const created = mapProducer(data as Record<string, unknown>)
        addProducer(created)
        addNotification({ type: 'success', title: 'Producteur enregistré', message: `${created.fullName} — ${created.fieldIdBase}` })
        setForm(EMPTY_FORM)
        setShowForm(false)
        return
      } catch {
        addNotification({ type: 'error', title: 'Échec', message: 'Enregistrement en base impossible. Vérifiez la connexion.' })
        return
      }
    }

    // ─── Mode démo : local ───────────────────────────────────────────────────
    const fieldIdBase = generateFieldIdBase(form.section, getNextProducerIndex(producers, form.section))
    addProducer({
      id: crypto.randomUUID(),
      cooperativeId: coopId,
      fieldIdBase,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      fullName: `${form.lastName.trim().toUpperCase()} ${form.firstName.trim()}`,
      phone: form.phone.trim() || undefined,
      village: form.village.trim(),
      section: form.section.trim().toUpperCase(),
      region: form.region.trim(),
      country: "Côte d'Ivoire",
      nationalId: form.nationalId.trim() || undefined,
      gender: form.gender,
      birthYear: form.birthYear ? Number(form.birthYear) : undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      assignedAgentId: undefined,
      parcelCount: 0,
      totalHectares: 0,
    })
    addNotification({ type: 'success', title: 'Producteur enregistré', message: `${form.lastName.toUpperCase()} ${form.firstName} — ${fieldIdBase}` })
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  return (
    <div className="p-6 space-y-5">
      <Header title="Producteurs" subtitle={`${coopProducers.length} producteurs enregistrés`} />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Rechercher producteur, village, FIELD ID..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterSection}
          onChange={(e) => { setFilterSection(e.target.value); setPage(0) }}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none"
        >
          <option value="all">Toutes les sections</option>
          {sections.map((s) => <option key={s} value={s}>{s || '(sans section)'}</option>)}
        </select>
        {excelHeaders.length > 0 && (
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
            <button onClick={() => setView('excel')} className={`px-3 py-2.5 ${view === 'excel' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Fichier Excel</button>
            <button onClick={() => setView('standard')} className={`px-3 py-2.5 ${view === 'standard' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>Vue standard</button>
          </div>
        )}
        <select value={mapFilter} onChange={(e) => { setMapFilter(e.target.value as 'all' | 'todo' | 'done'); setPage(0) }}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" title="Producteurs avec ou sans polygone">
          <option value="all">Tous les producteurs</option>
          <option value="todo">À mapper (sans polygone)</option>
          <option value="done">Cartographiés</option>
        </select>
        {checked.size > 0 && (
          <button onClick={deleteChecked} disabled={deleting}
            className="flex items-center gap-2 border border-red-200 text-red-700 hover:bg-red-50 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            <Trash2 className="w-4 h-4" /> Supprimer la sélection ({checked.size})
          </button>
        )}
        {excelHeaders.length > 0 && (
          <button onClick={() => setShowRecode(true)} title="Reprendre le code producteur du registre (sans générer de code)"
            className="flex items-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-medium">
            <Hash className="w-4 h-4" /> Codes du registre
          </button>
        )}
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
        >
          <FileSpreadsheet className="w-4 h-4" /> Importer Excel
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Nouveau producteur
        </button>
      </div>

      {/* Vue « Fichier Excel » : les colonnes sont les entêtes du fichier importé */}
      {showExcel && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-green-50 text-xs text-green-900">
                  <th className="px-3 py-3"><input type="checkbox" aria-label="Tout sélectionner (page)" checked={pageRows.length > 0 && pageRows.every((p) => checked.has(p.id))}
                    onChange={(e) => setChecked((c) => { const n = new Set(c); pageRows.forEach((p) => (e.target.checked ? n.add(p.id) : n.delete(p.id))); return n })} /></th>
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Code producteur</th>
                  {excelHeaders.map((h) => <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Polygones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageRows.map((p) => (
                  <tr key={p.id} className={`hover:bg-gray-50 cursor-pointer ${checked.has(p.id) ? 'bg-primary-50/60' : ''}`} onClick={() => setSelected(p)}>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} /></td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">{p.fieldIdBase}</td>
                    {excelHeaders.map((h) => {
                      const v = p.extraData?.[h]
                      return <td key={h} className={`px-4 py-2 whitespace-nowrap ${typeof v === 'number' ? 'text-right' : ''} text-gray-700`}>{v === undefined || v === null ? '' : String(v)}</td>
                    })}
                    <td className="px-4 py-2 whitespace-nowrap">{polys(p) > 0
                      ? <span className="text-gray-800">{polys(p)}</span>
                      : <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">À mapper</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
            <span>{filtered.length} sur {coopProducers.length} producteurs · {excelHeaders.length} colonne(s) du fichier</span>
            {pageCount > 1 && pager}
          </div>
        </div>
      )}

      {/* Table */}
      {!showExcel && <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-3 py-3"><input type="checkbox" aria-label="Tout sélectionner (page)" checked={pageRows.length > 0 && pageRows.every((p) => checked.has(p.id))}
                  onChange={(e) => setChecked((c) => { const n = new Set(c); pageRows.forEach((p) => (e.target.checked ? n.add(p.id) : n.delete(p.id))); return n })} /></th>
                <th className="text-left px-5 py-3 font-medium">Producteur</th>
                <th className="text-left px-5 py-3 font-medium">Code producteur</th>
                <th className="text-left px-5 py-3 font-medium">Village</th>
                <th className="text-left px-5 py-3 font-medium">Section</th>
                <th className="text-left px-5 py-3 font-medium">Polygones</th>
                <th className="text-left px-5 py-3 font-medium">Superficie</th>
                <th className="text-left px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageRows.map((p) => {
                const stat = parcelsByProducer.get(p.id)
                const totalHa = stat?.ha ?? 0
                return (
                  <tr key={p.id} className={`hover:bg-gray-50 transition cursor-pointer ${checked.has(p.id) ? 'bg-primary-50/60' : ''}`} onClick={() => setSelected(p)}>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          p.gender === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {p.firstName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{p.fullName}</p>
                          <p className="text-xs text-gray-400">{p.gender === 'F' ? 'Femme' : 'Homme'}{p.birthYear ? ` · né en ${p.birthYear}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-gray-700">{p.fieldIdBase}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{p.village}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-lg font-medium">{p.section}</span>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{polys(p) > 0 ? polys(p) : <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">À mapper</span>}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{totalHa.toFixed(2)} ha</td>
                    <td className="px-5 py-3">
                      <button className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> Modifier / supprimer
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-400">
                    Aucun producteur trouvé. Cliquez sur « Nouveau producteur » pour en ajouter un.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
          <span>{filtered.length} sur {coopProducers.length} producteurs</span>
          {pageCount > 1 && pager}
        </div>
      </div>}

      {showRecode && <ProducerRecodeModal cooperativeId={coopId} onClose={() => setShowRecode(false)} />}
      {showImport && <ProducerImportModal cooperativeId={coopId} onClose={() => setShowImport(false)} />}

      {/* ─── New producer form modal ─────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h3 className="font-bold text-gray-900">Nouveau producteur</h3>
                <p className="text-xs text-gray-500">Saisissez les informations du producteur</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="KONAN"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setField('firstName', e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Jean"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="+225 07 ..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pièce d'identité</label>
                  <input
                    value={form.nationalId}
                    onChange={(e) => setField('nationalId', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="CNI / N° ..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setField('gender', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="M">Homme</option>
                    <option value="F">Femme</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Année de naissance</label>
                  <input
                    type="number"
                    value={form.birthYear}
                    onChange={(e) => setField('birthYear', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="1980"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Village</label>
                  <input
                    value={form.village}
                    onChange={(e) => setField('village', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Akakro"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section *</label>
                  <input
                    value={form.section}
                    onChange={(e) => setField('section', e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="BEOUMI"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Région</label>
                <input
                  value={form.region}
                  onChange={(e) => setField('region', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                <p className="font-semibold mb-0.5">FIELD ID généré automatiquement</p>
                <p className="font-mono text-base">{previewFieldId}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl transition"
                >
                  <Save className="w-4 h-4" /> Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fiche producteur : modification (tout champ peut être vidé) et suppression */}
      {selected && (
        <ProducerEditPanel key={selected.id} producer={selected} polygonCount={polys(selected)} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
