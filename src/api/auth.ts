import api from './client'
import type { User } from '../types'

interface LoginResponse {
  access: string
  refresh: string
  user: User
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login/', { username, password }),

  logout: (refresh: string) =>
    api.post('/auth/logout/', { refresh }),

  me: () => api.get<User>('/auth/me/'),

  refreshToken: (refresh: string) =>
    api.post<{ access: string }>('/auth/token/refresh/', { refresh }),

  changePassword: (old_password: string, new_password: string) =>
    api.post('/auth/change-password/', { old_password, new_password }),
}
