/** Registre normalisé de la coopérative (une ligne par parcelle) : en-têtes fixes, puis les polygones non rattachés. */
import { producersApi } from '../api/producers'
import { exportExcel } from './featureExport'

const HEADERS: Record<string, string> = {
  code_producteur: 'Code producteur', code_parcelle: 'Code parcelle', nom: 'Nom', prenoms: 'Prénoms', genre: 'Genre',
  telephone: 'Téléphone', village: 'Village', section: 'Section', region: 'Région', superficie_ha: 'Superficie (ha)',
  production_estimee_kg: 'Production estimée (kg)', polygone: 'Polygone', nb_polygones: 'Nombre de polygones',
  surface_polygones_ha: 'Surface des polygones (ha)', statut_eudr: 'Statut EUDR',
  code_lu: 'Code producteur lu', code_parcelle_lu: 'Code parcelle lu', surface_ha: 'Surface (ha)', fichier: 'Fichier importé',
}
const labelled = (rows: Record<string, unknown>[]) =>
  rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [HEADERS[k] ?? k, v ?? ''])))

export async function exportCoopRegistry(cooperative?: string): Promise<number> {
  const { data } = await producersApi.registryExport(cooperative)
  const sheets = [{ name: 'Registre', rows: labelled(data.rows) }]
  if (data.unlinked_polygons.length) sheets.push({ name: 'Polygones non rattachés', rows: labelled(data.unlinked_polygons) })
  exportExcel(sheets, `registre_${data.cooperative.replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  return data.rows.length
}
