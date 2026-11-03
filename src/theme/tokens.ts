/**
 * Couleurs de la charte GeoCollect, en valeurs (pour les cartes, graphiques et PDF, là où une classe Tailwind
 * ne s'applique pas). Mêmes valeurs que tailwind.config.js (success, warning, danger, info, risk).
 *
 * Deux jeux pour les mêmes sens :
 *  - UI    : badges, textes, PDF (sur fond clair) ;
 *  - MAP   : contours et remplissages sur l'imagerie satellite, plus lumineux pour rester visibles sur la végétation.
 */
export const STATUS = {
  ok: '#2c6741', warn: '#e08a1e', danger: '#b42318', info: '#1d4ed8', neutral: '#5b6472',
} as const

export const MAP = {
  ok: '#34c46a', warn: '#f5a524', danger: '#ef4444', info: '#3b82f6', neutral: '#9ca3af',
} as const

/** Niveaux de risque EUDR (faible, à vérifier, élevé) : différents aussi par la clarté (daltonisme, noir et blanc). */
export const RISK_UI = { faible: STATUS.ok, a_verifier: STATUS.warn, eleve: '#9b1c1c' } as const
export const RISK_MAP = { faible: MAP.ok, a_verifier: MAP.warn, eleve: MAP.danger } as const
/** Texte posé SUR la couleur de risque (badge plein) : foncé sur l'orange, blanc ailleurs (contraste ≥ 4,5:1). */
export const RISK_ON = { faible: '#ffffff', a_verifier: '#1f1300', eleve: '#ffffff' } as const
/** Couleur de risque utilisée comme TEXTE sur fond blanc (l'orange seul est trop pâle). */
export const RISK_TEXT = { faible: '#2c6741', a_verifier: '#9a520c', eleve: '#9b1c1c' } as const

/** Marque */
export const BRAND = { forest: '#235535', forestDark: '#183a25', gold: '#e9c98b' } as const

/**
 * Séries des graphiques (validées daltonisme : protan, deutan, tritan, et contraste ≥ 3:1 sur fond clair).
 * Les deux natures de parcelles ne prennent pas les couleurs de risque, réservées aux statuts.
 */
export const CHART = {
  series1: '#2e8b4f', series2: '#3b6fd4',                    // ordre fixe : 1re série verte, 2e série bleue
  mapped: '#2e8b4f', legacy: '#3b6fd4', received: '#2e8b4f', shipped: '#3b6fd4', volume: '#2e8b4f',
  grid: '#e5e7eb', axis: '#5b6472', track: '#eef0f3',
} as const
