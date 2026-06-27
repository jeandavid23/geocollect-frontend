// ─── User & Authentication ───────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'cooperative' | 'agent'

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  fullName: string
  phone?: string
  avatar?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  cooperativeId?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// ─── Cooperative ─────────────────────────────────────────────────────────────

export interface Cooperative {
  id: string
  name: string
  rccm: string
  agrement: string
  logo?: string
  pca: string
  adg: string
  director: string
  sigManager: string
  phone: string
  email: string
  address: string
  region: string
  country: string
  isActive: boolean
  createdAt: string
  producerCount?: number
  parcelCount?: number
  totalHectares?: number
  agentCount?: number
  documents?: Document[]
}

export interface Document {
  id: string
  name: string
  url: string
  type: string
  uploadedAt: string
}

// ─── Agent Mappeur ───────────────────────────────────────────────────────────

export interface Agent {
  id: string
  userId: string
  cooperativeId: string
  code: string
  fullName: string
  phone: string
  email: string
  zone: string
  isActive: boolean
  createdAt: string
  parcelCount?: number
  hectares?: number
  lastActivity?: string
}

// ─── Producteur ──────────────────────────────────────────────────────────────

export interface Producer {
  id: string
  cooperativeId: string
  fieldIdBase: string
  firstName: string
  lastName: string
  fullName: string
  phone?: string
  village: string
  section: string
  region: string
  country: string
  nationalId?: string
  gender: 'M' | 'F'
  birthYear?: number
  isActive: boolean
  createdAt: string
  assignedAgentId?: string
  parcelCount?: number
  totalHectares?: number
}

// ─── Parcelle ────────────────────────────────────────────────────────────────

export type ParcelStatus = 'draft' | 'pending' | 'validated' | 'rejected' | 'eudr_compliant' | 'eudr_non_compliant'

export interface Parcel {
  id: string
  fieldId: string
  producerId: string
  cooperativeId: string
  agentId: string
  name: string
  geometry: GeoJSONPolygon
  areaHectares: number
  perimeterMeters: number
  vertexCount: number
  culture: string
  village: string
  section: string
  region: string
  country: string
  status: ParcelStatus
  eudrScore?: number
  eudrStatus?: 'compliant' | 'non_compliant' | 'pending'
  validationResult?: ValidationResult
  mappingStartedAt?: string
  mappingEndedAt?: string
  syncedAt?: string
  isSynced: boolean
  createdAt: string
  updatedAt: string
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

// ─── EUDR Validation ─────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean
  eudrScore: number
  checks: ValidationCheck[]
  summary: string
  timestamp: string
}

export interface ValidationCheck {
  name: string
  label: string
  passed: boolean
  severity: 'error' | 'warning' | 'info'
  message: string
  value?: string | number
}

// ─── GPS Session ─────────────────────────────────────────────────────────────

export type MappingStatus = 'idle' | 'starting' | 'active' | 'paused' | 'finishing' | 'done'

export interface GPSPoint {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
  altitude?: number
  speed?: number
}

export interface MappingSession {
  id: string
  producerId: string
  parcelName: string
  status: MappingStatus
  points: GPSPoint[]
  startTime?: number
  pauseTime?: number
  totalPausedMs: number
  currentAccuracy?: number
  currentSpeed?: number
  distanceCovered?: number
  areaLive?: number
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalProducers: number
  totalParcels: number
  totalHectares: number
  totalAgents: number
  totalVillages: number
  totalSections: number
  eudrCompliant: number
  eudrNonCompliant: number
  pendingValidation: number
  dailyProgress: ProgressEntry[]
  weeklyProgress: ProgressEntry[]
  monthlyProgress: ProgressEntry[]
  topAgents: AgentPerformance[]
  topSections: SectionStats[]
}

export interface ProgressEntry {
  date: string
  parcels: number
  hectares: number
}

export interface AgentPerformance {
  agentId: string
  agentName: string
  parcels: number
  hectares: number
}

export interface SectionStats {
  section: string
  parcels: number
  hectares: number
  producers: number
}

// ─── Offline Sync ────────────────────────────────────────────────────────────

export interface SyncQueueItem {
  id: string
  type: 'parcel_create' | 'parcel_update' | 'producer_create'
  payload: unknown
  createdAt: number
  retries: number
  lastError?: string
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  read: boolean
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string
  userId: string
  userName: string
  action: string
  resource: string
  resourceId: string
  details: string
  ip: string
  timestamp: string
}
