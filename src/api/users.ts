import api from './client'

export interface ApiUser {
  id: string
  username: string
  email: string | null
  full_name: string
  phone: string
  role: 'owner' | 'super_admin' | 'cooperative' | 'agent'
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
  remove: (id: string) => api.delete(`/auth/users/${id}/`),
  // ce qui sera supprimé avec ces comptes (affiché avant confirmation)
  deletePreview: (ids: string[]) => api.post<DeletionPreview>('/auth/users/delete-preview/', { ids }, { timeout: 60000 }),
  // propriétaire uniquement : suppression groupée sans condition (sauf son propre compte et le dernier propriétaire)
  bulkDelete: (ids: string[]) => api.post<{ deleted: number; refused: { username: string; detail: string }[] }>('/auth/users/bulk-delete/', { ids }, { timeout: 120000 }),
  toggleActive: (id: string) =>
    api.post<{ is_active: boolean }>(`/auth/users/${id}/toggle/`),
}

export interface DeletionPreview {
  cooperatives: number; accounts: number; producers: number; parcels: number; legacy_polygons: number
  registry_sheets: number; lots: number; reports: number; documents: number; logs: number; cooperative_names: string[]
}
