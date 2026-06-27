import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('geocollect-auth')
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      if (state?.token) {
        config.headers.Authorization = `Bearer ${state.token}`
      }
    } catch {}
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const stored = localStorage.getItem('geocollect-auth')
        if (stored) {
          const { state } = JSON.parse(stored)
          const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
            refresh: state?.refreshToken,
          })
          // Update token in localStorage
          const parsed = JSON.parse(stored)
          parsed.state.token = data.access
          localStorage.setItem('geocollect-auth', JSON.stringify(parsed))
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        }
      } catch {
        // Redirect to login
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
