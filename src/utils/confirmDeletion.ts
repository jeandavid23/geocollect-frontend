import { usersApi, type DeletionPreview } from '../api/users'

const LABELS: [keyof DeletionPreview, string][] = [
  ['cooperatives', 'coopérative(s)'], ['accounts', 'compte(s) de connexion'], ['producers', 'producteur(s)'],
  ['parcels', 'parcelle(s) mappée(s)'], ['legacy_polygons', 'ancien(s) polygone(s)'], ['registry_sheets', 'feuille(s) de registre'],
  ['lots', 'fiche(s) de lot'], ['reports', 'rapport(s)'], ['documents', 'document(s)'], ['logs', 'ligne(s) de journal'],
]

/**
 * Confirmation avant de supprimer des comptes : un compte supprimé emporte TOUTES ses données.
 * Affiche le détail fourni par le serveur ; si des coopératives, producteurs ou parcelles disparaissent,
 * il faut en plus saisir SUPPRIMER.
 */
export async function confirmAccountDeletion(userIds: string[], label: string): Promise<boolean> {
  let p: DeletionPreview | null = null
  try { p = (await usersApi.deletePreview(userIds)).data } catch { /* hors ligne / démo : confirmation simple */ }
  const lines = p ? LABELS.filter(([k]) => Number(p![k]) > 0).map(([k, l]) => `• ${Number(p![k]).toLocaleString('fr-FR')} ${l}`) : []
  const coops = p?.cooperative_names.length ? `\nCoopérative(s) effacée(s) : ${p.cooperative_names.join(', ')}\n` : ''
  const text = `Supprimer ${label} ET toutes les données associées ?\n\n${lines.length ? `Seront supprimés définitivement :\n${lines.join('\n')}\n` : ''}${coops}\nCette action est irréversible.`
  const heavy = !!p && (p.cooperatives > 0 || p.producers > 0 || p.parcels > 0)
  if (!heavy) return window.confirm(text)
  const typed = window.prompt(`${text}\n\nPour confirmer, saisissez SUPPRIMER :`)
  return (typed ?? '').trim().toUpperCase() === 'SUPPRIMER'
}
