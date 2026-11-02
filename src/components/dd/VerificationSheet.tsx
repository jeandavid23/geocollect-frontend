import { useState } from 'react'
import { MapContainer, TileLayer, GeoJSON as GeoJSONLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, ExternalLink, Paperclip, Loader2 } from 'lucide-react'
import { ddApi, type DDAnalysis, type DDDecision, type DDExplain, type DDResult, RISK_COLOR, RISK_TEXT_COLOR, RISK_LABEL, FOREST_LABEL, SOURCE_LABEL, CONCORDANCE_LABEL } from '../../api/dd'
import Button from '../ui/Button'
import { useHotkeys } from '../../hooks/useHotkeys'
import { apiErrorMessage } from '../../utils/retry'

// Mosaïques Sentinel-2 sans nuages (EOX, s2cloudless) — licence CC BY-NC-SA : accord commercial EOX requis en production.
const S2 = (year: number) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`
const BEFORE = 2019, AFTER = 2025

const DECISIONS: [string, string][] = [
  ['confirmer', 'Confirmer le risque'], ['lever', 'Lever le risque (preuve à l’appui)'], ['visite', 'Demander une visite terrain'],
  ['documents', 'Demander des documents'], ['exclure', 'Exclure la parcelle du lot'],
]

function Mini({ geometry, year }: { geometry: GeoJSON.Geometry; year: number }) {
  const bounds = L.geoJSON(geometry as GeoJSON.GeoJsonObject).getBounds().pad(0.6)
  return (
    <figure className="overflow-hidden rounded-xl border border-gray-200">
      <div className="h-48">
        <MapContainer bounds={bounds} maxZoom={17} className="h-full w-full" zoomControl={false} attributionControl={false} scrollWheelZoom={false}>
          <TileLayer url={S2(year)} maxNativeZoom={16} maxZoom={17} />
          <GeoJSONLayer data={geometry as GeoJSON.GeoJsonObject} style={{ color: '#facc15', weight: 2, fillOpacity: 0 }} />
        </MapContainer>
      </div>
      <figcaption className="bg-gray-50 px-2 py-1 text-xs text-gray-600">Sentinel-2 sans nuages {year} (EOX)</figcaption>
    </figure>
  )
}

/** Fiche de vérification d'une parcelle (art. 11) : preuves, vignettes avant / après 2020, décision humaine tracée. */
export default function VerificationSheet({ analysis, result, geometry, explain, onClose, onDecided }: {
  analysis: DDAnalysis; result: DDResult; geometry: GeoJSON.Geometry | null; explain?: DDExplain; onClose: () => void; onDecided: (d: DDDecision) => void
}) {
  useHotkeys({ escape: onClose })
  const c = result.classification, e = result.evidence
  const history = (analysis.decisions ?? []).filter((d) => d.parcel_key === result.id)
  const [decision, setDecision] = useState('visite')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const th = analysis.thresholds
  const rep = result.geometry_report
  const center = geometry ? L.geoJSON(geometry as GeoJSON.GeoJsonObject).getBounds().getCenter() : null

  const pick = (f: File | undefined) => {
    if (!f) return
    if (f.size > 3 * 1024 * 1024) { setError('Pièce jointe trop lourde (3 Mo maximum).'); return }
    const r = new FileReader()
    r.onload = () => setFile({ name: f.name, type: f.type, data: String(r.result).split(',')[1] ?? '' })
    r.readAsDataURL(f)
  }
  const save = async () => {
    if (decision === 'lever' && !comment.trim() && !file) { setError('Pour lever le risque, expliquez pourquoi ou joignez une preuve.'); return }
    setBusy(true); setError('')
    try {
      const { data } = await ddApi.decide(analysis.id, { parcel_key: result.id, decision, comment,
        attachment_name: file?.name, attachment_type: file?.type, attachment_data: file?.data })
      onDecided(data); setComment(''); setFile(null)
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[950] flex justify-end bg-black/40" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose() }}>
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Fiche de vérification</p>
            <h2 className="text-xl font-semibold text-gray-900">{result.properties.label}</h2>
            <p className="text-sm text-gray-500">{result.properties.producer || '—'} · {result.properties.producer_code} · {result.properties.village} · {e?.area_ha?.toFixed(2)} ha</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {c && (
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: RISK_COLOR[c.risk] }}>
            <p className="flex items-center gap-2 font-semibold" style={{ color: RISK_TEXT_COLOR[c.risk] }}>
              Risque {RISK_LABEL[c.risk].toLowerCase()} <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">score {c.score}/100</span>
            </p>
            <p className="mt-1 text-sm text-gray-700">{c.justification.fr}</p>
            {result.whisp_risk && <p className="mt-1 text-xs text-gray-500">WHISP : {result.whisp_risk} — {CONCORDANCE_LABEL[result.whisp_concordance]}</p>}
          </div>
        )}

        {c && explain && (
          <div className="mt-4 space-y-2 rounded-xl bg-blue-50/60 p-4 text-sm text-gray-700">
            <p className="font-semibold text-gray-900">Pourquoi ce classement</p>
            {c.reasons.map((code) => (
              <div key={code}>
                <p>{explain.reasons[code] ?? code}</p>
                {explain.actions[code] && <p className="mt-0.5"><b>Que faire :</b> {explain.actions[code]}</p>}
              </div>
            ))}
            {rep && <p className="text-xs text-gray-500">Étape 1 — parcelle {rep.kind === 'point' ? 'déclarée par un point (analysée comme un cercle)' : 'polygone valide'}, {rep.area_ha.toFixed(2)} ha.</p>}
          </div>
        )}

        {geometry && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Mini geometry={geometry} year={BEFORE} />
            <Mini geometry={geometry} year={AFTER} />
          </div>
        )}
        {!geometry && <p className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">Contour de la parcelle en cours de chargement…</p>}
        {center && (
          <p className="mt-2 flex flex-wrap gap-3 text-xs">
            <a className="flex items-center gap-1 text-primary-700 hover:underline" target="_blank" rel="noreferrer"
              href={`https://www.globalforestwatch.org/map/?map=${encodeURIComponent(btoa(JSON.stringify({ center: { lat: center.lat, lng: center.lng }, zoom: 15 })))}`}>
              Global Forest Watch <ExternalLink className="h-3 w-3" /></a>
            <a className="flex items-center gap-1 text-primary-700 hover:underline" target="_blank" rel="noreferrer" href="https://whisp.earthmap.org/">
              whisp.earthmap.org <ExternalLink className="h-3 w-3" /></a>
            <a className="flex items-center gap-1 text-primary-700 hover:underline" target="_blank" rel="noreferrer"
              href={`https://www.google.com/maps/@${center.lat},${center.lng},300m/data=!3m1!1e3`}>Google Maps <ExternalLink className="h-3 w-3" /></a>
          </p>
        )}

        {e && !e.error && (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <section>
              <p className="mb-1 text-sm font-semibold text-gray-900">Étape 2 — forêt au 31/12/2020 : {c ? FOREST_LABEL[c.forest2020] : ''}</p>
              <p className="mb-1 text-xs text-gray-500">Une carte vote « forêt » si elle en voit sur au moins {String(th.min_forest_share)} % de la parcelle ; {String(th.min_votes)} votes donnent « forêt »{c ? ` (ici ${c.forest2020_votes} vote(s) sur ${c.forest2020_available.length})` : ''}.</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(e.forest2020).map(([s, v]) => (
                    <tr key={s}><td className="py-1">{SOURCE_LABEL[s] ?? s}</td><td className="py-1 text-right tabular-nums">{v.pct.toFixed(1)} %</td>
                      <td className="py-1 text-right">{c?.forest2020_sources.includes(s) ? '✓ vote' : ''}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <p className="mb-1 text-sm font-semibold text-gray-900">Étape 3 — perte après 2020 (dans la forêt 2020)</p>
              <p className="mb-1 text-xs text-gray-500">Une source « signale » une perte au-delà de {String(th.min_loss_ha)} ha ou {String(th.min_loss_pct)} % de la parcelle.</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(e.loss_post2020).map(([s, v]) => (
                    <tr key={s}><td className="py-1">{SOURCE_LABEL[s] ?? s}</td><td className="py-1 text-right tabular-nums">{v.ha.toFixed(2)} ha</td>
                      <td className="py-1 text-right">{v.first_year ? (v.first_year === v.last_year ? v.first_year : `${v.first_year}–${v.last_year}`) : '—'}</td></tr>
                  ))}
                  <tr className="font-semibold"><td className="py-1">Union (sans double compte)</td><td className="py-1 text-right tabular-nums">{e.loss_post2020_ha.toFixed(2)} ha</td><td /></tr>
                </tbody>
              </table>
            </section>
          </div>
        )}
        {(result.context?.protected?.length || result.context?.rdue?.category) && (
          <p className="mt-3 text-xs text-gray-600">
            {result.context?.rdue?.category && <>Domaine foncier : <b>{result.context.rdue.category}</b>{result.context.rdue.zone ? ` (${result.context.rdue.zone})` : ''} — {result.context.rdue.legalite}. </>}
            {(result.context?.protected ?? []).map((p) => `${p.name} (${p.kind}, ${p.pct.toFixed(1)} %)`).join(' ; ')}
          </p>
        )}

        <section className="mt-6 rounded-xl bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">Décision humaine</p>
          <p className="text-xs text-gray-500">Elle s'ajoute au résultat automatique sans le remplacer ; tout reste tracé (nom, date, pièce jointe).</p>
          {history.length > 0 && (
            <ul className="mt-3 space-y-2 text-xs">
              {history.map((d) => (
                <li key={d.id} className="rounded-lg bg-white p-2">
                  <b>{d.decision_label}</b> — {d.author_name}, {new Date(d.created_at).toLocaleString('fr-FR')}
                  {d.comment && <span className="block text-gray-600">{d.comment}</span>}
                  {d.attachment_name && d.attachment_data && (
                    <a className="mt-1 inline-flex items-center gap-1 text-primary-700 hover:underline" download={d.attachment_name}
                      href={`data:${d.attachment_type || 'application/octet-stream'};base64,${d.attachment_data}`}><Paperclip className="h-3 w-3" />{d.attachment_name}</a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <select value={decision} onChange={(ev) => setDecision(ev.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {DECISIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-white">
              <Paperclip className="h-4 w-4" /> {file ? file.name : 'Photo terrain, titre foncier… (3 Mo max.)'}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(ev) => pick(ev.target.files?.[0])} />
            </label>
            <textarea value={comment} onChange={(ev) => setComment(ev.target.value)} rows={3} placeholder="Commentaire (ce qui a été vérifié, sur quelle source…)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
          </div>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          <div className="mt-3 flex justify-end">
            <Button onClick={save} loading={busy} icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>Enregistrer la décision</Button>
          </div>
        </section>
      </aside>
    </div>
  )
}
