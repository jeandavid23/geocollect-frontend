import api from './client'

export interface CreateAgentPayload {
  full_name: string
  email?: string
  phone?: string
  code: string
  zone?: string
  cooperative?: string
  login_username?: string
  login_password?: string
}

export interface CreatedAgentAccount {
  id: string
  code: string
  zone: string
  account_username: string
  account_password: string
}

export const agentsApi = {
  list: () => api.get('/agents/'),
  create: (data: CreateAgentPayload) =>
    api.post<CreatedAgentAccount>('/agents/', data),
}
