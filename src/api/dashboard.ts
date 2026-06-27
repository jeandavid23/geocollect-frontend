import api from './client'

export const dashboardApi = {
  admin: () => api.get('/dashboard/admin/'),
  coop: () => api.get('/dashboard/coop/'),
  agent: () => api.get('/dashboard/agent/'),
}
