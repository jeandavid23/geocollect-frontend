/**
 * Explication en langage clair d'un résultat de l'analyse déforestation (Hansen) : pourquoi la parcelle a ce statut,
 * et ce qu'il faut faire. Reprend exactement les règles du serveur (apps/parcels/deforestation.py : classify,
 * risk_level_for) et de la matrice RDUE.
 */
import type { DeforestationOptions, DeforestationResult } from '../api/deforestation'

export interface Explanation { why: string[]; todo: string }

const n = (v: number | undefined, d = 2) => (v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: d })
const CUTOFF: Record<DeforestationOptions['standard'], string> = { EUDR: '31/12/2020', RA: '31/12/2013', 'EUDR+RA': '31/12/2013' }

export function explainHansen(r: DeforestationResult, o: DeforestationOptions): Explanation {
  if (r.status === 'Indetermine') {
    return { why: [r.error || "La parcelle n'a pas pu être analysée."], todo: 'Vérifier la géométrie de la parcelle (Polygon Validator), puis relancer.' }
  }
  const why: string[] = []
  const cutoff = CUTOFF[o.standard]
  if (r.forest2000_pct != null) {
    why.push(`En 2000, ${n(r.forest2000_pct, 1)} % de la parcelle avait un couvert arboré d'au moins ${o.treecover_min} % (définition FAO de la forêt).`)
  }
  if (r.jrc_forest2020_pct != null) {
    why.push(`Selon la carte forêt 2020 de l'Union européenne (JRC), ${n(r.jrc_forest2020_pct, 1)} % de la parcelle était en forêt au 31/12/2020.`)
  }
  const loss = r.defor_ha ?? 0
  if (r.status === 'Conforme') {
    why.push(loss > 0
      ? `Perte détectée après le ${cutoff} : ${n(loss, 3)} ha, inférieure à la tolérance de ${n(o.tolerance_ha)} ha (un bord de pixel, imprécision du relevé).`
      : `Aucune perte de couvert forestier détectée après le ${cutoff}.`)
  } else {
    why.push(`Perte de couvert forestier détectée après le ${cutoff} : ${n(loss, 3)} ha, soit ${n(r.defor_pct, 1)} % de la parcelle${r.years ? ` (année${r.years.includes(',') ? 's' : ''} ${r.years})` : ''}.`)
    why.push(r.status === 'A risque'
      ? `C'est au-dessus de la tolérance (${n(o.tolerance_ha)} ha) mais pas plus de ${n(o.alert_pct, 1)} % de la parcelle : « à risque », à vérifier.`
      : `C'est plus de ${n(o.alert_pct, 1)} % de la parcelle : « non conforme ».`)
  }
  if (r.cover2020) why.push(`Usage du sol au 31/12/2020 : ${r.cover2020 === 'Foret' ? 'forêt' : 'agriculture'}.`)
  if (r.usage_cat) {
    why.push(`Domaine foncier : ${r.usage_cat}${r.zone ? ` (${r.zone})` : ''} — légalité ${(r.legalite ?? '').toLowerCase()}, zéro déforestation ${(r.zero_def ?? '').toLowerCase()} : ${r.rdue_stat}.`)
  }
  let todo = 'Aucune action : parcelle déclarable.'
  if (r.rdue_stat === 'Non conforme' && r.legalite === 'Non conforme') {
    todo = 'Parcelle en forêt classée ou en parc : exclure du lot, sauf titre ou dérogation officielle.'
  } else if (r.status === 'Non conforme') {
    todo = 'Comparer les images avant / après 2020 et faire une visite terrain ; exclure la parcelle si la perte est confirmée.'
  } else if (r.status === 'A risque') {
    todo = 'Contrôler sur les images satellites ; la perte est faible et peut venir d’un bord de parcelle ou d’une ombre.'
  }
  return { why, todo }
}

/** Ce que signifie chaque niveau de risque (part de la parcelle perdue après la date butoir). */
export const RISK_LEVELS_TEXT = [
  ['Faible', 'aucune perte'], ['Modéré', 'jusqu’à 2 % de la parcelle'], ['Élevé', 'de 2 à 10 %'], ['Très élevé', 'plus de 10 %'],
] as const
