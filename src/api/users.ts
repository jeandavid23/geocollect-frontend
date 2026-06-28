import api from './client'

export interface ApiUser {
  id: string
  username: string
  email: string | null
  full_name: string
  phone: string
  role: 'super_admin' | 'cooperative' | 'agent'
  is_active: boolean
  cooperative_id: string | null
  cooperative_name: string | null
  created_at: string
}

interface Paginated<T> { count: number; results: T[] }

export const usersApi = {
  // Liste tous les comptes (super admin)
  list: () => api.get<Paginated<ApiUser> | ApiUser[]>('/auth/users/'),

  // Réinitialise le mot de passe d'un utilisateur → renvoie le nouveau
  resetPassword: (id: string) =>
    api.post<{ username: string; new_password: string; full_name: string }>(
      `/auth/users/${id}/reset-password/`
    ),

  // Active / désactive un compte
  toggleActive: (id: string) =>
    api.post<{ is_active: boolean }>(`/auth/users/${id}/toggle/`),
}
