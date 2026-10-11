import api from './client'

export interface ApiNotification {
  id: string
  type: 'success' | 'info' | 'warning' | 'error'
  category?: string
  title: string
  message: string
  is_read: boolean
  cooperative_name: string | null
  created_at: string
}

interface Paginated<T> { results?: T[] }

export const notificationsApi = {
  list: (params?: { category?: string; unread?: boolean; limit?: number }) => api.get<Paginated<ApiNotification> | ApiNotification[]>('/auth/notifications/', {
    params: params ? { ...(params.category ? { category: params.category } : {}), ...(params.unread ? { unread: 1 } : {}), ...(params.limit ? { limit: params.limit } : {}) } : undefined }),
  prefs: () => api.get<NotificationPrefs>('/auth/notifications/prefs/'),
  savePrefs: (data: Record<string, boolean>) => api.patch<NotificationPrefs>('/auth/notifications/prefs/', data),
  markRead: () => api.post('/auth/notifications/read/'),
  clear: (id?: string) => api.delete('/auth/notifications/clear/', { params: id ? { id } : undefined }),
}

export interface MessageTarget { key: string; label: string }

export const messagesApi = {
  targets: () => api.get<MessageTarget[]>('/auth/notifications/targets/'),
  send: (data: { target: string; title: string; message?: string; level?: 'info' | 'warning' | 'success' }) =>
    api.post<{ sent: number }>('/auth/notifications/send/', data),
}

export interface NotificationPrefs {
  email: string
  categories: { key: string; label: string; description: string; email: boolean }[]
}
