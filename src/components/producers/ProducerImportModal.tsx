import { saveImportReport, registryImportReport } from '../../utils/report'
import { useMemo, useRef, useState } from 'react'
import { X, Upload, Download, CheckCircle2, AlertTriangle, Save, FileSpreadsheet, BookOpen } from 'lucide-react'
import {
  readWorkbook, detectHeaderRow, headersOf, autoMapping, buildProducerRows, buildProducerTemplate,
  PRODUCER_FIELDS, type ParsedWorkbook,
} from '../../utils/excelImport'
import { downloadBlob } from '../../utils/geoExport'
import { producersApi } from '../../api/producers'
import { registryApi } from '../../api/registry'
import { mapProducer, firstText } from '../../api/mappers'
import { useAppStore } from '../../store/appStore'
import { withRetry, apiErrorMessage } from '../../utils/retry'
import { generateFieldIdBase, getNextProducerIndex } from '../../utils/fieldId'
import type { Producer } from '../../types'

interface Props {
  cooperativeId: string
  onClose: () => void
}

const CHUNK = 1000

export default function ProducerImportModal({ cooperativeId, onClose }: Props) {
  const { producers, addProducers, addNotification, isLive } = useAppStore()
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
  const [done, setDone] = useState(false)
  const [excluded, setExcluded] = useState<Set<number>>(new Set()) // lignes Excel à ne pas enregistrer (ex. « Total »)
  const [savedRows, setSavedRows] = useState<Set<number>>(new Set()) // lignes déjà enregistrées (reprise sans doublon)
  const [registrySaved, setRegistrySaved] = useState(false) // import déjà envoyé : évite un doublon en recliquant

  const sheet = wb?.sheets[sheetIdx]
  const headers = useMemo(() => (sheet ? headersOf(sheet.values, headerRow) : []), [sheet, headerRow])

  const selectSheet = (w: ParsedWorkbook, idx: number) => {
    const s = w.sheets[idx]
    const hr = detectHeaderRow(s.values)
    setSheetIdx(idx)
    setHeaderRow(hr)
    setExcluded(new Set())
    setMapping(autoMapping(headersOf(s.values, hr)))
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    setError(''); setRejected([]); setDone(false); setSavedRows(new Set()); setRegistrySaved(false)
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
    setExcluded(new Set())
    setMapping(autoMapping(headersOf(sheet.values, row)))
  }

  const setColumnField = (col: number, field: string) =>
    setMapping((m) => m.map((f, i) => (i === col ? field : f === field && field ? '' : f)))

  const rows = useMemo(
    () => (sheet ? buildProducerRows(sheet.values, headerRow, mapping, defaults) : []),
    [sheet, headerRow, mapping, defaults],
  )
  // Aucune colonne obligatoire : toutes les lignes non vides sont enregistrées, sauf celles décochées
  const validRows = rows.filter((r) => !excluded.has(r.excelRow))
  const toggleRow = (excelRow: number) => setExcluded((ex) => {
    const next = new Set(ex)
    if (next.has(excelRow)) next.delete(excelRow); else next.add(excelRow)
    return next
  })

  const sheetsForRegistry = () => (wb?.sheets ?? [])
    .filter((s) => s.data.length)
    .map((s, i) => ({ name: s.name.slice(0, 100), data: s.data, col_widths: s.colWidths, position: i }))

  // Lignes restant à envoyer (après un échec partiel, seules celles-ci sont renvoyées : pas de doublon)
  const pendingRows = validRows.filter((r) => !savedRows.has(r.excelRow))

  const doImport = async () => {
    if (!wb || !pendingRows.length) return
    setBusy(true); setError(''); setRejected([])

    // ─── Mode démo : enregistrement local ────────────────────────────────
    if (!isLive) {
      const counters: Record<string, number> = {}
      const locals: Producer[] = pendingRows.map((r) => {
        const p = r.payload
        const section = p.section || 'PROD'
        counters[section] = counters[section] === undefined ? getNextProducerIndex(producers, section) : counters[section] + 1
        return {
          id: crypto.randomUUID(), cooperativeId, fieldIdBase: generateFieldIdBase(section, counters[section]),
          firstName: p.first_name, lastName: p.last_name, fullName: `${p.last_name ?? ''} ${p.first_name ?? ''}`.trim() || firstText(p.extra_data),
          phone: p.phone, village: p.village ?? '', section, region: p.region ?? '', country: "Côte d'Ivoire",
          nationalId: p.national_id, gender: p.gender, birthYear: p.birth_year, isActive: true,
          createdAt: new Date().toISOString(), parcelCount: 0, totalHectares: 0, extraData: p.extra_data,
        }
      })
      addProducers(locals)
      addNotification({ type: 'success', title: 'Import terminé (mode démo)', message: `${locals.length} producteur(s) ajouté(s) localement.` })
      setBusy(false)
      onClose()
      return
    }

    // ─── Mode connecté : lots de 1000, 3 tentatives par lot, on continue si un lot échoue ──
    let created = 0
    const saved = new Set(savedRows)
    const errs: { excelRow: number; message: string }[] = []
    let lastError = ''
    const total = pendingRows.length
    for (let start = 0; start < total; start += CHUNK) {
      const chunk = pendingRows.slice(start, start + CHUNK)
      const label = `Enregistrement des producteurs… ${Math.min(start + CHUNK, total)}/${total}`
      setProgress(label)
      try {
        const { data } = await withRetry(
          () => producersApi.bulk(chunk.map((r) => r.payload)),
          3,
          (n) => setProgress(`${label} (nouvelle tentative ${n}/2)`),
        )
        if (!Array.isArray(data.created)) {
          // refus global du lot (ex. coopérative manquante) : inutile d'envoyer les suivants
          lastError = (data as { detail?: string }).detail ?? 'Lot refusé par le serveur.'
          break
        }
        addProducers(data.created.map((p) => mapProducer(p)))
        created += data.created.length
        const rejectedIdx = new Set(data.errors.map((e) => e.index))
        chunk.forEach((r, i) => { if (!rejectedIdx.has(i)) saved.add(r.excelRow) })
        for (const e of data.errors) {
          const msg = Object.entries(e.errors).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · ')
          errs.push({ excelRow: chunk[e.index]?.excelRow ?? 0, message: msg })
          saved.add(chunk[e.index]?.excelRow ?? -1) // ligne refusée : inutile de la renvoyer telle quelle
        }
      } catch (err) {
        lastError = apiErrorMessage(err)
      }
      setSavedRows(new Set(saved))
    }
    const remaining = validRows.filter((r) => !saved.has(r.excelRow)).length

    if (saveRegistry && !registrySaved && remaining === 0) {
      setProgress('Enregistrement du classeur dans le registre…')
      try {
        await withRetry(() => registryApi.importWorkbook(sheetsForRegistry(), wb.fileName, registryMode))
        setRegistrySaved(true)
      } catch (err) {
        lastError = `Producteurs enregistrés, mais le registre n'a pas pu l'être : ${apiErrorMessage(err)}`
      }
    }

    setBusy(false)
    setProgress('')
    if (errs.length) setRejected(errs)
    addNotification({
      type: remaining ? 'error' : 'success',
      title: remaining ? 'Import Excel incomplet' : 'Import Excel terminé',
      message: `${created} producteur(s) enregistré(s)${remaining ? `, ${remaining} en attente` : ''}${errs.length ? `, ${errs.length} ligne(s) refusée(s)` : ''}.`,
    })
    saveImportReport({
      kind: 'import_registry', title: `Rapport d'import des producteurs — ${wb.fileName}`, source: wb.fileName,
      summary: [['Lignes du fichier retenues', validRows.length], ['Producteurs enregistrés', created], ['Lignes en attente', remaining],
        ['Lignes refusées', errs.length], ['Classeur enregistré dans le registre', saveRegistry ? (registrySaved || !lastError ? 'OUI' : 'NON') : 'NON']],
      tables: [
        { name: 'Lignes refusées', rows: errs.map((e) => ({ ligne_excel: e.excelRow, motif: e.message })) },
        ...registryImportReport(wb.fileName, wb.sheets.map((s) => ({ name: s.name, data: s.values })), 'merge').tables,
      ],
    })
    if (remaining) {
      setError(`${lastError} ${created} producteur(s) enregistré(s) ; ${remaining} ligne(s) non envoyée(s). Cliquez sur « Renvoyer » pour réessayer (sans doublon).`)
      return
    }
    if (lastError) { setError(lastError); setDone(true); return }
    setDone(true)
    if (!errs.length) onClose()
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
                <label className="text-xs text-gray-600">Section par défaut (facultatif)
                  <input value={defaults.section} onChange={(e) => setDefaults((d) => ({ ...d, section: e.target.value }))}
                    placeholder="ex. BEOUMI" className={`${input} w-full mt-1`} />
                </label>
                <label className="text-xs text-gray-600">Région par défaut
                  <input value={defaults.region} onChange={(e) => setDefaults((d) => ({ ...d, region: e.target.value }))}
                    placeholder="ex. Bélier" className={`${input} w-full mt-1`} />
                </label>
              </div>

              {/* 3. Aperçu : les entêtes du fichier, telles quelles */}
              <div>
                <div className="flex flex-wrap items-center gap-4 text-sm mb-1">
                  <span className="font-semibold text-gray-800">Entêtes du fichier ({headers.length})</span>
                  <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="w-4 h-4" /> {validRows.length} producteur(s) à enregistrer</span>
                  {excluded.size > 0 && <span className="text-gray-500">{excluded.size} ligne(s) écartée(s)</span>}
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Chaque ligne devient un producteur ; toutes ses colonnes sont enregistrées sous les entêtes du fichier.
                  Décochez les lignes à ne pas enregistrer (totaux, notes…).
                </p>
                <div className="border border-gray-100 rounded-xl overflow-auto max-h-72">
                  <table className="text-xs">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0">
                      <tr>
                        <th className="px-2 py-2" />
                        <th className="text-left px-2 py-2 text-gray-400">Ligne</th>
                        {headers.map((h) => <th key={h} className="text-left px-3 py-2 whitespace-nowrap font-semibold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.slice(0, 200).map((r) => {
                        const off = excluded.has(r.excelRow)
                        return (
                          <tr key={r.excelRow} className={off ? 'bg-gray-50 text-gray-300 line-through' : ''}>
                            <td className="px-2 py-1"><input type="checkbox" checked={!off} onChange={() => toggleRow(r.excelRow)} /></td>
                            <td className="px-2 py-1 text-gray-400">{r.excelRow}</td>
                            {r.cells.map((v, c) => <td key={c} className="px-3 py-1 whitespace-nowrap">{v === null ? '' : String(v)}</td>)}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {rows.length > 200 && <p className="text-xs text-gray-400 mt-1">Aperçu des 200 premières lignes sur {rows.length} (toutes seront enregistrées).</p>}
              </div>

              {/* 4. Correspondance facultative avec les champs GeoCollect */}
              <details className="border border-gray-100 rounded-xl">
                <summary className="cursor-pointer px-3 py-2 text-sm text-gray-700">
                  Associer des colonnes aux champs GeoCollect <span className="text-gray-400">(facultatif — {mapping.filter(Boolean).length} associée(s) automatiquement)</span>
                </summary>
                <p className="text-xs text-gray-500 px-3 pb-2">
                  Sert seulement à remplir les champs de la plateforme (nom affiché, village, section du FIELD ID, cartographie).
                  Les colonnes du fichier sont enregistrées dans tous les cas.
                </p>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 border-t border-gray-100">
                  {headers.map((h, c) => {
                    const sample = sheet.values.slice(headerRow + 1).map((r) => r[c]).find((v) => v !== null && v !== '')
                    return (
                      <div key={c} className="grid grid-cols-12 gap-2 items-center px-3 py-1.5 text-sm">
                        <span className="col-span-4 font-medium text-gray-800 truncate" title={h}>{h}</span>
                        <span className="col-span-3 text-xs text-gray-400 truncate" title={String(sample ?? '')}>{String(sample ?? '—')}</span>
                        <select value={mapping[c] ?? ''} onChange={(e) => setColumnField(c, e.target.value)}
                          className={`col-span-5 px-2 py-1.5 border rounded-lg text-xs ${mapping[c] ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-500'}`}>
                          <option value="">Aucun champ (colonne enregistrée telle quelle)</option>
                          {PRODUCER_FIELDS.map((f) => <option key={f.key} value={f.key}>→ {f.label}</option>)}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </details>

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
                <button onClick={doImport} disabled={busy || done || !pendingRows.length}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl">
                  <Save className="w-4 h-4" /> {busy ? (progress || 'Import…')
                    : savedRows.size && pendingRows.length ? `Renvoyer les ${pendingRows.length} ligne(s) non enregistrée(s)`
                    : `Enregistrer ${pendingRows.length} producteur(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
