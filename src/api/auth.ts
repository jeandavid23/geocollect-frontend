import api from './client'
import type { User } from '../types'

interface LoginResponse {
  access: string
  refresh: string
  user: User
  // double authentification active : pas encore de jetons, il faut le code à 6 chiffres
  mfa_required?: boolean
  mfa_token?: string
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login/', { username, password }),

  // Connexion avec Google : jeton d'identité vérifié par le serveur, compte retrouvé par son e-mail
  googleConfig: () => api.get<{ enabled: boolean; client_id: string }>('/auth/google/config/'),
  google: (credential: string) => api.post<LoginResponse>('/auth/google/', { credential }),

  logout: (refresh: string) =>
    api.post('/auth/logout/', { refresh }),

  me: () => api.get('/auth/me/'),

  updateProfile: (data: {
    full_name?: string; email?: string; phone?: string;
    national_id?: string; photo_data?: string;
  }) => api.patch('/auth/me/', data),

  refreshToken: (refresh: string) =>
    api.post<{ access: string }>('/auth/token/refresh/', { refresh }),

  changePassword: (old_password: string, new_password: string) =>
    api.post('/auth/change-password/', { old_password, new_password }),

  // « Voir comme » (lecture seule, 1 h) : propriétaire → tout compte ; super admin → comptes de ses coopératives
  impersonate: (userId: string) => api.post<{ access: string; user: User; impersonator: string }>('/auth/impersonate/', { user: userId }),

  // Double authentification (TOTP)
  mfaVerify: (mfa_token: string, code: string) => api.post<LoginResponse>('/auth/mfa/verify/', { mfa_token, code }),
  mfaSetup: () => api.get<{ enabled: boolean; secret?: string; uri?: string; recovery_left?: number }>('/auth/mfa/setup/'),
  mfaEnable: (code: string) => api.post<{ enabled: boolean; recovery_codes: string[] }>('/auth/mfa/setup/', { code }),
  mfaDisable: (password: string, code: string) => api.delete('/auth/mfa/setup/', { data: { password, code } }),
  mfaReset: (userId: string) => api.post<{ detail: string }>(`/auth/users/${userId}/reset-mfa/`),
}
