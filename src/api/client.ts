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
    // Organisation suspendue, abonnement expiré ou coopérative désactivée : déconnexion avec le motif
    if (error.response?.status === 401 && error.response?.data?.code === 'tenant_inactive') {
      try { sessionStorage.setItem('geocollect-logout-reason', String(error.response.data.detail || '')) } catch { /* indisponible */ }
      localStorage.removeItem('geocollect-auth')
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login'
      return Promise.reject(error)
    }
    // Connexion / rafraîchissement refusés : c'est un mauvais identifiant, pas un jeton expiré.
    // Sans cette exception, l'échec rechargeait la page et effaçait le message d'erreur.
    const isAuthCall = /\/auth\/(login|token\/refresh)\//.test(String(original?.url ?? ''))
    if (error.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true
      try {
        const stored = localStorage.getItem('geocollect-auth')
        if (stored && JSON.parse(stored)?.state?.refreshToken) {
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

// Charge TOUTES les pages d'une liste paginée DRF (sinon seules les 50 premières lignes arrivent).
// On suit les numéros de page plutôt que l'URL `next`, qui peut revenir en http:// derrière le proxy Render.
export async function fetchAll<T = unknown>(url: string, params: Record<string, string> = {}): Promise<{ data: T[] }> {
  const out: T[] = []
  for (let page = 1; ; page++) {
    const { data } = await api.get(url, { params: { page_size: '1000', ...params, page: String(page) }, timeout: 120000 })
    if (Array.isArray(data)) return { data: data as T[] }
    out.push(...((data?.results ?? []) as T[]))
    if (!data?.next) return { data: out }
  }
}
