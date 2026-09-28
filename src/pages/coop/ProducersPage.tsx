import { useMemo, useState } from 'react'
import { Search, Plus, MapPin, X, Save, FileSpreadsheet } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import type { Producer } from '../../types'
import { generateFieldIdBase, getNextProducerIndex } from '../../utils/fieldId'
import ProducerImportModal from '../../components/producers/ProducerImportModal'
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
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showImport, setShowImport] = useState(false)

  // Entêtes des fichiers Excel importés (dans l'ordre du fichier) : colonnes de la vue « Fichier Excel »
  const excelHeaders = useMemo(() => {
    const seen = new Set<string>()
    for (const p of coopProducers) for (const k of Object.keys(p.extraData ?? {})) seen.add(k)
    return [...seen]
  }, [coopProducers])
  const [view, setView] = useState<'excel' | 'standard'>('excel')
  const showExcel = view === 'excel' && excelHeaders.length > 0

  const sections = [...new Set(coopProducers.map((p) => p.section))]
  const filtered = coopProducers.filter((p) => {
    const matchSearch = !search ||
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.village.toLowerCase().includes(search.toLowerCase()) ||
      p.fieldIdBase.toLowerCase().includes(search.toLowerCase()) ||
      Object.values(p.extraData ?? {}).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
    const matchSection = filterSection === 'all' || p.section === filterSection
    return matchSearch && matchSection
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
        addNotification({ type: 'success', title: 'Producteur enregistré en base ✓', message: `${created.fullName} — ${created.fieldIdBase}` })
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
      assignedAgentId: 'agent-001',
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
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">FIELD ID</th>
                  {excelHeaders.map((h) => <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Parcelles mappées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pageRows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(p)}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">{p.fieldIdBase}</td>
                    {excelHeaders.map((h) => {
                      const v = p.extraData?.[h]
                      return <td key={h} className={`px-4 py-2 whitespace-nowrap ${typeof v === 'number' ? 'text-right' : ''} text-gray-700`}>{v === undefined || v === null ? '' : String(v)}</td>
                    })}
                    <td className="px-4 py-2 text-center">{parcelsByProducer.get(p.id)?.n ?? 0}</td>
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
                <th className="text-left px-5 py-3 font-medium">Producteur</th>
                <th className="text-left px-5 py-3 font-medium">FIELD ID Base</th>
                <th className="text-left px-5 py-3 font-medium">Village</th>
                <th className="text-left px-5 py-3 font-medium">Section</th>
                <th className="text-left px-5 py-3 font-medium">Parcelles</th>
                <th className="text-left px-5 py-3 font-medium">Superficie</th>
                <th className="text-left px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageRows.map((p) => {
                const stat = parcelsByProducer.get(p.id)
                const totalHa = stat?.ha ?? 0
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setSelected(p)}>
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
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{stat?.n ?? 0}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">{totalHa.toFixed(2)} ha</td>
                    <td className="px-5 py-3">
                      <button className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> Voir les parcelles
                      </button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
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

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-100 z-50 flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Fiche Producteur</h3>
            <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-2xl font-black ${
                selected.gender === 'F' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {selected.firstName.charAt(0)}
              </div>
              <p className="font-bold text-gray-900 mt-2">{selected.fullName}</p>
              <p className="text-xs font-mono text-gray-500">{selected.fieldIdBase}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Village', value: selected.village },
                { label: 'Section', value: selected.section },
                { label: 'Région', value: selected.region },
                { label: 'Pays', value: selected.country },
                { label: 'Genre', value: selected.gender === 'F' ? 'Femme' : 'Homme' },
                { label: 'Naissance', value: selected.birthYear?.toString() ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value}</p>
                </div>
              ))}
            </div>
            {selected.extraData && Object.keys(selected.extraData).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase">Données du fichier Excel</p>
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {Object.entries(selected.extraData).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 px-3 py-1.5 text-xs">
                      <span className="text-gray-500">{k}</span>
                      <span className="font-medium text-gray-800 text-right break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-primary-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-primary-700">{parcels.filter((p) => p.producerId === selected.id).length}</p>
                <p className="text-xs text-primary-600">Parcelles</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-green-700">
                  {parcels.filter((p) => p.producerId === selected.id).reduce((s, p) => s + p.areaHectares, 0).toFixed(1)}
                </p>
                <p className="text-xs text-green-600">Hectares</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase">Parcelles</p>
              {parcels
                .filter((p) => p.producerId === selected.id)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm">
                    <span className="font-mono text-gray-700">{p.fieldId}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{p.areaHectares.toFixed(2)} ha</span>
                      <span className={`w-2 h-2 rounded-full ${
                        p.eudrStatus === 'compliant' ? 'bg-green-500' :
                        p.eudrStatus === 'non_compliant' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                    </div>
                  </div>
                ))}
              {parcels.filter((p) => p.producerId === selected.id).length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucune parcelle enregistrée.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
