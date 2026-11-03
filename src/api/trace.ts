import api from './client'
import type { Lot } from './lots'

/** Traçabilité des volumes : pesées (fiches de pesée), volumes par producteur, fiches d'accompagnement. */
export type Product = Lot['product']

export interface Delivery {
  id: string; number: string; cooperative: string; cooperative_name: string
  producer: string; producer_name: string; producer_code: string; village: string
  lot: string | null; lot_code: string | null; campaign: string; product: Product; delivery_date: string
  collection_point: string; bags: number; gross_kg: string; tare_kg: string; deduction_kg: string; net_kg: string
  moisture_pct: string | null; quality: string; unit_price: string | null; amount: string | null; weigher: string
  notes: string; status: 'valide' | 'annulee'; cancel_reason: string; cancelled_at: string | null
  created_by_name: string; created_at: string
}
export interface DeliveryPayload {
  producer: string; campaign: string; product: Product; delivery_date: string; collection_point?: string
  bags: number; gross_kg: number; tare_kg?: number | null; deduction_kg?: number; moisture_pct?: number | null
  quality?: string; unit_price?: number | null; weigher?: string; notes?: string
}
export interface Page<T> { count: number; next: string | null; previous: string | null; results: T[] }

export type VolumeStatus = 'ok' | 'a_surveiller' | 'depassement' | 'sans_surface'
export interface ProducerVolume {
  producer: string; code: string; name: string; village: string; deliveries: number; bags: number
  net_kg: number; in_lots_kg: number; not_in_lot_kg: number; amount: number; last_delivery: string | null
  area_ha: number; area_source: 'cartographiee' | 'anciens_polygones' | 'declaree' | 'inconnue'
  yield_kg_ha: number | null; capacity_kg: number | null; status: VolumeStatus
}
export interface Volumes {
  campaign: string; product: Product; thresholds: { watch_kg_ha: number; max_kg_ha: number }
  producers: ProducerVolume[]
  totals: { producers: number; deliveries: number; net_kg: number; in_lots_kg: number; not_in_lot_kg: number; amount: number
    producers_over_capacity: number; producers_to_watch: number; producers_without_area: number }
}

export interface TransportSlip {
  id: string; number: string; cooperative: string; cooperative_name: string; lot: string; lot_code: string
  plant: string | null; plant_name: string | null
  lot_product: Product; lot_campaign: string; issued_at: string; origin: string; destination: string; consignee: string
  carrier: string; vehicle_plate: string; trailer_plate: string; driver_name: string; driver_phone: string
  driver_licence: string; bags: number; gross_weight_kg: string; seals: string; notes: string
  status: SlipStatus; received_at: string | null; received_weight_kg: string | null
  received_by: string; reception_notes: string; weight_gap_kg: number | null; weight_gap_pct: number | null
  moisture_pct: string | null; bean_count: number | null; mouldy_pct: string | null; slaty_pct: string | null
  insect_pct: string | null; germinated_pct: string | null; foreign_pct: string | null
  decision: Decision | ''; decision_reason: string; quality: { grade: string | null; issues: string[] } | null
  created_by_name: string
}
export type SlipStatus = 'emise' | 'livree' | 'refusee' | 'annulee'
export type Decision = 'accepte' | 'reserve' | 'refuse'
export const DECISIONS: Record<Decision, string> = { accepte: 'Accepté', reserve: 'Accepté avec réserves', refuse: 'Refusé' }
export type QualityField = 'moisture_pct' | 'bean_count' | 'mouldy_pct' | 'slaty_pct' | 'insect_pct' | 'germinated_pct' | 'foreign_pct'
/** Contrôle qualité à la réception : libellé, unité, valeur maximale admise (norme ICCO / Conseil Café-Cacao). */
export const QUALITY_FIELDS: { key: QualityField; label: string; unit: string; limit: number }[] = [
  { key: 'moisture_pct', label: 'Humidité', unit: '%', limit: 8 },
  { key: 'bean_count', label: 'Grainage', unit: 'fèves / 100 g', limit: 120 },
  { key: 'mouldy_pct', label: 'Moisies', unit: '%', limit: 3 },
  { key: 'slaty_pct', label: 'Ardoisées', unit: '%', limit: 3 },
  { key: 'insect_pct', label: 'Mitées', unit: '%', limit: 3 },
  { key: 'germinated_pct', label: 'Germées', unit: '%', limit: 3 },
  { key: 'foreign_pct', label: 'Corps étrangers', unit: '%', limit: 1 },
]
export type ReceptionPayload = Partial<Record<QualityField, number | null>> & {
  received_weight_kg: number | null; decision: Decision; decision_reason?: string; reception_notes?: string
}
export type TransportPayload = Pick<TransportSlip, 'lot' | 'origin' | 'destination' | 'consignee' | 'carrier' | 'vehicle_plate'
  | 'trailer_plate' | 'driver_name' | 'driver_phone' | 'driver_licence' | 'seals' | 'notes'> & { bags: number; gross_weight_kg: number; plant?: string | null }

export interface DeliveryFilters { campaign?: string; product?: Product; producer?: string; lot?: string; status?: string; free?: boolean; q?: string; page?: number; page_size?: number }

export const traceApi = {
  deliveries: (f: DeliveryFilters = {}) => api.get<Page<Delivery>>('/lots/deliveries/', {
    params: { ...f, free: f.free ? 1 : undefined, page_size: f.page_size ?? 200 } }),
  createDelivery: (data: DeliveryPayload) => api.post<Delivery>('/lots/deliveries/', data),
  cancelDelivery: (id: string, reason: string) => api.post<Delivery>(`/lots/deliveries/${id}/cancel/`, { reason }),
  volumes: (campaign: string, product: Product = 'cacao') => api.get<Volumes>('/lots/volumes/', { params: { campaign, product } }),
  slips: (lot?: string, plant?: string) => api.get<TransportSlip[]>('/lots/transport/', { params: { lot, plant } }),
  createSlip: (data: TransportPayload) => api.post<TransportSlip>('/lots/transport/', data),
  receiveSlip: (id: string, data: ReceptionPayload) =>
    api.patch<TransportSlip>(`/lots/transport/${id}/`, data),
  cancelSlip: (id: string, reason: string) => api.patch<TransportSlip>(`/lots/transport/${id}/`, { status: 'annulee', notes: reason }),
}

export const VOLUME_STATUS: Record<VolumeStatus, { label: string; tone: string }> = {
  ok: { label: 'Cohérent', tone: 'bg-primary-50 text-primary-800' },
  a_surveiller: { label: 'À surveiller', tone: 'bg-amber-100 text-amber-800' },
  depassement: { label: 'Dépassement', tone: 'bg-red-100 text-red-800' },
  sans_surface: { label: 'Surface inconnue', tone: 'bg-gray-100 text-gray-700' },
}
export const AREA_SOURCE = { cartographiee: 'parcelles cartographiées', anciens_polygones: 'anciens polygones', declaree: 'surface déclarée', inconnue: '—' }
export const SLIP_STATUS: Record<SlipStatus, string> = { emise: 'En route', livree: 'Livrée', refusee: 'Refusée', annulee: 'Annulée' }

/** Campagne cacao en cours : d'octobre à septembre (ex. « 2026-2027 » à partir du 1er octobre 2026). */
export const currentCampaign = (d = new Date()) => { const y = d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${y + 1}` }

/** Tare par défaut (1 kg par sac de jute), poids net et montant : même calcul que le serveur. */
export function computeWeights(gross: number, bags: number, tare: number | null | undefined, deduction: number, price: number | null | undefined) {
  const t = tare ?? bags * 1
  const net = Math.round((gross - t - (deduction || 0)) * 10) / 10
  return { tare: t, net, amount: price ? Math.round(net * price) : null }
}

// ── Usinage et transformation ───────────────────────────────────────────────────────────────────────
export type Operation = 'usinage' | 'transformation'
export type OutputProduct = 'feves_usinees' | 'masse' | 'beurre' | 'tourteau' | 'poudre' | 'coques' | 'dechets' | 'autre'
export const OUTPUT_PRODUCTS: Record<OutputProduct, string> = {
  feves_usinees: 'Fèves usinées (export)', masse: 'Masse / liqueur de cacao', beurre: 'Beurre de cacao', tourteau: 'Tourteau',
  poudre: 'Poudre de cacao', coques: 'Coques', dechets: 'Déchets, poussières', autre: 'Autre',
}
export const OPERATION_LABEL: Record<Operation, string> = { usinage: 'Usinage', transformation: 'Transformation' }

export interface ProcessingBatch {
  id: string; code: string; operation: Operation; plant: string; process_date: string; notes: string
  status: 'en_cours' | 'cloture'; created_at: string; created_by_name: string; cooperatives: string[]
  inputs: { lot: string | null; lot_code: string | null; batch: string | null; batch_code: string | null; weight_kg: number }[]
  outputs: { product: OutputProduct; product_label: string; weight_kg: number; reference: string; byproduct: boolean }[]
  input_kg: number; output_kg: number; loss_kg: number; loss_pct: number; loss_warning: boolean
  compliant_share_pct: number | null
}
export interface ProcessingPayload {
  operation: Operation; plant: string; process_date: string; notes?: string
  inputs: { lot?: string; batch?: string; weight_kg: number }[]
  outputs: { product: OutputProduct; weight_kg: number; reference?: string }[]
}
export interface Trace {
  batches: { id: string; code: string; operation: Operation; plant: string; process_date: string }[]
  lots: { id: string; code: string; cooperative: string; campaign: string; lot_date: string }[]
  transport: { number: string; lot__code: string; destination: string; vehicle_plate: string; issued_at: string; status: string
    gross_weight_kg: number; received_weight_kg: number | null; received_at: string | null }[]
  deliveries: { number: string; date: string; net_kg: number; producer_code: string; lot: string }[]
  producers: { producer: string; code: string; name: string; village: string; weight_kg: number; lots: string[] }[]
  parcels: { field_id: string; producer_id: string; village: string; area_hectares: number; eudr_status: string }[]
  eudr: { parcels: number; area_ha: number; compliant_parcels: number; non_compliant_parcels: number }
}
export interface Downstream {
  batches: { id: string; code: string; operation: Operation; plant: string; process_date: string; weight_kg: number }[]
  processed_kg: number; available_kg: number
}

export const processingApi = {
  list: (plant?: string) => api.get<ProcessingBatch[]>('/lots/processing/', { params: plant ? { plant } : {} }),
  get: (id: string) => api.get<ProcessingBatch>(`/lots/processing/${id}/`),
  create: (data: ProcessingPayload) => api.post<ProcessingBatch>('/lots/processing/', data),
  close: (id: string) => api.patch<ProcessingBatch>(`/lots/processing/${id}/`, { status: 'cloture' }),
  trace: (id: string) => api.get<Trace>(`/lots/processing/${id}/trace/`),
}

// ── Usines (rôle « usine ») ─────────────────────────────────────────────────────────────────────────
export type TraceMode = 'bilan_masse' | 'segregue'
export type PlantRole = 'responsable' | 'pesee'
export const TRACE_MODES: Record<TraceMode, { label: string; help: string }> = {
  bilan_masse: { label: 'Bilan de masse', help: "Le mélange est admis ; la part d'origine vérifiée est comptée en poids et suit le produit." },
  segregue: { label: 'Ségrégé', help: "Seul le cacao d'origine vérifiée (toutes parcelles conformes) entre à l'usinage." },
}
export const PLANT_ROLES: Record<PlantRole, { label: string; help: string }> = {
  responsable: { label: "Responsable d'usine", help: 'Réceptions, usinage, expéditions, certificats.' },
  pesee: { label: 'Opérateur de pesée', help: 'Réception des camions uniquement (pont-bascule).' },
}
export interface Plant {
  id: string; name: string; location: string; is_active: boolean; cooperatives: { id: string; name: string }[]
  traceability_mode: TraceMode; gap_alert_pct: number; loss_alert_pct: number
  accounts?: { id: string; username: string; full_name: string; is_active: boolean; plant_role: PlantRole }[]
}
export interface Available {
  lots: { id: string; code: string; cooperative: string; product: Product; campaign: string; net_kg: number; available_kg: number }[]
  batches: { id: string; code: string; operation: Operation; available_kg: number }[]
}
export const plantsApi = {
  list: () => api.get<Plant[]>('/lots/plants/'),
  create: (data: { name: string; location?: string; cooperatives: string[] }) => api.post<Plant>('/lots/plants/', data),
  update: (id: string, data: Partial<{ name: string; location: string; cooperatives: string[]; is_active: boolean
    traceability_mode: TraceMode; gap_alert_pct: number; loss_alert_pct: number }>) =>
    api.patch<Plant>(`/lots/plants/${id}/`, data),
  createAccount: (id: string, data: { username: string; full_name?: string; email?: string; phone?: string; plant_role?: PlantRole }) =>
    api.post<{ id: string; username: string; full_name: string; plant_role: PlantRole; temporary_password: string }>(`/lots/plants/${id}/account/`, data),
  setRole: (id: string, user: string, plant_role: PlantRole) =>
    api.patch<{ id: string; plant_role: PlantRole }>(`/lots/plants/${id}/account/`, { user, plant_role }),
}
export const availableForProcessing = () => api.get<Available>('/lots/processing/available/')

// ── Opérations de l'usine : stock, tableau de bord, expéditions ─────────────────────────────────────
export interface PlantStock {
  on_the_way: { slip: string; lot: string; cooperative: string; issued_at: string; vehicle_plate: string; weight_kg: number }[]
  raw: { lot: string; lot_id: string; cooperative: string; slip: string; received_at: string; days: number | null; available_kg: number }[]
  finished: { batch: string; batch_id: string; operation: Operation; process_date: string; days: number; products: OutputProduct[]; available_kg: number }[]
  totals: { on_the_way_kg: number; raw_kg: number; finished_kg: number }
}
export interface PlantDashboard {
  plant: { id: string; name: string; traceability_mode: TraceMode; gap_alert_pct: number; loss_alert_pct: number }
  receptions: { trucks: number; sent_kg: number; received_kg: number; gap_pct: number | null; over_threshold: number
    refused: number; with_reserves: number; avg_moisture_pct: number | null; avg_mouldy_pct: number | null; avg_slaty_pct: number | null }
  by_cooperative: { name: string; received_kg: number; trucks: number }[]
  processing: Record<Operation, { batches: number; input_kg: number; output_kg: number; loss_pct: number | null }>
  shipments: { count: number; shipped: number; with_dds: number }
  monthly: { month: string; received_kg: number; trucks: number; shipped_kg: number }[]
}
export type ShipmentStatus = 'preparee' | 'expediee'
export const SHIPMENT_STATUS: Record<ShipmentStatus, string> = { preparee: 'En préparation', expediee: 'Expédiée' }
export interface ShipmentDocs {
  client: string; destination_country: string; container: string; seal: string; bill_of_lading: string; vessel: string
  dds_reference: string; dds_verification: string; notes: string
}
export interface Shipment extends ShipmentDocs {
  id: string; number: string; plant: string; plant_name: string; ship_date: string; status: ShipmentStatus; shipped_at: string | null
  items: { batch: string; batch_code: string; product: OutputProduct; product_label: string; weight_kg: number; bags: number }[]
  total_kg: number; created_by_name: string
}
export interface Shippable {
  batch: string; batch_code: string; operation: Operation; product: OutputProduct; product_label: string
  available_kg: number; compliant_share_pct: number | null
}
export interface ShipmentPayload extends Partial<ShipmentDocs> {
  ship_date: string; client: string; items: { batch: string; product: OutputProduct; weight_kg: number; bags?: number }[]
}
const plantParams = (plant?: string) => ({ params: plant ? { plant } : {} })
export const plantOpsApi = {
  stock: (plant?: string) => api.get<PlantStock>('/lots/plant/stock/', plantParams(plant)),
  dashboard: (plant?: string) => api.get<PlantDashboard>('/lots/plant/dashboard/', plantParams(plant)),
  shipments: (plant?: string) => api.get<Shipment[]>('/lots/plant/shipments/', plantParams(plant)),
  shippable: (plant?: string) => api.get<Shippable[]>('/lots/plant/shipments/shippable/', plantParams(plant)),
  createShipment: (data: ShipmentPayload) => api.post<Shipment>('/lots/plant/shipments/', data),
  updateShipment: (id: string, data: Partial<ShipmentDocs> & { status?: ShipmentStatus }) =>
    api.patch<Shipment>(`/lots/plant/shipments/${id}/`, data),
  shipmentTrace: (id: string) => api.get<Trace>(`/lots/plant/shipments/${id}/trace/`),
}
