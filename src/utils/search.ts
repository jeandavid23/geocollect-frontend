/** Ouvre la recherche globale (Ctrl+K) depuis n'importe quel bouton. */
export const openCommandPalette = () => window.dispatchEvent(new Event('geocollect:search'))
