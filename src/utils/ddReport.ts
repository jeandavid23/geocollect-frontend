/**
 * Rapport de diligence raisonnée EUDR (art. 9 à 12) : PDF lisible par un auditeur non spécialiste, Excel (une ligne
 * par parcelle, toutes les preuves), GeoJSON (géométries + attributs), export TRACES et manifeste de traçabilité.
 * Les textes sont regroupés dans TXT pour la future version anglaise.
 */
import type { DDAnalysis, DDCatalog, DDDecision, DDResult, Risk } from '../api/dd'
import { FOREST_LABEL, RISK_LABEL, SOURCE_LABEL, CONCORDANCE_LABEL, WHISP_STATUS_LABEL } from '../api/dd'
import { buildTraces } from './traces'
import { downloadBlob } from './geoExport'

export type GeometryLookup = (id: string) => GeoJSON.Geometry | null

const TXT = {
  title: 'Rapport de diligence raisonnée',
  subtitle: 'Règlement (UE) 2023/1115 relatif à la déforestation (EUDR) — articles 9, 10 et 11',
  method: [
    "L'analyse croise plusieurs jeux de données publiés et reconnus (« convergence de preuves »), au lieu de s'appuyer sur une seule carte.",
    "1. Contrôle des géométries : coordonnées WGS84 à 6 décimales, polygones valides, polygone obligatoire au-delà de 4 ha.",
    "2. Forêt au 31/12/2020 : chaque source « vote » si elle classe au moins le seuil indiqué de la parcelle en forêt. La parcelle est « forêt » si le nombre de votes atteint le minimum ; « incertaine » avec un seul vote ou si la carte de référence de l'UE (JRC 2020) indique de la forêt.",
    "3. Perte après 2020 : seules les pertes situées dans les pixels qui étaient forêt en 2020 sont comptées ; une même perte vue par plusieurs sources n'est comptée qu'une fois (union des pixels).",
    "4. Contexte : usage agricole établi avant la date butoir (cultures, perturbations antérieures), aires protégées (WDPA, KBA), domaine forestier national (forêts classées, parcs, enclaves).",
    "5. Classement : risque faible, à vérifier ou élevé, avec un score de convergence (0 à 100) et une justification lisible. La logique suit celle de l'outil WHISP de la FAO pour les cultures pérennes (cacao, café).",
  ],
  limits: [
    "Résolution des données de 10 à 30 m : les petites parcelles et les bordures sont mesurées avec une incertitude.",
    "Le cacao agroforestier (sous ombrage) peut être confondu avec de la forêt par certaines cartes ; c'est pourquoi aucune source n'est utilisée seule.",
    "Nuages et dates d'acquisition peuvent retarder la détection des pertes récentes.",
    "Les jeux de données sont des aides à la décision : ils ne constituent pas une preuve juridique. Les parcelles « à vérifier » ou « élevé » doivent faire l'objet d'une vérification (imagerie, visite terrain, documents).",
  ],
  legality: [
    ["Droits d'usage des terres", 'land'], ['Protection de l\'environnement', 'env'], ['Droit du travail', 'work'],
    ['Droits humains', 'rights'], ['Consentement libre, préalable et éclairé (CLIP)', 'fpic'], ['Fiscalité', 'tax'],
    ['Lutte contre la corruption', 'corruption'], ['Réglementation commerciale et douanière', 'trade'],
  ],
  declaration: "L'opérateur déclare avoir exercé la diligence raisonnée prévue aux articles 8 à 11 du règlement (UE) 2023/1115 pour les produits couverts par ce rapport, sur la base des informations, de l'évaluation des risques et des mesures d'atténuation décrites ci-dessus.",
}

const pdfText = (v: unknown) => String(v ?? '').replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[→]/g, '->')
  .replace(/[  ]/g, ' ').replace(/[“”]/g, '"').replace(/[’]/g, "'").replace(/[…]/g, '...')
const fr = (n: number | null | undefined, d = 2) => (n == null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: d }).replace(/[  ]/g, ' '))
const date = (s?: string | null) => (s ? new Date(s).toLocaleDateString('fr-FR') : '—')

export function lastDecision(decisions: DDDecision[] | undefined, key: string) {
  const list = (decisions ?? []).filter((d) => d.parcel_key === key)
  return list[list.length - 1] ?? null
}

/** Ligne « à plat » d'une parcelle : toutes les colonnes de preuve (Excel, GeoJSON). */
export function flatRow(r: DDResult, decisions?: DDDecision[]) {
  const c = r.classification, e = r.evidence, ctx = r.context
  const dec = lastDecision(decisions, r.id)
  const row: Record<string, string | number | null> = {
    identifiant: r.properties.label, type: r.properties.kind === 'parcel' ? 'Parcelle mappée' : 'Ancien polygone',
    code_producteur: r.properties.producer_code, producteur: r.properties.producer, village: r.properties.village,
    surface_ha: e?.area_ha ?? r.geometry_report?.area_ha ?? null, geometrie: r.geometry_report?.kind ?? '',
    rejetee: r.rejected ? 'OUI' : 'NON', motif_rejet: (r.reasons ?? []).join(' ; '),
    risque: c ? RISK_LABEL[c.risk] : '', score_convergence: c?.score ?? null, foret_2020: c ? FOREST_LABEL[c.forest2020] : '',
    votes_foret_2020: c ? `${c.forest2020_votes}/${c.forest2020_available.length}` : '',
    sources_foret_2020: c?.forest2020_sources.map((s) => SOURCE_LABEL[s] ?? s).join(', ') ?? '',
  }
  for (const s of ['jrc_gfc2020', 'tmf', 'worldcover2020', 'hansen']) row[`foret2020_${s}_pct`] = e?.forest2020[s]?.pct ?? null
  row.perte_post2020_ha = e?.loss_post2020_ha ?? null
  row.perte_post2020_pct = e?.loss_post2020_pct ?? null
  row.sources_perte = c?.loss_sources.map((s) => SOURCE_LABEL[s] ?? s).join(', ') ?? ''
  for (const [s, v] of Object.entries(e?.loss_post2020 ?? {})) {
    row[`perte_${s}_ha`] = v.ha
    row[`perte_${s}_annees`] = v.first_year ? (v.first_year === v.last_year ? String(v.first_year) : `${v.first_year}-${v.last_year}`) : ''
  }
  row.perturbation_avant_2020_pct = c?.predisturbance_pct ?? null
  row.culture_2020_pct = c?.commodity2020_pct ?? null
  row.usage_agricole_avant_2021 = c ? (c.agri_before_cutoff ? 'OUI' : 'NON') : ''
  row.aires_protegees = (ctx?.protected ?? []).map((p) => `${p.name} (${p.kind}, ${fr(p.pct, 1)} %)`).join(' ; ')
  row.categorie_fonciere = ctx?.rdue?.category ?? ''
  row.zone_fonciere = ctx?.rdue?.zone ?? ''
  row.legalite_fonciere = ctx?.rdue?.legalite ?? ''
  row.justification = c?.justification.fr ?? ''
  row.whisp_risque = r.whisp_risk ?? ''
  row.whisp_concordance = CONCORDANCE_LABEL[r.whisp_concordance] ?? ''
  row.whisp_logique_sur_nos_donnees = c?.whisp_like ?? ''
  row.decision_humaine = dec?.decision_label ?? ''
  row.decision_commentaire = dec?.comment ?? ''
  row.decision_auteur = dec?.author_name ?? ''
  row.decision_date = dec ? date(dec.created_at) : ''
  return row
}

/** Parcelles retenues pour la déclaration : risque faible, ou risque levé par une décision humaine documentée. */
export function retainedForDeclaration(a: DDAnalysis) {
  return (a.results ?? []).filter((r) => {
    if (r.rejected || !r.classification) return false
    const d = lastDecision(a.decisions, r.id)
    if (d?.decision === 'exclure' || d?.decision === 'confirmer') return false
    return r.classification.risk === 'faible' || d?.decision === 'lever'
  })
}

// ── Excel ──────────────────────────────────────────────────────────────────────────────────────

export async function ddExcel(a: DDAnalysis, cat: DDCatalog | null) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const s = a.summary as DDAnalysis['summary'] & { counts?: Record<Risk, number> }
  const synth = [
    [TXT.title], [TXT.subtitle], [],
    ['Coopérative / opérateur', a.report_meta.operator || a.cooperative_name], ['Périmètre', a.scope.label],
    ['Analyse', a.id], ['Date', new Date(a.created_at).toLocaleString('fr-FR')], ['Conservation jusqu’au', date(a.keep_until)],
    [], ['Parcelles analysées', s.analysed ?? 0], ['Parcelles rejetées', s.rejected ?? 0], ['Surface totale (ha)', s.total_area_ha ?? 0],
    ['Risque faible', s.counts?.faible ?? 0], ['À vérifier', s.counts?.a_verifier ?? 0], ['Risque élevé', s.counts?.eleve ?? 0],
    ['Concordance WHISP (%)', s.whisp_concordance_rate ?? 'non calculée'], ['WHISP', WHISP_STATUS_LABEL[a.whisp_status] ?? a.whisp_status],
    ['Conclusion', s.conclusion === 'negligeable' ? 'Risque négligeable' : 'Risque non négligeable'],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(synth), 'Synthèse')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((a.results ?? []).map((r) => flatRow(r, a.decisions))), 'Parcelles')
  if (cat) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cat.datasets.map((d) => ({
    jeu: d.name, producteur: d.producer, version: d.version, resolution: d.resolution, licence: d.licence, citation: d.citation }))), 'Jeux de données')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(a.thresholds).map(([k, v]) => ({ seuil: k, valeur: String(v) }))), 'Seuils')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((a.decisions ?? []).map((d) => ({
    parcelle: (a.results ?? []).find((r) => r.id === d.parcel_key)?.properties.label ?? d.parcel_key, decision: d.decision_label,
    commentaire: d.comment, auteur: d.author_name, date: new Date(d.created_at).toLocaleString('fr-FR'), piece_jointe: d.attachment_name }))), 'Décisions')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['manifest.json'], [JSON.stringify(a.manifest ?? {}, null, 1)]]), 'Manifeste')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `diligence_${slug(a)}.xlsx`)
}

// ── GeoJSON, TRACES, manifeste ─────────────────────────────────────────────────────────────────

export function ddGeoJSON(a: DDAnalysis, geom: GeometryLookup) {
  const features = (a.results ?? []).map((r) => ({ type: 'Feature', geometry: geom(r.id), properties: flatRow(r, a.decisions) }))
    .filter((f) => f.geometry)
  downloadBlob(new Blob([JSON.stringify({ type: 'FeatureCollection', features })], { type: 'application/geo+json' }), `diligence_${slug(a)}.geojson`)
  return features.length
}

export function ddTraces(a: DDAnalysis, geom: GeometryLookup, country = 'CI') {
  const items = retainedForDeclaration(a).map((r) => ({ id: r.properties.label, geometry: geom(r.id) as GeoJSON.Geometry,
    producerName: r.properties.producer, productionPlace: r.properties.village, areaHa: r.evidence?.area_ha ?? null }))
    .filter((i) => i.geometry)
  const res = buildTraces(items, { country, pointsUnder4ha: false, fillHoles: false }, `traces_${slug(a)}`)
  if (res.files[0]) downloadBlob(new Blob([res.files[0].content], { type: 'application/geo+json' }), res.files[0].name)
  return res
}

export function ddManifest(a: DDAnalysis) {
  downloadBlob(new Blob([JSON.stringify(a.manifest ?? {}, null, 2)], { type: 'application/json' }), `manifest_${slug(a)}.json`)
}

function slug(a: DDAnalysis) {
  return `${(a.scope.label || a.cooperative_name).normalize('NFD').replace(/[^\w]+/g, '_').toLowerCase()}_${a.created_at.slice(0, 10)}`
}

// ── PDF ────────────────────────────────────────────────────────────────────────────────────────

export async function ddPdf(a: DDAnalysis, cat: DDCatalog | null, geom: GeometryLookup, legal: Record<string, string> = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  const green: [number, number, number] = [24, 58, 37]
  const s = a.summary as Required<DDAnalysis>['summary'] & { counts: Record<Risk, number>; area_ha: Record<Risk, number> }
  const results = a.results ?? []
  const valid = results.filter((r) => !r.rejected)
  const meta = a.report_meta || {}
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  let y = 0

  const section = (n: string, title: string) => {
    doc.addPage(); y = 18
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...green)
    doc.text(pdfText(`${n}. ${title}`), 14, y); y += 8
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40)
  }
  const para = (text: string, size = 10) => {
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(pdfText(text), W - 28)
    if (y + lines.length * 5 > H - 18) { doc.addPage(); y = 18 }
    doc.text(lines, 14, y); y += lines.length * (size * 0.45) + 2
  }
  const table = (head: string[], body: (string | number)[][], opts: Record<string, unknown> = {}) => {
    autoTable(doc, { startY: y, head: [head.map(pdfText)], body: body.map((r) => r.map((c) => pdfText(c))), theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.4 }, headStyles: { fillColor: green }, margin: { left: 14, right: 14 }, ...opts })
    y = lastY() + 6
  }

  // 1. Page de garde
  doc.setFillColor(...green); doc.rect(0, 0, W, 60, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text(pdfText(TXT.title), 14, 28)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(doc.splitTextToSize(pdfText(TXT.subtitle), W - 28), 14, 38)
  doc.setTextColor(40, 40, 40); y = 74
  table(['Page de garde', ''], [
    ['Opérateur / coopérative', meta.operator || a.cooperative_name], ['Périmètre analysé', a.scope.label + (a.lot_code ? ` (lot ${a.lot_code})` : '')],
    ['Produit', `${meta.product === 'cafe' ? 'Café' : 'Cacao'} — code SH ${meta.hs_code || (meta.product === 'cafe' ? '0901' : '1801')}`],
    ['Quantité', meta.quantity_kg ? `${fr(meta.quantity_kg, 0)} kg` : 'à renseigner'],
    ['Période de production', meta.period_start || meta.period_end ? `${date(meta.period_start)} au ${date(meta.period_end)}` : 'à renseigner'],
    ['Pays et région de production', `${meta.country || 'CI'} — ${meta.region || 'à renseigner'}`],
    ["Identifiant de l'analyse", a.id], ['Date', new Date(a.created_at).toLocaleString('fr-FR')],
    ['Version', `GeoCollect ${(a.manifest as { tool?: { version?: string } })?.tool?.version ?? ''} · moteur eudr_evidence ${cat?.engine_version ?? ''}`],
    ['Conservation', `jusqu'au ${date(a.keep_until)} (art. 12 : 5 ans)`],
  ], { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } } })

  // 2. Résumé exécutif
  section('2', 'Résumé exécutif')
  const negl = s.conclusion === 'negligeable'
  doc.setFillColor(...(negl ? [232, 243, 235] as [number, number, number] : [253, 236, 236] as [number, number, number]))
  doc.rect(14, y - 4, W - 28, 16, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...(negl ? green : [153, 27, 27] as [number, number, number]))
  doc.text(pdfText(negl ? 'Conclusion : risque NÉGLIGEABLE pour ce périmètre' : 'Conclusion : risque NON NÉGLIGEABLE — mesures d’atténuation requises'), 18, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40); y += 18
  table(['Indicateur', 'Valeur'], [
    ['Parcelles analysées', s.analysed], ['Parcelles rejetées (géométrie)', s.rejected], ['Surface totale (ha)', fr(s.total_area_ha)],
    ['Risque faible', `${s.counts.faible} parcelle(s) · ${fr(s.area_ha.faible)} ha`], ['À vérifier', `${s.counts.a_verifier} parcelle(s) · ${fr(s.area_ha.a_verifier)} ha`],
    ['Risque élevé', `${s.counts.eleve} parcelle(s) · ${fr(s.area_ha.eleve)} ha`],
    ['Concordance avec WHISP', s.whisp_concordance_rate != null ? `${fr(s.whisp_concordance_rate, 1)} %` : `non calculée (${WHISP_STATUS_LABEL[a.whisp_status]})`],
  ], { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } } })
  // barres de répartition
  const total = Math.max(1, s.analysed)
  let x = 14
  for (const k of ['faible', 'a_verifier', 'eleve'] as Risk[]) {
    const w = ((W - 28) * s.counts[k]) / total
    if (w > 0) { doc.setFillColor(...hex(k)); doc.rect(x, y, w, 7, 'F'); x += w }
  }
  y += 11
  doc.setFontSize(8); doc.text(pdfText('Vert : faible · Orange : à vérifier · Rouge : élevé'), 14, y); y += 6

  // 3. Collecte d'informations (art. 9)
  section('3', "Collecte d'informations (article 9)")
  const points = valid.filter((r) => r.geometry_report?.kind === 'point').length
  const big = valid.filter((r) => r.geometry_report?.needs_polygon).length
  const producers = new Set(results.map((r) => r.properties.producer_code).filter(Boolean)).size
  table(['Élément', 'Situation'], [
    ['Format de géolocalisation', 'WGS84 (EPSG:4326), coordonnées arrondies à 6 décimales'],
    ['Polygones / points', `${valid.length - points} polygone(s), ${points} point(s)`],
    ['Points de plus de 4 ha (polygone obligatoire)', big ? `${big} — à cartographier en polygone` : 'aucun'],
    ['Contrôles géométriques', `validité, anneaux, surface géodésique ; ${s.rejected} géométrie(s) rejetée(s)`],
    ['Producteurs concernés', `${producers} producteur(s) identifiés par leur code du registre`],
    ['Documents disponibles', `${(a.decisions ?? []).filter((d) => d.attachment_name).length} pièce(s) jointe(s) aux décisions`],
  ], { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } } })
  const rejected = results.filter((r) => r.rejected)
  if (rejected.length) table(['Parcelle rejetée', 'Motif'], rejected.slice(0, 60).map((r) => [r.properties?.label ?? r.id, (r.reasons ?? []).join(' ; ')]))

  // 4. Méthodologie
  section('4', 'Méthodologie : la convergence de preuves')
  TXT.method.forEach((m) => para(m))
  y += 2
  if (cat) table(['Jeu de données', 'Producteur', 'Version', 'Résolution', 'Licence'],
    cat.datasets.filter((d) => !['radd', 'glad_l', 'fdp_palm', 'fdp_rubber'].includes(d.id) || a.whisp_status === 'execute')
      .map((d) => [d.name, d.producer, d.version, d.resolution, d.licence]), { styles: { fontSize: 7, cellPadding: 1.2 } })
  table(['Seuil', 'Valeur'], Object.entries(a.thresholds).map(([k, v]) => [k, String(v)]), { columnStyles: { 0: { cellWidth: 90 } } })
  para(`WHISP (FAO) : ${WHISP_STATUS_LABEL[a.whisp_status] ?? a.whisp_status}${a.whisp_version ? ` — version ${a.whisp_version}` : ''}. ${a.whisp_status === 'non_execute' ? "Sans Google Earth Engine, l'analyse repose sur les jeux de données lus directement (JRC, TMF, WorldCover, Hansen) ; les alertes RADD / GLAD et les cartes de cultures ne sont pas utilisées." : ''}`)
  if (cat) { y += 2; para('Citations :', 9); cat.datasets.forEach((d) => para(`• ${d.citation}`, 8)) }

  // 5. Évaluation du risque (art. 10)
  section('5', 'Évaluation du risque (article 10)')
  const cnt = (f: (r: DDResult) => boolean) => valid.filter(f).length
  table(['Critère', 'Résultat'], [
    ['Forêt au 31/12/2020', `${cnt((r) => r.classification?.forest2020 === 'oui')} forêt · ${cnt((r) => r.classification?.forest2020 === 'incertain')} incertaine(s) · ${cnt((r) => r.classification?.forest2020 === 'non')} non forêt`],
    ['Perte après le 31/12/2020', `${cnt((r) => (r.classification?.loss_sources.length ?? 0) > 0)} parcelle(s) avec perte signalée, dont ${cnt((r) => (r.classification?.loss_sources.length ?? 0) >= 2)} confirmée(s) par au moins 2 sources`],
    ['Alertes récentes (RADD, GLAD)', a.whisp_status === 'execute' ? 'intégrées via WHISP' : 'non disponibles sans Earth Engine'],
    ['Usage agricole avant la date butoir', `${cnt((r) => !!r.classification?.agri_before_cutoff)} parcelle(s)`],
    ['Aires protégées (WDPA, KBA)', `${cnt((r) => (r.context?.protected?.length ?? 0) > 0)} parcelle(s) en intersection`],
    ['Domaine forestier classé (RDUE)', `${cnt((r) => !!r.classification?.rdue_illegal)} parcelle(s) en forêt classée ou parc`],
    ['Classement du pays par l’UE', `${meta.country || 'CI'} : risque ${cat?.regulation.country_risk[meta.country || 'CI'] ?? 'standard'}`],
    ['Complexité de la chaîne d’approvisionnement', `${producers} producteur(s), ${valid.length} parcelle(s)${a.lot_code ? `, lot ${a.lot_code}` : ''}`],
  ], { columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } } })
  para('Légalité de la production (article 2, point 40) — éléments à documenter :', 10)
  table(['Domaine', 'Statut'], TXT.legality.map(([label, key]) => [label, legal[key] || 'à fournir']))

  // 6. Mesures d'atténuation (art. 11)
  section('6', "Mesures d'atténuation (article 11)")
  const risky = valid.filter((r) => r.classification && r.classification.risk !== 'faible')
  if (!risky.length) para('Aucune parcelle à risque : pas de mesure d’atténuation nécessaire.')
  else {
    para(`${risky.length} parcelle(s) « à vérifier » ou « élevé ». Actions recommandées : vérification sur imagerie avant / après 2020, visite terrain, obtention des documents fonciers ; exclusion du lot si le risque est confirmé.`)
    table(['Parcelle', 'Producteur', 'Risque', 'Justification', 'Décision humaine'], risky.slice(0, 400).map((r) => {
      const d = lastDecision(a.decisions, r.id)
      return [r.properties.label, r.properties.producer, RISK_LABEL[r.classification!.risk], r.classification!.justification.fr,
        d ? `${d.decision_label} — ${d.author_name}, ${date(d.created_at)}${d.comment ? ` : ${d.comment}` : ''}` : 'aucune']
    }), { styles: { fontSize: 7, cellPadding: 1.2 }, columnStyles: { 3: { cellWidth: 70 } } })
  }

  // 7. Conclusion et signature
  section('7', 'Conclusion et signature')
  para(negl ? 'Au vu de la collecte d’informations et de l’évaluation ci-dessus, le risque que les produits couverts proviennent de parcelles déboisées après le 31/12/2020 est NÉGLIGEABLE.'
    : 'Le risque n’est pas négligeable : les produits issus des parcelles à risque ne doivent pas être mis sur le marché tant que les mesures d’atténuation n’ont pas ramené le risque à un niveau négligeable.')
  y += 4; para(TXT.declaration)
  y += 10
  doc.setDrawColor(150, 150, 150)
  doc.text(pdfText(`Responsable : ${meta.responsible || '................................................'}`), 14, y); y += 10
  doc.text(pdfText('Date : ....../....../............'), 14, y)
  doc.text(pdfText('Signature :'), W / 2, y); doc.rect(W / 2 + 22, y - 6, 60, 22)

  // 8. Annexes : carte de synthèse, tableau complet, limites, traçabilité
  section('8', 'Annexes')
  y = drawMap(doc, valid, geom, 14, y, W - 28, 95)
  para('Carte de synthèse : parcelles colorées selon le risque (vert : faible, orange : à vérifier, rouge : élevé).', 8)
  table(['Parcelle', 'Producteur', 'ha', 'Forêt 2020', 'Perte post-2020', 'Contexte', 'Risque', 'Score', 'WHISP'],
    results.map((r) => {
      const c = r.classification
      return [r.properties?.label ?? r.id, r.properties?.producer ?? '', fr(r.evidence?.area_ha ?? r.geometry_report?.area_ha),
        c ? `${FOREST_LABEL[c.forest2020]} (${c.forest2020_sources.map((x) => SOURCE_LABEL[x] ?? x).join(', ') || '—'})` : 'rejetée',
        c && c.loss_sources.length ? `${fr(c.loss_post2020_ha)} ha (${c.loss_sources.map((x) => SOURCE_LABEL[x] ?? x).join(', ')})` : '—',
        [...(r.context?.protected ?? []).map((p) => p.name), r.context?.rdue?.legalite === 'Non conforme' ? r.context?.rdue?.zone : ''].filter(Boolean).join(', ') || '—',
        c ? RISK_LABEL[c.risk] : '—', c?.score ?? '—', CONCORDANCE_LABEL[r.whisp_concordance] ?? '—']
    }), { styles: { fontSize: 6.5, cellPadding: 1 } })
  para('Limites de la méthode :', 10)
  TXT.limits.forEach((l) => para(`• ${l}`, 9))
  const m = (a.manifest ?? {}) as { input?: { sha256?: string }; datasets?: Record<string, string> }
  para(`Traçabilité : empreinte SHA-256 des parcelles analysées ${m.input?.sha256 ?? '—'} ; versions : ${Object.entries(m.datasets ?? {}).map(([k, v]) => `${k} ${v}`).join(', ')}.`, 8)

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140, 140, 140)
    doc.text(pdfText(`Diligence raisonnée — ${a.scope.label} — analyse ${a.id.slice(0, 8)} — page ${i}/${n}`), 14, H - 7)
  }
  doc.save(`diligence_raisonnee_${slug(a)}.pdf`)
}

function hex(k: Risk): [number, number, number] {
  return k === 'faible' ? [21, 128, 61] : k === 'a_verifier' ? [217, 119, 6] : [185, 28, 28]
}

/** Carte vectorielle simple (sans fond) : emprise des parcelles, contours colorés par risque. */
function drawMap(doc: InstanceType<typeof import('jspdf').jsPDF>, rows: DDResult[], geom: GeometryLookup, x0: number, y0: number, w: number, h: number) {
  const shapes = rows.map((r) => ({ r, g: geom(r.id) })).filter((s) => s.g)
  doc.setDrawColor(200, 200, 200); doc.setFillColor(246, 243, 236); doc.rect(x0, y0, w, h, 'FD')
  if (!shapes.length) return y0 + h + 4
  let minx = 180, miny = 90, maxx = -180, maxy = -90
  const rings = (g: GeoJSON.Geometry): number[][][] => g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : g.type === 'Point' ? [[g.coordinates]] : []
  for (const s of shapes) for (const ring of rings(s.g!)) for (const [lx, ly] of ring) { minx = Math.min(minx, lx); maxx = Math.max(maxx, lx); miny = Math.min(miny, ly); maxy = Math.max(maxy, ly) }
  const sx = (w - 8) / Math.max(1e-9, maxx - minx), sy = (h - 8) / Math.max(1e-9, maxy - miny), k = Math.min(sx, sy)
  const px = (lx: number) => x0 + 4 + (lx - minx) * k, py = (ly: number) => y0 + h - 4 - (ly - miny) * k
  for (const s of shapes) {
    doc.setDrawColor(...hex(s.r.classification?.risk ?? 'a_verifier')); doc.setLineWidth(0.3)
    for (const ring of rings(s.g!)) {
      if (ring.length === 1) { doc.circle(px(ring[0][0]), py(ring[0][1]), 0.6); continue }
      for (let i = 1; i < ring.length; i++) doc.line(px(ring[i - 1][0]), py(ring[i - 1][1]), px(ring[i][0]), py(ring[i][1]))
    }
  }
  return y0 + h + 4
}
