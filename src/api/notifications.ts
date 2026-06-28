import api from './client'

export interface ApiNotification {
  id: string
  type: 'success' | 'info' | 'warning' | 'error'
  title: string
  message: string
  is_read: boolean
  cooperative_name: string | null
  created_at: string
}

interface Paginated<T> { results?: T[] }

export const notificationsApi = {
  list: () => api.get<Paginated<ApiNotification> | ApiNotification[]>('/auth/notifications/'),
  markRead: () => api.post('/auth/notifications/read/'),
}
