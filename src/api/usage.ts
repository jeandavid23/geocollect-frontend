import api from './client'
import type { UserRole } from '../types'

/** Statistiques d'utilisation des comptes (audience de l'application, calculée par GeoCollect). */
export type UsageStatus = 'actif' | 'peu_actif' | 'inactif' | 'jamais'
export const USAGE_STATUS: Record<UsageStatus, { label: string; tone: string }> = {
  actif: { label: 'Actif', tone: 'bg-success-bg text-success-text' },
  peu_actif: { label: 'Peu actif', tone: 'bg-warning-bg text-warning-text' },
  inactif: { label: 'Inactif', tone: 'bg-danger-bg text-danger-text' },
  jamais: { label: 'Jamais connecté', tone: 'bg-gray-100 text-gray-600' },
}
export const USAGE_PERIODS = [7, 30, 90] as const
export type UsagePeriod = typeof USAGE_PERIODS[number]

export interface UsageAccount {
  id: string; name: string; username: string; role: UserRole; is_active: boolean; organisation: string
  cooperative_id: string | null; admin_id: string | null; admin_name: string; last_seen: string | null
  status: UsageStatus; days_active: number; page_views: number; sessions: number; logins: number; actions: number
}
export interface UsageGroup {
  id: string | null; name: string; accounts: number; active: number; page_views: number; actions: number; logins: number
  last_seen: string | null
}
export interface UsageOverview {
  days: number; start: string; end: string
  totals: { accounts: number; active_today: number; active_7d: number; active_period: number; page_views: number
    sessions: number; avg_session_minutes: number | null; pages_per_session: number | null; logins: number; actions: number; dormant: number }
  daily: { day: string; active_users: number; page_views: number; logins: number }[]
  top_pages: { path: string; views: number; users: number }[]
  devices: { device: 'ordinateur' | 'mobile' | 'tablette'; sessions: number }[]
  hours: { hour: number; page_views: number }[]
  accounts: UsageAccount[]
  by_cooperative: UsageGroup[]
  by_admin: UsageGroup[]
}
export const usageApi = {
  overview: (days: UsagePeriod, filters: { cooperative?: string; admin?: string } = {}) =>
    api.get<UsageOverview>('/usage/overview/', { params: { days, ...filters }, timeout: 120000 }),
}

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Propriétaire', super_admin: 'Super admin', cooperative: 'Coopérative', agent: 'Agent mappeur', usine: 'Usine',
}
