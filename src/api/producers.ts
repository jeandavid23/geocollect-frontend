import api from './client'

export interface CreateProducerPayload {
  first_name: string
  last_name: string
  phone?: string
  national_id?: string
  gender: 'M' | 'F'
  birth_year?: number
  village?: string
  section: string
  region?: string
  country?: string
  cooperative?: string
  assigned_agent?: string
}

export const producersApi = {
  list: () => api.get('/producers/'),
  create: (data: CreateProducerPayload) => api.post('/producers/', data),
}
