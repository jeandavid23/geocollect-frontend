import { create } from 'zustand'
import type {
  Producer,
  Parcel,
  LegacyParcel,
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
import { legacyApi } from '../api/legacy'
import { mapCooperative, mapAgent, mapProducer, mapParcel, mapLegacyParcel, unwrap } from '../api/mappers'

interface AppStore {
  // Data
  cooperatives: Cooperative[]
  producers: Producer[]
  parcels: Parcel[]
  agents: Agent[]
  // Anciens polygones importés par les coopératives (visibles coop + agents + admin)
  legacyParcels: LegacyParcel[]
  loadLegacyParcels: () => Promise<void>

  // Live (backend) data state
  isLive: boolean
  isLoading: boolean // chargement des données en cours (milliers de producteurs / polygones)
  lastSync: number | null // horodatage du dernier rafraîchissement réussi
  currentAgentId: string | null
  loadFromApi: (userId?: string) => Promise<void>
  // Rafraîchissement silencieux (temps quasi réel) : recharge parcelles, producteurs et agents
  refreshData: () => Promise<void>
  pollersActive: number
  setPolling: (on: boolean) => void

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
  addProducers: (list: Producer[]) => void // import Excel : un seul changement d'état pour des milliers de lignes
  updateProducer: (id: string, updates: Partial<Producer>) => void

  addCooperative: (coop: Cooperative) => void
  updateCooperative: (id: string, updates: Partial<Cooperative>) => void
  addAgent: (agent: Agent) => void
  removeAgent: (id: string) => void
  toggleAgentActive: (id: string) => void

  clearData: () => void

  // Sync
  syncAll: () => void

  // Selectors
  getCooperativeStats: (cooperativeId: string) => DashboardStats
}

// Données de démonstration : uniquement en développement local. En production, rien n'est affiché
// tant que le serveur n'a pas renvoyé les données du compte connecté (déjà cloisonnées).
const DEMO = import.meta.env.DEV

export const useAppStore = create<AppStore>((set, get) => ({
  cooperatives: DEMO ? MOCK_COOPERATIVES : [],
  producers: DEMO ? MOCK_PRODUCERS : [],
  parcels: DEMO ? MOCK_PARCELS : [],
  agents: DEMO ? MOCK_AGENTS : [],
  legacyParcels: [],

  loadLegacyParcels: async () => {
    try {
      const { data } = await legacyApi.list()
      set({ legacyParcels: unwrap(data).map(mapLegacyParcel) })
    } catch {
      /* hors ligne ou mode démo : on garde la liste actuelle */
    }
  },

  isLive: false,
  isLoading: false,
  lastSync: null,
  pollersActive: 0,
  currentAgentId: null,

  // Charge toutes les données depuis la base (API Django) selon le rôle de l'utilisateur
  loadFromApi: async (userId) => {
    // Compte réel : mode connecté immédiatement (sans attendre la fin du chargement, qui peut
    // prendre plusieurs secondes avec des milliers de lignes) ; les données de démonstration sont retirées.
    set({ isLive: true, isLoading: true, cooperatives: [], producers: [], parcels: [], agents: [], legacyParcels: [] })
    try {
      const [coopsRes, agentsRes, prodsRes, parcelsRes, legacyRes] = await Promise.allSettled([
        cooperativesApi.list(),
        agentsApi.list(),
        producersApi.list(),
        parcelsApi.listAll(),
        legacyApi.list(),
      ])

      const next: Partial<AppStore> = { isLive: true, isLoading: false, lastSync: Date.now() }

      if (coopsRes.status === 'fulfilled')
        next.cooperatives = unwrap(coopsRes.value.data).map(mapCooperative)
      if (prodsRes.status === 'fulfilled')
        next.producers = unwrap(prodsRes.value.data).map(mapProducer)
      if (parcelsRes.status === 'fulfilled')
        next.parcels = unwrap(parcelsRes.value.data).map(mapParcel)
      if (legacyRes.status === 'fulfilled')
        next.legacyParcels = unwrap(legacyRes.value.data).map(mapLegacyParcel)
      if (agentsRes.status === 'fulfilled') {
        const agents = unwrap(agentsRes.value.data).map(mapAgent)
        next.agents = agents
        // Identifie l'agent connecté (pour le mapping)
        const me = userId ? agents.find((a) => a.userId === userId) : agents[0]
        if (me) next.currentAgentId = me.id
      }

      set(next)
    } catch {
      set({ isLoading: false })
    }
  },

  // Déconnexion : on efface les données du compte précédent (le suivant ne doit jamais les apercevoir)
  clearData: () => set({ isLive: false, isLoading: false, lastSync: null, currentAgentId: null,
    cooperatives: [], producers: [], parcels: [], agents: [], legacyParcels: [], mappingSession: null }),

  // Rafraîchit en arrière-plan sans vider l'écran (utilisé par le rafraîchissement automatique ~15 s)
  setPolling: (on) => set((st) => ({ pollersActive: Math.max(0, st.pollersActive + (on ? 1 : -1)) })),

  refreshData: async () => {
    if (!get().isLive) return
    try {
      const [prodsRes, parcelsRes, agentsRes] = await Promise.allSettled([
        producersApi.list(),
        parcelsApi.listAll(),
        agentsApi.list(),
      ])
      const next: Partial<AppStore> = { lastSync: Date.now() }
      if (prodsRes.status === 'fulfilled') next.producers = unwrap(prodsRes.value.data).map(mapProducer)
      if (parcelsRes.status === 'fulfilled') next.parcels = unwrap(parcelsRes.value.data).map(mapParcel)
      if (agentsRes.status === 'fulfilled') next.agents = unwrap(agentsRes.value.data).map(mapAgent)
      set(next)
    } catch {
      /* hors ligne : on garde les données affichées */
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

  addProducers: (list) =>
    set((state) => ({ producers: [...list, ...state.producers] })),

  updateProducer: (id, updates) =>
    set((state) => ({
      producers: state.producers.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  addCooperative: (coop) =>
    set((state) => ({ cooperatives: [coop, ...state.cooperatives] })),

  updateCooperative: (id, updates) =>
    set((state) => ({ cooperatives: state.cooperatives.map((c) => (c.id === id ? { ...c, ...updates } : c)) })),

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
