import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AUTH_KEY, authStorage, setRemembered } from './authStorage'
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
  // renvoie { mfaToken } si la double authentification est active (2e étape : verifyMfa)
  loginWithApi: (username: string, password: string, remember?: boolean) => Promise<{ mfaToken?: string }>
  loginWithGoogle: (credential: string, remember?: boolean) => Promise<{ mfaToken?: string }>
  verifyMfa: (mfaToken: string, code: string) => Promise<void>
  loginMock: (user: User, token: string) => void
  logout: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
  // Recharge le profil (modules, licence) : les droits changés par le propriétaire s'appliquent sans reconnexion
  refreshMe: () => Promise<void>
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
    modules: (apiUser.modules as User['modules']) ?? null,
    license: (apiUser.license as User['license']) ?? null,
    mustChangePassword: Boolean(apiUser.must_change_password),
    mfaEnabled: Boolean(apiUser.mfa_enabled),
    mfaRequired: Boolean(apiUser.mfa_required),
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

      loginWithApi: async (username, password, remember = true) => {
        set({ isLoading: true, error: null })
        setRemembered(remember)
        try {
          const { data } = await authApi.login(username, password)
          if (data.mfa_required && data.mfa_token) { set({ isLoading: false }); return { mfaToken: data.mfa_token } }
          const user = mapApiUser(data.user as unknown as Record<string, unknown>)
          set({
            user,
            token: data.access,
            refreshToken: data.refresh,
            isAuthenticated: true,
            isLoading: false,
          })
          return {}
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            || 'Identifiant ou mot de passe incorrect.'
          set({ error: msg, isLoading: false })
          // on relance l'erreur d'origine : la page de connexion a besoin du statut HTTP et du motif
          throw err
        }
      },

      loginWithGoogle: async (credential, remember = true) => {
        set({ isLoading: true, error: null })
        setRemembered(remember)
        try {
          const { data } = await authApi.google(credential)
          if (data.mfa_required && data.mfa_token) { set({ isLoading: false }); return { mfaToken: data.mfa_token } }
          set({ user: mapApiUser(data.user as unknown as Record<string, unknown>), token: data.access, refreshToken: data.refresh, isAuthenticated: true, isLoading: false })
          return {}
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Connexion Google impossible.'
          set({ error: msg, isLoading: false })
          throw err
        }
      },

      verifyMfa: async (mfaToken, code) => {
        const { data } = await authApi.mfaVerify(mfaToken, code)
        set({ user: mapApiUser(data.user as unknown as Record<string, unknown>), token: data.access, refreshToken: data.refresh, isAuthenticated: true, isLoading: false, error: null })
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

      refreshMe: async () => {
        const { token } = get()
        if (!token || token.startsWith('mock')) return
        try {
          const { data } = await authApi.me()
          set({ user: mapApiUser(data as Record<string, unknown>) })
        } catch { /* hors ligne : on garde le profil connu */ }
      },
    }),
    { name: AUTH_KEY, storage: createJSONStorage(() => authStorage) }
  )
)
