import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { authApi } from '../api/auth'

interface AuthStore {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  // Actions
  loginWithApi: (username: string, password: string) => Promise<void>
  loginMock: (user: User, token: string) => void
  logout: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
  clearError: () => void
}

// Keep mock fallback for offline/demo mode
export const MOCK_USERS: Record<string, { user: User; password: string }> = {
  admin: {
    password: 'admin123',
    user: {
      id: '1', username: 'admin', email: 'admin@geocollect.ci',
      role: 'super_admin', fullName: 'Super Administrateur',
      isActive: true, createdAt: '2024-01-01',
    },
  },
  coop: {
    password: 'coop123',
    user: {
      id: '2', username: 'coop', email: 'contact@coopcacao.ci',
      role: 'cooperative', fullName: 'COOP CACAO BEOUMI',
      isActive: true, createdAt: '2024-01-15', cooperativeId: 'coop-001',
    },
  },
  agent: {
    password: 'agent123',
    user: {
      id: '3', username: 'agent01', email: 'agent01@geocollect.ci',
      role: 'agent', fullName: 'Kouassi Bernard',
      isActive: true, createdAt: '2024-02-01', cooperativeId: 'coop-001',
    },
  },
}

// Map Django API user to frontend User type
function mapApiUser(apiUser: Record<string, unknown>): User {
  return {
    id: String(apiUser.id),
    username: String(apiUser.username),
    email: String(apiUser.email || ''),
    role: apiUser.role as User['role'],
    fullName: String(apiUser.full_name),
    phone: String(apiUser.phone || ''),
    isActive: Boolean(apiUser.is_active),
    createdAt: String(apiUser.created_at),
    cooperativeId: apiUser.cooperative_id ? String(apiUser.cooperative_id) : undefined,
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      loginWithApi: async (username, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await authApi.login(username, password)
          const user = mapApiUser(data.user as unknown as Record<string, unknown>)
          set({
            user,
            token: data.access,
            refreshToken: data.refresh,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            || 'Identifiant ou mot de passe incorrect.'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      loginMock: (user, token) => set({ user, token, isAuthenticated: true }),

      logout: async () => {
        const { refreshToken } = get()
        try {
          if (refreshToken) await authApi.logout(refreshToken)
        } catch {}
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearError: () => set({ error: null }),
    }),
    { name: 'geocollect-auth' }
  )
)
