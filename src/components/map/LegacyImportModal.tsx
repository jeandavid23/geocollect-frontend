import { useEffect, useRef, useState } from 'react'
import { X, Upload, Trash2, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { parseLegacyFiles, LEGACY_ACCEPT, type LegacyParseResult } from '../../utils/legacyImport'
import { saveImportReport } from '../../utils/report'
import { producersApi } from '../../api/producers'
import { legacyApi, type LegacySource } from '../../api/legacy'
import { useAppStore } from '../../store/appStore'
import { LEGACY_COLOR } from './LegacyParcelsLayer'
import { withRetry, apiErrorMessage } from '../../utils/retry'

const CHUNK = 1000

interface Props {
  onClose: () => void
  cooperativeId?: string // super admin : coopérative ciblée
}

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  ?? (e instanceof Error ? e.message : 'Erreur inconnue.')

export default function LegacyImportModal({ onClose, cooperativeId }: Props) {
  const { addNotification, loadLegacyParcels, isLive } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<LegacyParseResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sources, setSources] = useState<LegacySource[]>([])
  const [progress, setProgress] = useState('')
  const [codeField, setCodeField] = useState('')

  const refreshSources = async () => {
    try {
      const { data } = await legacyApi.sources()
      setSources(cooperativeId ? data.filter((s) => s.cooperative === cooperativeId) : data)
    } catch { /* hors ligne */ }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isLive) refreshSources() }, [isLive])

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (!files.length) return
    setError(''); setParsed(null); setBusy(true)
    try {
      const result = await parseLegacyFiles(files)
      if (!result.features.length) throw new Error('Aucun polygone trouvé dans ce fichier.')
      setParsed(result)
      const keys = Object.keys(result.features[0]?.properties ?? {})
      const norm = (k: string) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const pref = ['code producteur', 'code planteur', 'code parcelle', 'field id', 'fieldid', 'field_id', 'code', 'matricule', 'id producteur']
      setCodeField(pref.map((p) => keys.find((k) => norm(k) === p)).find(Boolean) ?? keys.find((k) => norm(k).includes('code')) ?? '')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const doImport = async () => {
    if (!parsed) return
    if (!isLive) {
      setError('Connectez-vous avec un compte réel (serveur joignable) pour enregistrer les anciens polygones.')
      return
    }
    setBusy(true); setError('')
    // Lots de 1000 polygones : le 1er remplace l'import précédent du même fichier, les suivants s'ajoutent
    const total = parsed.features.length
    let created = 0
    try {
      for (let start = 0; start < total; start += CHUNK) {
        const chunk = parsed.features.slice(start, start + CHUNK)
        const label = `Enregistrement… ${Math.min(start + CHUNK, total)}/${total}`
        setProgress(label)
        const { data } = await withRetry(
          () => legacyApi.import(parsed.sourceName, chunk, start === 0, cooperativeId, start === 0, codeField),
          3,
          (n) => setProgress(`${label} (nouvelle tentative ${n}/2)`),
        )
        created += data.created
      }
      // croisement complet registre ↔ polygones (producteurs avec polygones / à mapper)
      if (codeField) {
        setProgress('Croisement avec le registre des producteurs…')
        try {
          const { data: m } = await producersApi.match(codeField, cooperativeId)
          addNotification({ type: 'success', title: 'Croisement avec le registre',
            message: `${m.linked_polygons} polygone(s) rattaché(s) · ${m.mapped_producers} producteur(s) cartographié(s) · ${m.to_map} à mapper par les agents${m.orphan_polygons ? ` · ${m.orphan_polygons} polygone(s) sans producteur` : ''}.` })
        } catch { /* le croisement pourra être relancé depuis le Registre */ }
      }
      setProgress('Chargement sur la carte…')
      await loadLegacyParcels()
      await refreshSources()
      addNotification({
        type: 'success',
        title: 'Anciens polygones importés',
        message: `${created} polygone(s) depuis ${parsed.sourceName}. Rapport disponible dans « Rapports ».`,
      })
      const ha = parsed.features.reduce((s, f) => s + (f.area_hectares ?? 0), 0)
      saveImportReport({
        kind: 'import_polygons', title: `Rapport d'import de polygones — ${parsed.sourceName}`, source: parsed.sourceName,
        summary: [['Polygones lus dans le fichier', total], ['Polygones enregistrés', created], ['Entités ignorées (ni polygone ni point)', parsed.skipped],
          ['Surface totale (ha)', Math.round(ha * 100) / 100]],
        tables: [{ name: 'Polygones importés', rows: parsed.features.map((f, i) => ({ n: i + 1, nom: f.name, surface_ha: f.area_hectares, ...(f.properties as Record<string, string | number | null>) })) }],
        features: parsed.features.map((f) => ({ geometry: f.geometry, properties: { nom: f.name, surface_ha: f.area_hectares, ...f.properties } })),
        nameField: 'nom',
      }, cooperativeId)
      setParsed(null)
    } catch (err) {
      setError(`${apiErrorMessage(err)}${created ? ` ${created} polygone(s) déjà enregistré(s) : relancez l'import, le fichier sera remplacé sans doublon.` : ''}`)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const removeSource = async (s: LegacySource) => {
    if (!confirm(`Supprimer les ${s.count} polygone(s) importés depuis « ${s.source_file} » ?`)) return
    setBusy(true)
    try {
      await legacyApi.removeSource(s.source_file, cooperativeId ?? s.cooperative)
      await loadLegacyParcels()
      await refreshSources()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const totalHa = parsed?.features.reduce((sum, f) => sum + (f.area_hectares ?? 0), 0) ?? 0
  const attrKeys = parsed ? [...new Set(parsed.features.slice(0, 50).flatMap((f) => Object.keys(f.properties)))].slice(0, 12) : []
  const alreadyImported = parsed && sources.some((s) => s.source_file === parsed.sourceName)

  return (
    <div className="fixed inset-0 bg-black/40 z-[1100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-gray-900">Anciens polygones de la coopérative</h3>
            <p className="text-xs text-gray-500">Affichés sur les cartes à côté des parcelles mappées par les agents</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-violet-50 rounded-xl p-4 text-xs text-violet-900 space-y-1">
            <p className="font-semibold text-sm">Formats acceptés</p>
            <p><b>KML / KMZ</b> (Google Earth) · <b>GeoPackage</b> (.gpkg) · <b>Shapefile</b> (.zip, ou .shp + .dbf + .prj sélectionnés ensemble) · GeoJSON.</p>
            <p>Les coordonnées sont converties en WGS84 (y compris depuis l'UTM). Tous les attributs d'origine sont conservés.</p>
          </div>

          <input ref={inputRef} type="file" multiple accept={LEGACY_ACCEPT} onChange={onFiles} className="hidden" />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-violet-400 hover:bg-violet-50/40 transition disabled:opacity-60"
          >
            <Upload className="w-8 h-8" />
            <p className="text-sm font-medium">{busy ? 'Lecture…' : 'Choisir un fichier (ou les fichiers d\'un Shapefile)'}</p>
            <p className="text-xs text-gray-400">{LEGACY_ACCEPT.replace(/,/g, ' ')}</p>
          </button>

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
            </p>
          )}

          {parsed && (
            <div className="border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 font-semibold" style={{ color: LEGACY_COLOR }}>
                  <Layers className="w-4 h-4" /> {parsed.features.length} polygone(s)
                </span>
                <span className="text-gray-600">{totalHa.toFixed(2)} ha au total</span>
                {parsed.skipped > 0 && <span className="text-amber-600">{parsed.skipped} point(s)/ligne(s) ignoré(s)</span>}
              </div>
              {(parsed.warning || attrKeys.length === 0) && (
                <p className="text-xs text-red-800 bg-red-50 border-l-4 border-red-500 rounded p-2">
                  {parsed.warning ?? 'Ces polygones n\'ont aucun attribut : impossible de les rattacher aux producteurs du registre par leur code.'}
                </p>
              )}
              {alreadyImported && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                  « {parsed.sourceName} » a déjà été importé : ses anciens polygones seront remplacés.
                </p>
              )}
              <div className="max-h-48 overflow-auto border border-gray-50 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5">Nom</th>
                      <th className="text-left px-2 py-1.5">Ha</th>
                      {attrKeys.map((k) => <th key={k} className="text-left px-2 py-1.5 whitespace-nowrap">{k}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parsed.features.slice(0, 100).map((f, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 whitespace-nowrap">{f.name}</td>
                        <td className="px-2 py-1">{f.area_hectares?.toFixed(2) ?? '—'}</td>
                        {attrKeys.map((k) => <td key={k} className="px-2 py-1 whitespace-nowrap">{String(f.properties[k] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.features.length > 100 && <p className="text-xs text-gray-400">Aperçu des 100 premiers.</p>}
              <label className="block text-sm text-gray-700">Attribut du code producteur / code parcelle
                <select value={codeField} onChange={(e) => setCodeField(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                  <option value="">— Aucun (pas de croisement avec le registre) —</option>
                  {attrKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <span className="mt-1 block text-xs text-gray-500">Chaque polygone est rattaché au producteur du registre qui a ce code (2 ou 3 polygones possibles par producteur, suffixes « -P2 » acceptés). Les producteurs sans polygone partent chez les agents « à mapper ».</span>
              </label>
              <button
                onClick={doImport}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-60"
                style={{ background: LEGACY_COLOR }}
              >
                <CheckCircle2 className="w-4 h-4" /> {busy ? (progress || 'Enregistrement…') : `Enregistrer ${parsed.features.length} ancien(s) polygone(s)`}
              </button>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Imports enregistrés</p>
            {sources.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun ancien polygone importé pour le moment.</p>
            ) : (
              <div className="space-y-1.5">
                {sources.map((s) => (
                  <div key={`${s.cooperative}-${s.source_file}`} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{s.source_file || 'Sans nom'}</p>
                      <p className="text-xs text-gray-500">{s.count} polygone(s) · {s.area_hectares.toFixed(2)} ha</p>
                    </div>
                    <button onClick={() => removeSource(s)} disabled={busy}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Supprimer cet import">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
