import { useEffect, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import Button from '../ui/Button'
import { analyticsApi, type Analytics, type RiskLevel } from '../../api/dashboard'
import { currentCampaign } from '../../api/trace'
import { CHART, RISK_UI, STATUS } from '../../theme/tokens'
import { exportExcel } from '../../utils/featureExport'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage } from '../../utils/retry'
import { Kpi, MonthlyBars, Panel, Pipeline, RankBars, ShareBar, tonnes, weekLabel } from './charts'

const RISK_LABEL: Record<RiskLevel, string> = { faible: 'Risque faible', a_verifier: 'À vérifier', eleve: 'Risque élevé' }
const CAMPAIGNS = 3                          // campagne en cours et les deux précédentes
const fcfa = (v: number) => (v >= 1e6 ? `${fr(v / 1e6, 1)} M FCFA` : `${fr(v, 0)} FCFA`)

function campaigns() {
  const y = Number(currentCampaign().slice(0, 4))
  return Array.from({ length: CAMPAIGNS }, (_, i) => `${y - i}-${y - i + 1}`)
}

function excel(a: Analytics) {
  const sheets = [
    { name: 'Synthèse', rows: [
      { indicateur: 'Parcelles (toutes)', valeur: a.parcels.total }, { indicateur: 'dont cartographiées', valeur: a.parcels.mapped },
      { indicateur: 'dont anciens polygones', valeur: a.parcels.legacy }, { indicateur: 'Surface (ha)', valeur: a.parcels.hectares },
      { indicateur: 'Producteurs', valeur: a.producers.total }, { indicateur: 'Producteurs avec parcelle (%)', valeur: a.producers.coverage_pct },
      { indicateur: `Volume net ${a.campaign} (kg)`, valeur: a.volumes.net_kg }, { indicateur: 'Montant payé (FCFA)', valeur: a.volumes.amount_fcfa },
      { indicateur: 'Prix moyen (FCFA/kg)', valeur: a.volumes.avg_price }, { indicateur: 'Rendement réel (kg/ha)', valeur: a.volumes.yield_kg_ha },
      { indicateur: 'Production estimée du registre (kg)', valeur: a.volumes.estimated_kg },
      { indicateur: 'Rendement estimé du registre (kg/ha)', valeur: a.volumes.estimated_yield_kg_ha },
      { indicateur: 'Production estimée déjà livrée (%)', valeur: a.volumes.realisation_pct } ] },
    { name: 'Par mois', rows: a.monthly.map((m) => ({ mois: m.month, poids_net_kg: m.net_kg, montant_fcfa: m.amount_fcfa, pesees: m.deliveries })) },
    { name: 'Producteurs', rows: a.top_producers.map((p) => ({ code: p.code, producteur: p.name, village: p.village, pesees: p.deliveries, poids_net_kg: p.net_kg, montant_fcfa: p.amount_fcfa })) },
  ]
  if (a.per_cooperative) sheets.push({ name: 'Par coopérative', rows: a.per_cooperative.map((c) => ({ cooperative: c.name, parcelles: c.parcels, hectares: c.hectares, producteurs: c.producers, poids_net_kg: c.net_kg, montant_fcfa: c.amount_fcfa, parcelles_risque_eleve: c.high_risk })) } as never)
  exportExcel(sheets, `analyse_${a.campaign}.xlsx`)
}

/**
 * Analyse d'activité d'une coopérative (ou des coopératives d'un client) : parcelles — cartographiées et anciens
 * polygones, toutes comptées —, couverture des producteurs, risque, volumes de la campagne, chaîne jusqu'à l'usine.
 */
export default function AnalyticsPanel({ cooperative }: { cooperative?: string }) {
  const [campaign, setCampaign] = useState(currentCampaign())
  const [a, setA] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setA(null); setError('')
    analyticsApi.get(campaign, cooperative).then(({ data }) => setA(data)).catch((e) => setError(apiErrorMessage(e)))
  }, [campaign, cooperative])

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm text-gray-600">Campagne{' '}
        <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className="ml-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          {campaigns().map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {a && <Button size="sm" variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => excel(a)}>Excel</Button>}
    </div>
  )
  if (error) return <div className="space-y-3">{toolbar}<p role="alert" className="text-sm text-danger-text">{error}</p></div>
  if (!a) return <div className="space-y-3">{toolbar}<p className="text-sm text-gray-500">Calcul de l'analyse…</p></div>
  const p = a.parcels
  const v = a.volumes
  return (
    <div className="space-y-5">
      {toolbar}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Parcelles" value={fr(p.total, 0)} hint={`${fr(p.mapped, 0)} cartographiées · ${fr(p.legacy, 0)} anciens polygones`} />
        <Kpi label="Surface" value={`${fr(p.hectares, 0)} ha`} hint={`${fr(p.avg_ha, 2)} ha en moyenne par parcelle`} />
        <Kpi label="Producteurs avec parcelle" value={`${fr(a.producers.coverage_pct, 1)} %`}
          hint={`${fr(a.producers.with_parcels, 0)} / ${fr(a.producers.total, 0)} · ${fr(a.producers.to_map, 0)} à cartographier`}
          tone={a.producers.coverage_pct < 80 ? 'warning' : undefined} />
        <Kpi label={`Cacao pesé ${v.campaign}`} value={tonnes(v.net_kg)} trend={v.growth_pct}
          hint={`${fr(v.deliveries, 0)} pesées · ${fr(v.producers_delivering, 0)} producteurs`} />
        <Kpi label="Montant payé" value={fcfa(v.amount_fcfa)} hint={v.avg_price ? `${fr(v.avg_price, 0)} FCFA/kg en moyenne` : 'prix non saisi'} />
        <Kpi label="Rendement estimé (registre)" value={v.estimated_yield_kg_ha != null ? `${fr(v.estimated_yield_kg_ha, 0)} kg/ha` : '—'}
          hint={`${v.estimated_yield_kg_ha == null ? 'production estimée absente du registre · ' : ''}réel ${v.yield_kg_ha != null ? `${fr(v.yield_kg_ha, 0)} kg/ha` : '—'} (livreurs)`} />
        <Kpi label="Production estimée (registre)" value={v.estimated_kg != null ? tonnes(v.estimated_kg) : '—'}
          hint={v.estimated_kg != null ? `${fr(v.realisation_pct ?? 0, 1)} % déjà livré · ${fr(v.producers_with_estimate, 0)} producteurs` : 'colonne « Total estimate production (current year) »'} />
        <Kpi label="Risque élevé (diligence)" value={fr(a.risk.counts.eleve, 0)} tone={a.risk.counts.eleve ? 'danger' : undefined}
          hint={a.risk.last_analysis ? `dernière analyse le ${new Date(a.risk.last_analysis).toLocaleDateString('fr-FR')}` : 'aucune analyse terminée'} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Parcelles de la coopérative" subtitle="Les anciens polygones importés comptent comme parcelles">
          <ShareBar parts={[{ label: 'Cartographiées', value: p.mapped, color: CHART.mapped }, { label: 'Anciens polygones', value: p.legacy, color: CHART.legacy }]} />
          <p className="mt-4 mb-2 text-sm font-medium text-gray-700">Surface</p>
          <ShareBar format={(x) => `${fr(x, 0)} ha`} parts={[{ label: 'Cartographiées', value: p.mapped_ha, color: CHART.mapped }, { label: 'Anciens polygones', value: p.legacy_ha, color: CHART.legacy }]} />
          <p className="mt-4 mb-2 text-sm font-medium text-gray-700">Contrôle EUDR des parcelles cartographiées</p>
          <ShareBar parts={[{ label: 'Conformes', value: p.eudr.compliant, color: STATUS.ok }, { label: 'En attente', value: p.eudr.pending, color: STATUS.warn },
            { label: 'Non conformes', value: p.eudr.non_compliant, color: STATUS.danger }]} />
        </Panel>
        <Panel title="Risque de déforestation" subtitle={`Dernière diligence raisonnée : ${fr(a.risk.analysed, 0)} parcelles analysées (anciens polygones compris)`}>
          {a.risk.analysed === 0 ? <p className="text-sm text-gray-500">Aucune diligence raisonnée terminée.</p> : <>
            <ShareBar parts={(Object.keys(RISK_LABEL) as RiskLevel[]).map((k) => ({ label: RISK_LABEL[k], value: a.risk.counts[k], color: RISK_UI[k] }))} />
            <p className="mt-4 mb-2 text-sm font-medium text-gray-700">Surface concernée</p>
            <ShareBar format={(x) => `${fr(x, 0)} ha`} parts={(Object.keys(RISK_LABEL) as RiskLevel[]).map((k) => ({ label: RISK_LABEL[k], value: a.risk.area_ha[k], color: RISK_UI[k] }))} />
          </>}
        </Panel>
      </div>

      <Panel title={`Cacao pesé par mois — campagne ${v.campaign}`} subtitle={v.previous_net_kg ? `Campagne ${v.previous_campaign} : ${tonnes(v.previous_net_kg)} au total` : undefined}>
        {a.monthly.length ? <MonthlyBars data={a.monthly} series={[{ key: 'net_kg', label: 'Poids net pesé', color: CHART.volume }]} />
          : <p className="text-sm text-gray-500">Aucune pesée sur cette campagne.</p>}
      </Panel>

      <Panel title="De la pesée à l'usine" subtitle={`Lots : ${a.lots.brouillon} brouillon(s), ${a.lots.valide} validé(s), ${a.lots.expedie} expédié(s)`}>
        <Pipeline steps={[{ label: 'Pesé', kg: a.pipeline.weighed_kg }, { label: 'En lots', kg: a.pipeline.in_lots_kg },
          { label: 'Expédié', kg: a.pipeline.shipped_kg }, { label: "Reçu à l'usine", kg: a.pipeline.received_kg }, { label: 'Usiné', kg: a.pipeline.processed_kg }]} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Parcelles ajoutées par semaine" subtitle="12 dernières semaines">
          <MonthlyBars data={a.activity} xKey="week" xFormat={weekLabel} period="semaine" unit="parcelles" stacked height={220}
            series={[{ key: 'mapped', label: 'Cartographiées', color: CHART.mapped }, { key: 'legacy', label: 'Anciens polygones', color: CHART.legacy }]} />
        </Panel>
        <Panel title="Premiers producteurs livreurs" subtitle={`Campagne ${v.campaign}`}>
          <RankBars rows={a.top_producers.map((x) => ({ label: x.name || x.code, detail: `${x.code} · ${x.village}`, value: x.net_kg }))} empty="Aucune pesée." />
        </Panel>
      </div>

      {a.top_agents.length > 0 && (
        <Panel title="Agents les plus actifs" subtitle="Parcelles cartographiées sur 30 jours">
          <RankBars rows={a.top_agents.map((x) => ({ label: x.name, detail: `${fr(x.hectares, 1)} ha`, value: x.parcels }))} format={(x) => `${fr(x, 0)} parcelles`} />
        </Panel>
      )}

      {a.per_cooperative && (
        <Panel title="Par coopérative" subtitle={`${a.cooperatives} coopérative(s) · campagne ${v.campaign}`}>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr>{['Coopérative', 'Parcelles', 'Surface', 'Producteurs', 'Cacao pesé', 'Montant', 'Risque élevé'].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{a.per_cooperative.map((c) => (
              <tr key={c.id}><td className="px-3 py-2">{c.name}</td><td className="px-3 py-2 tabular-nums">{fr(c.parcels, 0)}</td>
                <td className="px-3 py-2 tabular-nums">{fr(c.hectares, 0)} ha</td><td className="px-3 py-2 tabular-nums">{fr(c.producers, 0)}</td>
                <td className="px-3 py-2 tabular-nums">{tonnes(c.net_kg)}</td><td className="px-3 py-2 tabular-nums">{fcfa(c.amount_fcfa)}</td>
                <td className={`px-3 py-2 tabular-nums ${c.high_risk ? 'font-semibold text-danger-text' : ''}`}>{fr(c.high_risk, 0)}</td></tr>))}
            </tbody></table></div>
        </Panel>
      )}
    </div>
  )
}
