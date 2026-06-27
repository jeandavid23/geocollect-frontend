import api from './client'

export interface CreateCooperativePayload {
  name: string
  region?: string
  country?: string
  rccm?: string
  agrement?: string
  pca?: string
  adg?: string
  director?: string
  sig_manager?: string
  phone?: string
  email?: string
  address?: string
  login_username?: string
  login_password?: string
}

export interface CreatedAccount {
  id: string
  name: string
  account_username: string
  account_password: string
}

export const cooperativesApi = {
  list: () => api.get('/cooperatives/'),
  create: (data: CreateCooperativePayload) =>
    api.post<CreatedAccount>('/cooperatives/', data),
}
