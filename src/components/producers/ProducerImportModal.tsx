import { useMemo, useRef, useState } from 'react'
import { X, Upload, Download, CheckCircle2, AlertTriangle, Save, FileSpreadsheet, BookOpen } from 'lucide-react'
import {
  readWorkbook, detectHeaderRow, headersOf, autoMapping, buildProducerRows, buildProducerTemplate,
  PRODUCER_FIELDS, type ParsedWorkbook,
} from '../../utils/excelImport'
import { downloadBlob } from '../../utils/geoExport'
import { producersApi } from '../../api/producers'
import { registryApi } from '../../api/registry'
import { mapProducer } from '../../api/mappers'
import { useAppStore } from '../../store/appStore'
import { generateFieldIdBase, getNextProducerIndex } from '../../utils/fieldId'
import type { Producer } from '../../types'

interface Props {
  cooperativeId: string
  onClose: () => void
}

const CHUNK = 500

export default function ProducerImportModal({ cooperativeId, onClose }: Props) {
  const { producers, addProducer, addNotification, isLive } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)

  const [wb, setWb] = useState<ParsedWorkbook | null>(null)
  const [sheetIdx, setSheetIdx] = useState(0)
  const [headerRow, setHeaderRow] = useState(0)
  const [mapping, setMapping] = useState<string[]>([])
  const [defaults, setDefaults] = useState({ section: '', region: '' })
  const [saveRegistry, setSaveRegistry] = useState(true)
  const [registryMode, setRegistryMode] = useState<'replace' | 'merge'>('merge')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [rejected, setRejected] = useState<{ excelRow: number; message: string }[]>([])
  const [done, setDone] = useState(false) // import déjà envoyé : évite un doublon en recliquant

  const sheet = wb?.sheets[sheetIdx]
  const headers = useMemo(() => (sheet ? headersOf(sheet.values, headerRow) : []), [sheet, headerRow])

  const selectSheet = (w: ParsedWorkbook, idx: number) => {
    const s = w.sheets[idx]
    const hr = detectHeaderRow(s.values)
    setSheetIdx(idx)
    setHeaderRow(hr)
    setMapping(autoMapping(headersOf(s.values, hr)))
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    setError(''); setRejected([]); setDone(false)
    try {
      const parsed = await readWorkbook(file)
      const withData = parsed.sheets.map((s, i) => [i, s.values.length] as const).filter(([, n]) => n > 1)
      if (!withData.length) throw new Error('Le classeur ne contient aucune donnée.')
      // Feuille par défaut : celle qui a le plus de lignes
      const [bestIdx] = withData.reduce((a, b) => (b[1] > a[1] ? b : a))
      setWb(parsed)
      selectSheet(parsed, bestIdx)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lire ce fichier Excel.')
    }
  }

  const changeHeaderRow = (row: number) => {
    if (!sheet) return
    setHeaderRow(row)
    setMapping(autoMapping(headersOf(sheet.values, row)))
  }

  const setColumnField = (col: number, field: string) =>
    setMapping((m) => m.map((f, i) => (i === col ? field : f === field && field ? '' : f)))

  const rows = useMemo(
    () => (sheet ? buildProducerRows(sheet.values, headerRow, mapping, defaults) : []),
    [sheet, headerRow, mapping, defaults],
  )
  const validRows = rows.filter((r) => r.errors.length === 0)
  const hasName = mapping.includes('fullName') || (mapping.includes('lastName') && mapping.includes('firstName'))
  const hasSection = mapping.includes('section') || defaults.section.trim() !== ''

  const sheetsForRegistry = () => (wb?.sheets ?? [])
    .filter((s) => s.data.length)
    .map((s, i) => ({ name: s.name.slice(0, 100), data: s.data, col_widths: s.colWidths, position: i }))

  const doImport = async () => {
    if (!wb || !validRows.length) return
    setBusy(true); setError(''); setRejected([])

    // ─── Mode démo : enregistrement local ────────────────────────────────
    if (!isLive) {
      const counters: Record<string, number> = {}
      for (const r of validRows) {
        const p = r.payload
        const section = p.section
        counters[section] = counters[section] === undefined ? getNextProducerIndex(producers, section) : counters[section] + 1
        const local: Producer = {
          id: crypto.randomUUID(), cooperativeId, fieldIdBase: generateFieldIdBase(section, counters[section]),
          firstName: p.first_name, lastName: p.last_name, fullName: `${p.last_name} ${p.first_name}`,
          phone: p.phone, village: p.village ?? '', section, region: p.region ?? '', country: "Côte d'Ivoire",
          nationalId: p.national_id, gender: p.gender, birthYear: p.birth_year, isActive: true,
          createdAt: new Date().toISOString(), parcelCount: 0, totalHectares: 0, extraData: p.extra_data,
        }
        addProducer(local)
      }
      addNotification({ type: 'success', title: 'Import terminé (mode démo)', message: `${validRows.length} producteur(s) ajouté(s) localement.` })
      setBusy(false)
      onClose()
      return
    }

    // ─── Mode connecté : envoi par lots ──────────────────────────────────
    let created = 0
    const errs: { excelRow: number; message: string }[] = []
    try {
      for (let start = 0; start < validRows.length; start += CHUNK) {
        const chunk = validRows.slice(start, start + CHUNK)
        setProgress(`Enregistrement des producteurs… ${Math.min(start + CHUNK, validRows.length)}/${validRows.length}`)
        const { data } = await producersApi.bulk(chunk.map((r) => r.payload))
        data.created.forEach((p) => addProducer(mapProducer(p)))
        created += data.created.length
        for (const e of data.errors) {
          const msg = Object.entries(e.errors).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · ')
          errs.push({ excelRow: chunk[e.index]?.excelRow ?? 0, message: msg })
        }
      }

      if (saveRegistry) {
        setProgress('Enregistrement du classeur dans le registre…')
        await registryApi.importWorkbook(sheetsForRegistry(), wb.fileName, registryMode)
      }

      addNotification({
        type: created ? 'success' : 'error',
        title: 'Import Excel terminé',
        message: `${created} producteur(s) enregistré(s)${errs.length ? `, ${errs.length} ligne(s) rejetée(s)` : ''}${saveRegistry ? ' · registre mis à jour' : ''}.`,
      })
      setDone(true)
      if (errs.length) setRejected(errs)
      else onClose()
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(`${detail ?? 'Échec de l\'enregistrement.'} ${created ? `(${created} producteur(s) déjà enregistré(s))` : ''}`)
      if (errs.length) setRejected(errs)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const input = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-gray-900">Importer des producteurs (Excel)</h3>
            <p className="text-xs text-gray-500">Toutes les colonnes du fichier sont conservées sous leur entête d'origine</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* 1. Fichier */}
          <div className="flex flex-wrap items-center gap-3">
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.xlsm,.csv,.ods" onChange={onFile} className="hidden" />
            <button onClick={() => inputRef.current?.click()} disabled={busy}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
              <Upload className="w-4 h-4" /> {wb ? 'Changer de fichier' : 'Choisir un fichier Excel'}
            </button>
            {wb && <span className="flex items-center gap-1.5 text-sm text-gray-700"><FileSpreadsheet className="w-4 h-4 text-green-600" />{wb.fileName} · {wb.sheets.length} feuille(s)</span>}
            <button onClick={() => downloadBlob(buildProducerTemplate(), 'modele_import_producteurs.xlsx')}
              className="ml-auto inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-medium text-xs">
              <Download className="w-3.5 h-3.5" /> Modèle Excel
            </button>
          </div>

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </p>
          )}

          {wb && sheet && (
            <>
              {/* 2. Feuille, ligne d'entêtes, valeurs par défaut */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="text-xs text-gray-600">Feuille des producteurs
                  <select value={sheetIdx} onChange={(e) => selectSheet(wb, Number(e.target.value))} className={`${input} w-full mt-1`}>
                    {wb.sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({Math.max(s.values.length - 1, 0)} lignes)</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600">Ligne des entêtes
                  <input type="number" min={1} max={Math.max(sheet.values.length, 1)} value={headerRow + 1}
                    onChange={(e) => changeHeaderRow(Math.max(0, Number(e.target.value) - 1))} className={`${input} w-full mt-1`} />
                </label>
                <label className="text-xs text-gray-600">Section par défaut {mapping.includes('section') ? '(si vide)' : '*'}
                  <input value={defaults.section} onChange={(e) => setDefaults((d) => ({ ...d, section: e.target.value }))}
                    placeholder="ex. BEOUMI" className={`${input} w-full mt-1`} />
                </label>
                <label className="text-xs text-gray-600">Région par défaut
                  <input value={defaults.region} onChange={(e) => setDefaults((d) => ({ ...d, region: e.target.value }))}
                    placeholder="ex. Bélier" className={`${input} w-full mt-1`} />
                </label>
              </div>

              {/* 3. Correspondance des colonnes */}
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Colonnes du fichier ({headers.length})</p>
                <p className="text-xs text-gray-500 mb-2">
                  Chaque colonne est enregistrée telle quelle dans la fiche du producteur. Associez celles qui correspondent
                  aux champs de GeoCollect (nom, section…) : elles servent à créer le producteur et son FIELD ID.
                </p>
                <div className="border border-gray-100 rounded-xl max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {headers.map((h, c) => {
                    const sample = sheet.values.slice(headerRow + 1).map((r) => r[c]).find((v) => v !== null && v !== '')
                    return (
                      <div key={c} className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 text-sm">
                        <span className="col-span-4 font-medium text-gray-800 truncate" title={h}>{h}</span>
                        <span className="col-span-3 text-xs text-gray-400 truncate" title={String(sample ?? '')}>{String(sample ?? '—')}</span>
                        <select value={mapping[c] ?? ''} onChange={(e) => setColumnField(c, e.target.value)}
                          className={`col-span-5 px-2 py-1.5 border rounded-lg text-xs ${mapping[c] ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-500'}`}>
                          <option value="">Conservée dans la fiche uniquement</option>
                          {PRODUCER_FIELDS.map((f) => <option key={f.key} value={f.key}>→ {f.label}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>
                {!hasName && <p className="text-xs text-red-600 mt-1">Associez une colonne « Nom » et une colonne « Prénom(s) », ou une colonne « Nom et prénoms ».</p>}
                {!hasSection && <p className="text-xs text-red-600 mt-1">Associez une colonne « Section » ou saisissez une section par défaut.</p>}
              </div>

              {/* 4. Aperçu */}
              <div>
                <div className="flex items-center gap-4 text-sm mb-2">
                  <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="w-4 h-4" /> {validRows.length} prêt(s)</span>
                  {rows.length - validRows.length > 0 && (
                    <span className="flex items-center gap-1.5 text-red-600"><AlertTriangle className="w-4 h-4" /> {rows.length - validRows.length} incomplet(s), ignoré(s)</span>
                  )}
                </div>
                <div className="border border-gray-100 rounded-xl overflow-auto max-h-56">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Ligne</th><th className="text-left px-3 py-2">Nom</th>
                        <th className="text-left px-3 py-2">Prénom(s)</th><th className="text-left px-3 py-2">Village</th>
                        <th className="text-left px-3 py-2">Section</th><th className="text-left px-3 py-2">Colonnes</th>
                        <th className="text-left px-3 py-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.slice(0, 100).map((r) => (
                        <tr key={r.excelRow} className={r.errors.length ? 'bg-red-50' : ''}>
                          <td className="px-3 py-1.5 text-gray-400">{r.excelRow}</td>
                          <td className="px-3 py-1.5">{r.payload.last_name || '—'}</td>
                          <td className="px-3 py-1.5">{r.payload.first_name || '—'}</td>
                          <td className="px-3 py-1.5">{r.payload.village || '—'}</td>
                          <td className="px-3 py-1.5">{r.payload.section || '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500">{Object.keys(r.payload.extra_data ?? {}).length}</td>
                          <td className="px-3 py-1.5">{r.errors.length ? <span className="text-red-600">{r.errors.join(', ')}</span> : <span className="text-green-600">✓</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 100 && <p className="text-xs text-gray-400 mt-1">Aperçu des 100 premières lignes sur {rows.length}.</p>}
              </div>

              {/* 5. Registre */}
              <div className="bg-amber-50 rounded-xl p-4 text-sm space-y-2">
                <label className="flex items-center gap-2 font-medium text-amber-900">
                  <input type="checkbox" checked={saveRegistry} onChange={(e) => setSaveRegistry(e.target.checked)} />
                  <BookOpen className="w-4 h-4" /> Enregistrer aussi le classeur complet dans le Registre
                </label>
                <p className="text-xs text-amber-800">
                  Les {wb.sheets.filter((s) => s.data.length).length} feuille(s) sont copiées avec leurs entêtes et leurs formules.
                </p>
                {saveRegistry && (
                  <div className="flex flex-wrap gap-4 text-xs text-amber-900">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" checked={registryMode === 'merge'} onChange={() => setRegistryMode('merge')} />
                      Ajouter ces feuilles (une feuille de même nom est remplacée)
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" checked={registryMode === 'replace'} onChange={() => setRegistryMode('replace')} />
                      Remplacer tout le registre
                    </label>
                  </div>
                )}
              </div>

              {rejected.length > 0 && (
                <div className="bg-red-50 rounded-xl p-3 text-xs text-red-800 max-h-40 overflow-y-auto">
                  <p className="font-semibold mb-1">{rejected.length} ligne(s) refusée(s) par le serveur :</p>
                  {rejected.map((r, i) => <p key={i}>Ligne {r.excelRow} — {r.message}</p>)}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50">
                  {rejected.length ? 'Fermer' : 'Annuler'}
                </button>
                <button onClick={doImport} disabled={busy || done || !validRows.length || !hasName || !hasSection}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl">
                  <Save className="w-4 h-4" /> {busy ? (progress || 'Import…') : `Enregistrer ${validRows.length} producteur(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
