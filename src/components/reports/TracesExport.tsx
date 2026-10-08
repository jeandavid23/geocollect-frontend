import { useMemo, useState } from 'react'
import { FileCheck2, Download, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import { buildTraces, type TracesInput, type TracesResult } from '../../utils/traces'
import { downloadBlob } from '../../utils/geoExport'

type Source = 'parcels' | 'legacy' | 'both'
const PRODUCER_KEYS = ['producername', 'producteur', 'nom_producteur', 'nom_prod', 'nom', 'name', 'planteur', 'proprietaire']
const PLACE_KEYS = ['productionplace', 'village', 'localite', 'localité', 'lieu', 'section', 'sous_prefecture', 'region']

const pick = (props: Record<string, unknown>, keys: string[], chosen: string) => {
  if (chosen) return String(props[chosen] ?? '')
  const low = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]))
  for (const k of keys) if (low[k] != null && String(low[k]).trim()) return String(low[k])
  return ''
}

/** Export du fichier GeoJSON de la déclaration de diligence raisonnable (système d'information EUDR / TRACES). */
export default function TracesExport({ cooperativeId }: { cooperativeId?: string }) {
  const { parcels, producers, legacyParcels, cooperatives, addNotification } = useAppStore()
  const [source, setSource] = useState<Source>('parcels')
  const [country, setCountry] = useState('CI')
  const [pointsUnder4ha, setPointsUnder4ha] = useState(false)
  const [fillHoles, setFillHoles] = useState(false)
  const [producerField, setProducerField] = useState('')
  const [placeField, setPlaceField] = useState('')
  const [result, setResult] = useState<TracesResult | null>(null)

  const mine = <T extends { cooperativeId: string }>(l: T[]) => l.filter((x) => !cooperativeId || x.cooperativeId === cooperativeId)
  const prodName = useMemo(() => new Map(producers.map((p) => [p.id, p.fullName])), [producers])
  const legacy = useMemo(() => mine(legacyParcels), [legacyParcels, cooperativeId]) // eslint-disable-line react-hooks/exhaustive-deps
  const mapped = useMemo(() => mine(parcels).filter((p) => p.geometry?.coordinates?.length), [parcels, cooperativeId]) // eslint-disable-line react-hooks/exhaustive-deps
  const legacyFields = useMemo(() => {
    const k = new Set<string>(); for (const l of legacy.slice(0, 500)) Object.keys(l.properties ?? {}).forEach((x) => k.add(x)); return [...k]
  }, [legacy])

  const inputs = (): TracesInput[] => [
    ...(source !== 'legacy' ? mapped.map((p) => ({
      id: p.fieldId, geometry: p.geometry as unknown as GeoJSON.Geometry, producerName: prodName.get(p.producerId) ?? '',
      productionPlace: [p.village, p.section].filter(Boolean).join(', '), areaHa: p.areaHectares,
    })) : []),
    ...(source !== 'parcels' ? legacy.map((l) => ({
      id: l.name || l.id.slice(0, 8), geometry: l.geometry, areaHa: l.areaHectares,
      producerName: pick(l.properties ?? {}, PRODUCER_KEYS, producerField) || l.name,
      productionPlace: pick(l.properties ?? {}, PLACE_KEYS, placeField),
    })) : []),
  ]

  const coopName = cooperatives.find((c) => c.id === cooperativeId)?.name ?? 'cooperative'
  const base = `traces_eudr_${coopName.normalize('NFD').replace(/[^\w]+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}`

  const prepare = () => {
    if (!/^[A-Z]{2}$/i.test(country)) { addNotification({ type: 'error', title: 'Code pays invalide', message: 'Code ISO à 2 lettres, par exemple CI.' }); return }
    const r = buildTraces(inputs(), { country, pointsUnder4ha, fillHoles }, base)
    setResult(r)
  }

  const download = async () => {
    if (!result?.files.length) return
    if (result.files.length === 1) {
      downloadBlob(new Blob([result.files[0].content], { type: 'application/geo+json' }), result.files[0].name)
    } else {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip(); result.files.forEach((f) => zip.file(f.name, f.content))
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${base}.zip`)
    }
    addNotification({ type: 'success', title: 'Fichier TRACES prêt', message: `${result.kept} parcelle(s) — à déposer dans votre déclaration de diligence raisonnable.` })
  }

  const count = source === 'parcels' ? mapped.length : source === 'legacy' ? legacy.length : mapped.length + legacy.length
  const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'

  return (
    <section id="traces" className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-5 w-5 text-primary-700" />
        <div>
          <h2 className="font-semibold text-gray-900">Export TRACES (règlement européen EUDR)</h2>
          <p className="text-sm text-gray-500">Fichier GeoJSON au format du système d'information de l'UE, à joindre à la déclaration de diligence raisonnable de l'exportateur.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="text-xs text-gray-600 md:col-span-2">Parcelles à exporter
          <select value={source} onChange={(e) => { setSource(e.target.value as Source); setResult(null) }} className={input}>
            <option value="parcels">Parcelles mappées par les agents ({mapped.length})</option>
            <option value="legacy">Anciens polygones importés ({legacy.length})</option>
            <option value="both">Les deux ({mapped.length + legacy.length})</option>
          </select>
        </label>
        <label className="text-xs text-gray-600">Pays de production (ISO)
          <input value={country} maxLength={2} onChange={(e) => { setCountry(e.target.value.toUpperCase()); setResult(null) }} className={input} />
        </label>
      </div>
      {source !== 'parcels' && legacyFields.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs text-gray-600">Champ « nom du producteur » (anciens polygones)
            <select value={producerField} onChange={(e) => { setProducerField(e.target.value); setResult(null) }} className={input}>
              <option value="">Détection automatique</option>{legacyFields.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Champ « lieu de production »
            <select value={placeField} onChange={(e) => { setPlaceField(e.target.value); setResult(null) }} className={input}>
              <option value="">Détection automatique</option>{legacyFields.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
        <label className="flex items-center gap-2"><input type="checkbox" checked={pointsUnder4ha} onChange={(e) => { setPointsUnder4ha(e.target.checked); setResult(null) }} /> Point au lieu du polygone pour les parcelles de moins de 4 ha</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={fillHoles} onChange={(e) => { setFillHoles(e.target.checked); setResult(null) }} /> Combler les trous (refusés par TRACES)</label>
      </div>
      <p className="flex items-start gap-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />Le polygone reste la preuve la plus solide : gardez-le, même sous 4 ha, si l'exportateur le demande. Les parcelles invalides sont écartées et listées ci-dessous.</p>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={prepare} disabled={!count} className="rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-40">Contrôler et préparer ({count})</button>
        {result && result.kept > 0 && (
          <button onClick={download} className="flex items-center gap-2 rounded-md border border-primary-700 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50">
            <Download className="h-4 w-4" /> Télécharger {result.files.length > 1 ? `(${result.files.length} fichiers, zip)` : 'le GeoJSON'}
          </button>
        )}
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[['Parcelles exportées', result.kept], ['Polygones', result.polygons], ['Points', result.points], ['Écartées', result.excluded], ['Surface (ha)', Math.round(result.totalArea * 100) / 100]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">{l}</p><p className="text-xl font-semibold tabular-nums text-gray-900">{(v as number).toLocaleString('fr-FR')}</p></div>
            ))}
          </div>
          {result.excluded === 0
            ? <p className="flex items-center gap-2 text-sm text-primary-700"><CheckCircle2 className="h-4 w-4" />Toutes les parcelles respectent les règles de TRACES.</p>
            : <p className="flex items-center gap-2 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" />{result.excluded} parcelle(s) écartée(s) : corrigez-les puis relancez.</p>}
          {result.issues.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-gray-500"><tr><th className="px-3 py-2 text-left font-medium">Parcelle</th><th className="px-3 py-2 text-left font-medium">Statut</th><th className="px-3 py-2 text-left font-medium">Détail</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {result.issues.slice(0, 500).map((i, k) => (
                    <tr key={k}><td className="px-3 py-1.5 font-mono">{i.id}</td>
                      <td className="px-3 py-1.5"><span className={`rounded px-1.5 py-0.5 ${i.level === 'exclu' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{i.level === 'exclu' ? 'Écartée' : 'Corrigée'}</span></td>
                      <td className="px-3 py-1.5 text-gray-700">{i.message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
