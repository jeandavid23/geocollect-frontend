/** Valeur d'un paramètre de l'adresse (ex. ?q=BA-SE-354 venant de la recherche globale), lue à l'ouverture de la page. */
export const queryParam = (name: string) => {
  try { return new URLSearchParams(window.location.search).get(name) ?? '' } catch { return '' }
}
