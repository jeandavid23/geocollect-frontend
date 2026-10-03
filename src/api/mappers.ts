// Convertit les objets de l'API Django (snake_case) vers les types frontend (camelCase)
import type { Cooperative, Agent, Producer, Parcel, LegacyParcel } from '../types'

type Any = Record<string, unknown>
const s = (v: unknown, d = '') => (v == null ? d : String(v))
const n = (v: unknown, d = 0) => (v == null || v === '' ? d : Number(v))

export function mapCooperative(c: Any): Cooperative {
  return {
    id: s(c.id),
    name: s(c.name),
    rccm: s(c.rccm),
    agrement: s(c.agrement),
    pca: s(c.pca),
    adg: s(c.adg),
    director: s(c.director),
    sigManager: s(c.sig_manager),
    phone: s(c.phone),
    email: s(c.email),
    address: s(c.address),
    region: s(c.region),
    country: s(c.country, "Côte d'Ivoire"),
    isActive: c.is_active !== false,
    createdAt: s(c.created_at),
    producerCount: n(c.producer_count),
    parcelCount: n(c.parcel_count),
    totalHectares: n(c.total_hectares),
    agentCount: n(c.agent_count),
    managedBy: c.managed_by ? s(c.managed_by) : null,
    managedByName: c.managed_by_name ? s(c.managed_by_name) : null,
  }
}

export function mapAgent(a: Any): Agent {
  return {
    id: s(a.id),
    userId: s(a.user),
    cooperativeId: s(a.cooperative),
    code: s(a.code),
    fullName: s(a.full_name),
    phone: s(a.phone),
    email: s(a.email),
    zone: s(a.zone),
    sections: Array.isArray(a.sections) ? (a.sections as string[]) : [],
    isActive: a.is_active !== false,
    createdAt: s(a.created_at),
    parcelCount: n(a.parcel_count),
    hectares: n(a.total_hectares),
  }
}

// Première valeur textuelle d'une ligne Excel (ex. « DOSSO Awa »), en ignorant numéros et codes
export function firstText(extra: unknown): string {
  const values = Object.values((extra as Record<string, unknown>) ?? {})
  const v = values.find((x) => typeof x === 'string' && /[A-Za-zÀ-ÿ]{2,}/.test(x) && !/\d/.test(x))
    ?? values.find((x) => typeof x === 'string' && x.trim() !== '')
  return v ? String(v).trim() : ''
}

export function mapProducer(p: Any): Producer {
  const first = s(p.first_name)
  const last = s(p.last_name)
  return {
    id: s(p.id),
    cooperativeId: s(p.cooperative),
    fieldIdBase: s(p.field_id_base),
    firstName: first,
    lastName: last,
    // Import Excel sans colonne nom : on affiche la 1re valeur du fichier, sinon le FIELD ID
    fullName: s(p.full_name).trim() || `${last.toUpperCase()} ${first}`.trim()
      || firstText(p.extra_data) || s(p.field_id_base),
    phone: s(p.phone) || undefined,
    village: s(p.village),
    section: s(p.section),
    region: s(p.region),
    country: s(p.country, "Côte d'Ivoire"),
    nationalId: s(p.national_id) || undefined,
    gender: (p.gender === 'F' ? 'F' : 'M'),
    birthYear: p.birth_year ? n(p.birth_year) : undefined,
    isActive: p.is_active !== false,
    createdAt: s(p.created_at),
    assignedAgentId: p.assigned_agent ? s(p.assigned_agent) : undefined,
    parcelCount: n(p.parcel_count),
    totalHectares: n(p.total_hectares),
    extraData: (p.extra_data && typeof p.extra_data === 'object') ? p.extra_data as Record<string, unknown> : undefined,
  }
}

export function mapLegacyParcel(p: Any): LegacyParcel {
  return {
    id: s(p.id),
    cooperativeId: s(p.cooperative),
    name: s(p.name),
    geometry: p.geometry as LegacyParcel['geometry'],
    properties: (p.properties as Record<string, unknown>) ?? {},
    areaHectares: p.area_hectares != null ? n(p.area_hectares) : null,
    sourceFile: s(p.source_file),
    createdAt: s(p.created_at),
  }
}

export function mapParcel(p: Any): Parcel {
  return {
    id: s(p.id),
    fieldId: s(p.field_id),
    producerId: s(p.producer),
    cooperativeId: s(p.cooperative),
    agentId: s(p.agent),
    name: s(p.name),
    geometry: (p.geometry as Parcel['geometry']) ?? { type: 'Polygon', coordinates: [] },
    areaHectares: n(p.area_hectares),
    perimeterMeters: n(p.perimeter_meters),
    vertexCount: n(p.vertex_count),
    culture: s(p.culture),
    village: s(p.village),
    section: s(p.section),
    region: s(p.region),
    country: s(p.country, "Côte d'Ivoire"),
    status: (s(p.status) || 'pending') as Parcel['status'],
    eudrScore: p.eudr_score != null ? n(p.eudr_score) : undefined,
    eudrStatus: (p.eudr_status as Parcel['eudrStatus']) ?? undefined,
    validationResult: (p.validation_result as Parcel['validationResult']) ?? undefined,
    isSynced: p.is_synced !== false,
    createdAt: s(p.created_at),
    updatedAt: s(p.updated_at),
  }
}

// Déballe une réponse paginée DRF ou un tableau simple
export function unwrap<T = Any>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  const d = data as { results?: T[] }
  return d?.results ?? []
}
