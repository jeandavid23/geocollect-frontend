import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Layers, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Database } from 'lucide-react'
import Header from '../../components/layout/Header'
import ResultsLayer, { escapeHtml, type ResultItem } from '../../components/map/ResultsLayer'
import FitToData from '../../components/map/FitToData'
import ReportExportBar from '../../components/ui/ReportExportBar'
import { spatialApi, type OverlapResponse, type OverlapRow, type ZoneResponse } from '../../api/parcels'
import { useAuthStore } from '../../store/authStore'
import { apiErrorMessage } from '../../utils/retry'
import type { Report } from '../../utils/report'

const { BaseLayer } = LayersControl
const PAGE = 100

const TYPE_LABEL: Record<OverlapRow['type'], string> = {
  meme_producteur: 'Même producteur',
  autres_producteurs: 'Deux producteurs',
  autre_cooperative: 'Autre coopérative',
}
const TYPE_STYLE: Record<OverlapRow['type'], string> = {
  meme_producteur: 'bg-sky-50 text-sky-800',
  autres_producteurs: 'bg-amber-50 text-amber-800',
  autre_cooperative: 'bg-red-50 text-red-700',
}
const CAT_LABEL: Record<string, string> = {
  'Foret classee': 'Forêt classée', 'Parc/reserve': 'Parc / réserve', Enclave: 'Enclave', 'Agro-foret classee': 'Agro-forêt classée',
}
const CAT_COLOR: Record<string, string> = {
  'Foret classee': '#C62828', 'Parc/reserve': '#7B1FA2', Enclave: '#1B7F4B', 'Agro-foret classee': '#F5A623',
}
const KIND = { parcel: 'Parcelle mappée', legacy: 'Ancien polygone' }
const n = (v: number, d = 2) => v.toLocaleString('fr-FR', { maximumFractionDigits: d })

/** Contrôle spatial de la coopérative : chevauchements (internes et avec les autres coopératives) et zones foncières. */
export default function SpatialCheckPage() {
  const coopId = useAuthStore((s) => s.user?.cooperativeId) ?? undefined
  const [tab, setTab] = useState<'overlaps' | 'zones'>('overlaps')
  const [minHa, setMinHa] = useState(0.01)
  const [other, setOther] = useState(true)
  const [typeFilter, setTypeFilter] = useState<OverlapRow['type'] | 'all' | 'doublon'>('all')
  const [ov, setOv] = useState<OverlapResponse | null>(null)
  const [zn, setZn] = useState<ZoneResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)

  const run = useCallback(async () => {
    setBusy(true); setError(''); setPage(0)
    try {
      if (tab === 'overlaps') setOv((await spatialApi.overlaps({ cooperative: coopId, other, min_ha: minHa })).data)
      else setZn((await spatialApi.zones(coopId)).data)
    } catch (e) { setError(apiErrorMessage(e)) } finally { setBusy(false) }
  }, [tab, coopId, other, minHa])

  useEffect(() => { if ((tab === 'overlaps' && !ov) || (tab === 'zones' && !zn)) run() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const overlapRows = useMemo(() => (ov?.results ?? []).filter((r) =>
    typeFilter === 'all' ? true : typeFilter === 'doublon' ? r.doublon : r.type === typeFilter), [ov, typeFilter])

  const side = (s: OverlapRow['a']) => `${s.label}${s.producer ? ` — ${s.producer.name || s.producer.code}` : ''}`

  const mapItems = useMemo<ResultItem[]>(() => {
    if (tab === 'overlaps') {
      return overlapRows.filter((r) => r.geometry).map((r, i) => ({
        key: `o${i}`, geometry: r.geometry!, color: r.type === 'autre_cooperative' ? '#C62828' : r.doublon ? '#0277BD' : '#EF6C00',
        popup: () => `<b>${escapeHtml(TYPE_LABEL[r.type])}${r.doublon ? ' — doublon probable' : ''}</b><br>${escapeHtml(side(r.a))}<br>× ${escapeHtml(side(r.b))}<br>${n(r.area_ha, 3)} ha (${r.pct_a} % / ${r.pct_b} %)`,
      }))
    }
    return []
  }, [tab, overlapRows]) // eslint-disable-line react-hooks/exhaustive-deps

  const report = useMemo<Report | null>(() => {
    if (tab === 'overlaps' && ov) {
      const s = ov.summary
      return {
        kind: 'spatial', title: 'Contrôle spatial — chevauchements des parcelles', source: ov.cooperative,
        summary: [['Chevauchements', s.total], ['Même producteur', s.meme_producteur], ['Entre deux producteurs', s.autres_producteurs],
          ['Avec une autre coopérative', s.autre_cooperative], ['Doublons probables (≥ 80 %)', s.doublons], ['Surface chevauchée (ha)', s.area_ha],
          ['Surface minimale retenue (ha)', ov.min_ha], ['Moteur', s.engine === 'postgis' ? 'PostGIS (surfaces géodésiques)' : 'Python (surfaces approchées)']],
        tables: [{ name: 'Chevauchements', rows: ov.results.map((r) => ({
          type: TYPE_LABEL[r.type], doublon: r.doublon ? 'OUI' : 'NON', surface_ha: r.area_ha, pct_a: r.pct_a, pct_b: r.pct_b,
          source_a: KIND[r.a.kind], id_a: r.a.label, code_producteur_a: r.a.producer?.code ?? '', producteur_a: r.a.producer?.name ?? '',
          source_b: KIND[r.b.kind], id_b: r.b.label, code_producteur_b: r.b.producer?.code ?? '', producteur_b: r.b.producer?.name ?? '',
          autre_cooperative: r.other_cooperative ?? '',
        })) }],
        features: ov.results.filter((r) => r.geometry).map((r) => ({ geometry: r.geometry!, properties: {
          type: TYPE_LABEL[r.type], doublon: r.doublon ? 'OUI' : 'NON', Surface_Ha: r.area_ha, id_a: r.a.label, id_b: r.b.label,
          code_a: r.a.producer?.code ?? '', code_b: r.b.producer?.code ?? '',
        } })),
        nameField: 'id_a',
      }
    }
    if (tab === 'zones' && zn) {
      const s = zn.summary
      return {
        kind: 'spatial', title: 'Contrôle spatial — parcelles en zones foncières', source: zn.cooperative,
        summary: [['Zones foncières de référence', s.zones_loaded], ['Parcelles concernées', s.parcels_in_zones], ['Illégales (forêt classée, parc)', s.illegal],
          ...Object.entries(s.by_category).map(([c, v]) => [CAT_LABEL[c] ?? c, v] as [string, number])],
        tables: [{ name: 'Parcelles en zones', rows: zn.results.map((r) => ({
          source: KIND[r.kind], identifiant: r.label, code_producteur: r.producer?.code ?? '', producteur: r.producer?.name ?? '',
          categorie: CAT_LABEL[r.category] ?? r.category, zone: r.zone, part_pct: r.pct, legalite: r.legalite, note: r.note ?? '',
          surface_ha: r.area_ha ?? '', autres_zones: r.zones.slice(1).map((z) => `${z.name} (${z.pct} %)`).join(', '),
        })) }],
      }
    }
    return null
  }, [tab, ov, zn])

  const zoneRows = zn?.results ?? []
  const rows = tab === 'overlaps' ? overlapRows : zoneRows
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const cur = Math.min(page, pages - 1)
  const input = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
  const engine = (tab === 'overlaps' ? ov?.summary.engine : zn?.summary.engine)

  return (
    <div className="space-y-5">
      <Header title="Contrôle spatial" subtitle="Chevauchements entre parcelles et parcelles situées en forêt classée, parc ou enclave" />

      <div className="flex flex-wrap items-center gap-2">
        {([['overlaps', 'Chevauchements'], ['zones', 'Zones foncières']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setPage(0) }}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === k ? 'bg-primary-700 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>{l}</button>
        ))}
        {engine && <span className="ml-auto flex items-center gap-1.5 text-xs text-gray-500"><Database className="h-3.5 w-3.5" />
          {engine === 'postgis' ? 'Calcul PostGIS · surfaces géodésiques' : 'Calcul Python · surfaces approchées'}</span>}
      </div>

      {tab === 'overlaps' && (
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-white p-5 md:grid-cols-4">
          <label className="text-xs text-gray-600">Ignorer les chevauchements sous (ha)
            <input type="number" step="0.005" min="0" value={minHa} onChange={(e) => setMinHa(Number(e.target.value))} className={input} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-gray-700 md:col-span-2">
            <input type="checkbox" checked={other} onChange={(e) => setOther(e.target.checked)} />
            Inclure les parcelles des autres coopératives (un même champ déclaré deux fois)
          </label>
          <div className="flex items-end">
            <button onClick={run} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Contrôler
            </button>
          </div>
        </section>
      )}
      {tab === 'zones' && (
        <div className="flex justify-end">
          <button onClick={run} disabled={busy} className="flex items-center gap-2 rounded-md bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Relancer le contrôle
          </button>
        </div>
      )}

      {error && <p className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</p>}
      {busy && !error && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Contrôle en cours…</p>}

      {tab === 'overlaps' && ov && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {([['Chevauchements', ov.summary.total, 'all'], ['Même producteur', ov.summary.meme_producteur, 'meme_producteur'],
              ['Deux producteurs', ov.summary.autres_producteurs, 'autres_producteurs'], ['Autre coopérative', ov.summary.autre_cooperative, 'autre_cooperative'],
              ['Doublons probables', ov.summary.doublons, 'doublon']] as const).map(([l, v, f]) => (
              <button key={l} onClick={() => { setTypeFilter(f); setPage(0) }}
                className={`rounded-xl border p-3 text-left ${typeFilter === f ? 'border-primary-600 ring-1 ring-primary-600' : 'border-gray-200'} bg-white`}>
                <p className="text-xs text-gray-500">{l}</p><p className="text-xl font-semibold tabular-nums">{n(v, 0)}</p>
              </button>
            ))}
            <div className="rounded-xl border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Surface chevauchée</p><p className="text-xl font-semibold tabular-nums">{n(ov.summary.area_ha)} ha</p></div>
          </div>
          {ov.summary.total === 0 && <p className="flex items-center gap-2 text-sm text-primary-700"><CheckCircle2 className="h-4 w-4" />Aucun chevauchement au-dessus de {n(ov.min_ha, 3)} ha.</p>}
          {ov.summary.truncated && <p className="text-xs text-amber-700">Seuls les 3 000 plus grands chevauchements sont listés : augmentez la surface minimale.</p>}
          <p className="text-xs text-gray-500">« Doublon probable » : les deux polygones se recouvrent à 80 % ou plus — souvent le même champ relevé deux fois (ancien polygone et nouveau mapping). Supprimez-en un. Les parcelles des autres coopératives restent anonymes.</p>
        </>
      )}

      {tab === 'zones' && zn && (
        <>
          {zn.summary.zones_loaded === 0
            ? <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="h-4 w-4" />Aucune zone foncière de référence n'est chargée sur la plateforme (forêts classées, parcs, enclaves). Contactez l'administrateur.</p>
            : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-xl border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Parcelles en zone</p><p className="text-xl font-semibold tabular-nums">{n(zn.summary.parcels_in_zones, 0)}</p></div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3"><p className="text-xs text-red-700">Illégales</p><p className="text-xl font-semibold tabular-nums text-red-700">{n(zn.summary.illegal, 0)}</p></div>
                {Object.entries(zn.summary.by_category).map(([c, v]) => (
                  <div key={c} className="rounded-xl border border-gray-200 bg-white p-3"><p className="text-xs" style={{ color: CAT_COLOR[c] }}>{CAT_LABEL[c] ?? c}</p><p className="text-xl font-semibold tabular-nums">{n(v, 0)}</p></div>
                ))}
              </div>
            )}
          {zn.summary.zones_loaded > 0 && zn.summary.parcels_in_zones === 0 && <p className="flex items-center gap-2 text-sm text-primary-700"><CheckCircle2 className="h-4 w-4" />Aucune parcelle dans une forêt classée, un parc, une enclave ou une agro-forêt.</p>}
          <p className="text-xs text-gray-500">Forêt classée et parc / réserve : production illégale. Enclave et agro-forêt : admises sous conditions — sauf si la parcelle déborde de plus de 1 % dans la forêt qui les entoure.</p>
        </>
      )}

      {tab === 'overlaps' && mapItems.length > 0 && (
        <div className="h-[420px] overflow-hidden rounded-2xl border border-gray-100">
          <MapContainer center={[7.54, -5.55]} zoom={7} className="h-full w-full" preferCanvas>
            <LayersControl position="topright">
              <BaseLayer checked name="Satellite Google"><TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" /></BaseLayer>
              <BaseLayer name="OpenStreetMap"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" /></BaseLayer>
            </LayersControl>
            <FitToData geometries={mapItems.map((m) => m.geometry)} />
            <ResultsLayer items={mapItems} version={`${typeFilter}-${mapItems.length}`} />
          </MapContainer>
        </div>
      )}

      {rows.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="overflow-x-auto">
            {tab === 'overlaps' ? (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Type', 'Polygone A', 'Polygone B', 'Surface (ha)', '% de A', '% de B'].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {overlapRows.slice(cur * PAGE, (cur + 1) * PAGE).map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[r.type]}`}>{TYPE_LABEL[r.type]}</span>
                        {r.doublon && <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">doublon</span>}</td>
                      {[r.a, r.b].map((s, k) => (
                        <td key={k} className="px-4 py-2 text-xs"><span className="font-mono">{s.label}</span>
                          <span className="block text-gray-500">{KIND[s.kind]}{s.producer ? ` · ${s.producer.name || ''} (${s.producer.code})` : k === 1 && r.other_cooperative ? ` · ${r.other_cooperative}` : ''}</span></td>
                      ))}
                      <td className="px-4 py-2 tabular-nums">{n(r.area_ha, 3)}</td>
                      <td className="px-4 py-2 tabular-nums">{r.pct_a} %</td>
                      <td className="px-4 py-2 tabular-nums">{r.pct_b} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Polygone', 'Producteur', 'Catégorie', 'Zone', 'Part (%)', 'Légalité'].map((h) => <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {zoneRows.slice(cur * PAGE, (cur + 1) * PAGE).map((r) => (
                    <tr key={`${r.kind}${r.id}`}>
                      <td className="px-4 py-2 text-xs"><span className="font-mono">{r.label}</span><span className="block text-gray-500">{KIND[r.kind]}</span></td>
                      <td className="px-4 py-2 text-xs">{r.producer ? `${r.producer.name} (${r.producer.code})` : '—'}</td>
                      <td className="px-4 py-2 text-xs font-medium" style={{ color: CAT_COLOR[r.category] }}>{CAT_LABEL[r.category] ?? r.category}</td>
                      <td className="px-4 py-2 text-xs">{r.zone}{r.note && <span className="block text-amber-700">{r.note}</span>}</td>
                      <td className="px-4 py-2 tabular-nums">{r.pct}</td>
                      <td className="px-4 py-2 text-xs"><span className={`rounded-full px-2 py-0.5 ${r.legalite === 'Non conforme' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{r.legalite}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-3 text-xs text-gray-600">
              <button disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Précédent</button>
              <span>Page {cur + 1} / {pages}</span>
              <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Suivant</button>
            </div>
          )}
        </section>
      )}

      {report && <ReportExportBar report={report} />}
      <p className="flex items-center gap-1.5 text-xs text-gray-400"><Layers className="h-3.5 w-3.5" />Contrôle sur les parcelles mappées par les agents et les anciens polygones importés de la coopérative.</p>
    </div>
  )
}
