import { create } from 'zustand'
import type {
  Producer,
  Parcel,
  Cooperative,
  Agent,
  MappingSession,
  SyncQueueItem,
  Notification,
  DashboardStats,
} from '../types'
import { MOCK_COOPERATIVES, MOCK_PRODUCERS, MOCK_PARCELS, MOCK_AGENTS } from '../utils/mockData'
import { cooperativesApi } from '../api/cooperatives'
import { agentsApi } from '../api/agents'
import { producersApi } from '../api/producers'
import { parcelsApi } from '../api/parcels'
import { mapCooperative, mapAgent, mapProducer, mapParcel, unwrap } from '../api/mappers'

interface AppStore {
  // Data
  cooperatives: Cooperative[]
  producers: Producer[]
  parcels: Parcel[]
  agents: Agent[]

  // Live (backend) data state
  isLive: boolean
  currentAgentId: string | null
  loadFromApi: (userId?: string) => Promise<void>

  // Mapping session
  mappingSession: MappingSession | null
  setMappingSession: (session: MappingSession | null) => void
  updateMappingSession: (updates: Partial<MappingSession>) => void

  // Sync queue
  syncQueue: SyncQueueItem[]
  isOnline: boolean
  isSyncing: boolean
  setIsOnline: (v: boolean) => void

  // Notifications
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markNotificationRead: (id: string) => void

  // CRUD
  addParcel: (parcel: Parcel) => void
  updateParcel: (id: string, updates: Partial<Parcel>) => void
  addProducer: (producer: Producer) => void
  updateProducer: (id: string, updates: Partial<Producer>) => void

  addCooperative: (coop: Cooperative) => void
  addAgent: (agent: Agent) => void
  removeAgent: (id: string) => void
  toggleAgentActive: (id: string) => void

  // Sync
  syncAll: () => void

  // Selectors
  getCooperativeStats: (cooperativeId: string) => DashboardStats
}

export const useAppStore = create<AppStore>((set, get) => ({
  cooperatives: MOCK_COOPERATIVES,
  producers: MOCK_PRODUCERS,
  parcels: MOCK_PARCELS,
  agents: MOCK_AGENTS,

  isLive: false,
  currentAgentId: null,

  // Charge toutes les données depuis la base (API Django) selon le rôle de l'utilisateur
  loadFromApi: async (userId) => {
    try {
      const [coopsRes, agentsRes, prodsRes, parcelsRes] = await Promise.allSettled([
        cooperativesApi.list(),
        agentsApi.list(),
        producersApi.list(),
        parcelsApi.list(),
      ])

      const next: Partial<AppStore> = { isLive: true }

      if (coopsRes.status === 'fulfilled')
        next.cooperatives = unwrap(coopsRes.value.data).map(mapCooperative)
      if (prodsRes.status === 'fulfilled')
        next.producers = unwrap(prodsRes.value.data).map(mapProducer)
      if (parcelsRes.status === 'fulfilled')
        next.parcels = unwrap(parcelsRes.value.data).map(mapParcel)
      if (agentsRes.status === 'fulfilled') {
        const agents = unwrap(agentsRes.value.data).map(mapAgent)
        next.agents = agents
        // Identifie l'agent connecté (pour le mapping)
        const me = userId ? agents.find((a) => a.userId === userId) : agents[0]
        if (me) next.currentAgentId = me.id
      }

      set(next)
    } catch {
      // Échec → on garde les données mock (mode démo)
      set({ isLive: false })
    }
  },

  mappingSession: null,
  setMappingSession: (session) => set({ mappingSession: session }),
  updateMappingSession: (updates) =>
    set((state) => ({
      mappingSession: state.mappingSession
        ? { ...state.mappingSession, ...updates }
        : null,
    })),

  syncQueue: [],
  isOnline: navigator.onLine,
  isSyncing: false,
  setIsOnline: (v) => set({ isOnline: v }),

  notifications: [],
  addNotification: (n) =>
    set((state) => ({
      notifications: [
        {
          ...n,
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...state.notifications,
      ],
    })),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  addParcel: (parcel) =>
    set((state) => ({ parcels: [parcel, ...state.parcels] })),

  updateParcel: (id, updates) =>
    set((state) => ({
      parcels: state.parcels.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  addProducer: (producer) =>
    set((state) => ({ producers: [producer, ...state.producers] })),

  updateProducer: (id, updates) =>
    set((state) => ({
      producers: state.producers.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  addCooperative: (coop) =>
    set((state) => ({ cooperatives: [coop, ...state.cooperatives] })),

  addAgent: (agent) =>
    set((state) => ({ agents: [agent, ...state.agents] })),

  removeAgent: (id) =>
    set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),

  toggleAgentActive: (id) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id ? { ...a, isActive: !a.isActive } : a
      ),
    })),

  syncAll: () => {
    set({ isSyncing: true })
    // Simulate sync delay then mark all parcels as synced
    setTimeout(() => {
      set((state) => ({
        isSyncing: false,
        parcels: state.parcels.map((p) =>
          p.isSynced ? p : { ...p, isSynced: true, syncedAt: new Date().toISOString() }
        ),
        notifications: [
          {
            id: crypto.randomUUID(),
            type: 'success' as const,
            title: 'Synchronisation terminée',
            message: 'Toutes les parcelles ont été synchronisées avec le serveur.',
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...state.notifications,
        ],
      }))
    }, 1200)
  },

  getCooperativeStats: (cooperativeId) => {
    const { producers, parcels, agents } = get()
    const coopParcels = parcels.filter((p) => p.cooperativeId === cooperativeId)
    const coopProducers = producers.filter((p) => p.cooperativeId === cooperativeId)
    const coopAgents = agents.filter((a) => a.cooperativeId === cooperativeId)

    const totalHectares = coopParcels.reduce((sum, p) => sum + p.areaHectares, 0)
    const sections = [...new Set(coopParcels.map((p) => p.section))]
    const villages = [...new Set(coopParcels.map((p) => p.village))]

    return {
      totalProducers: coopProducers.length,
      totalParcels: coopParcels.length,
      totalHectares: Math.round(totalHectares * 100) / 100,
      totalAgents: coopAgents.length,
      totalVillages: villages.length,
      totalSections: sections.length,
      eudrCompliant: coopParcels.filter((p) => p.eudrStatus === 'compliant').length,
      eudrNonCompliant: coopParcels.filter((p) => p.eudrStatus === 'non_compliant').length,
      pendingValidation: coopParcels.filter((p) => p.eudrStatus === 'pending').length,
      dailyProgress: generateProgress(7),
      weeklyProgress: generateProgress(8, 'week'),
      monthlyProgress: generateProgress(12, 'month'),
      topAgents: coopAgents.slice(0, 5).map((a) => ({
        agentId: a.id,
        agentName: a.fullName,
        parcels: Math.floor(Math.random() * 40) + 5,
        hectares: Math.round((Math.random() * 80 + 10) * 10) / 10,
      })),
      topSections: sections.slice(0, 5).map((s) => ({
        section: s,
        parcels: Math.floor(Math.random() * 60) + 10,
        hectares: Math.round((Math.random() * 120 + 20) * 10) / 10,
        producers: Math.floor(Math.random() * 40) + 5,
      })),
    }
  },
}))

function generateProgress(count: number, unit: 'day' | 'week' | 'month' = 'day') {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date()
    if (unit === 'day') date.setDate(date.getDate() - (count - 1 - i))
    else if (unit === 'week') date.setDate(date.getDate() - (count - 1 - i) * 7)
    else date.setMonth(date.getMonth() - (count - 1 - i))
    return {
      date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      parcels: Math.floor(Math.random() * 15) + 2,
      hectares: Math.round((Math.random() * 30 + 5) * 10) / 10,
    }
  })
}
