// Nouvelles tentatives pour les gros envois (serveur Render en veille, réseau mobile instable)
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, onRetry?: (n: number) => void): Promise<T> {
  let last: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      const status = (e as { response?: { status?: number } })?.response?.status
      // erreur de données (400, 403…) : inutile de réessayer
      if (status && status >= 400 && status < 500) throw e
      if (i < attempts) {
        onRetry?.(i)
        await new Promise((r) => setTimeout(r, 2000 * i))
      }
    }
  }
  throw last
}

/** Message lisible pour une erreur d'API. */
export function apiErrorMessage(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { detail?: string } }; code?: string; message?: string }
  if (err?.response?.data?.detail) return err.response.data.detail
  const status = err?.response?.status
  if (status === 502 || status === 503 || status === 504) return `Le serveur n'a pas répondu à temps (erreur ${status}).`
  if (status === 413) return 'Envoi trop volumineux pour le serveur.'
  if (status) return `Erreur du serveur (${status}).`
  if (err?.code === 'ECONNABORTED') return 'Délai dépassé : le serveur met trop de temps à répondre.'
  return 'Serveur injoignable : vérifiez la connexion Internet.'
}
