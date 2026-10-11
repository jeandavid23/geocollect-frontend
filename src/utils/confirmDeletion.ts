import { usersApi, type DeletionPreview } from '../api/users'
import { confirmDialog } from '../components/ui/dialog'

const LABELS: [keyof DeletionPreview, string][] = [
  ['cooperatives', 'coopérative(s)'], ['accounts', 'compte(s) de connexion'], ['producers', 'producteur(s)'],
  ['parcels', 'parcelle(s) mappée(s)'], ['legacy_polygons', 'ancien(s) polygone(s)'], ['registry_sheets', 'feuille(s) de registre'],
  ['lots', 'fiche(s) de lot'], ['reports', 'rapport(s)'], ['documents', 'document(s)'], ['logs', 'ligne(s) de journal'],
]

/**
 * Confirmation avant de supprimer des comptes : un compte supprimé emporte TOUTES ses données.
 * Détail fourni par le serveur ; si des coopératives, producteurs ou parcelles disparaissent, il faut saisir SUPPRIMER.
 */
export async function confirmAccountDeletion(userIds: string[], label: string): Promise<boolean> {
  let p: DeletionPreview | null = null
  try { p = (await usersApi.deletePreview(userIds)).data } catch { /* hors ligne / démo : confirmation simple */ }
  const details = p ? LABELS.filter(([k]) => Number(p![k]) > 0).map(([k, l]) => `${Number(p![k]).toLocaleString('fr-FR')} ${l}`) : []
  if (p?.cooperative_names.length) details.unshift(`Coopérative(s) effacée(s) : ${p.cooperative_names.join(', ')}`)
  const heavy = !!p && (p.cooperatives > 0 || p.producers > 0 || p.parcels > 0)
  return confirmDialog({
    tone: 'danger', title: `Supprimer ${label} ?`,
    message: details.length ? 'Seront supprimés définitivement, avec le compte :' : 'Le compte et ses données seront supprimés définitivement.',
    details, confirmLabel: 'Supprimer définitivement', requireText: heavy ? 'SUPPRIMER' : undefined,
  })
}
