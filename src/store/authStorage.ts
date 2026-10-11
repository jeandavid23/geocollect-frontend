/**
 * Où vit la session : « Rester connecté » coché → localStorage (survit à la fermeture du navigateur) ;
 * décoché → sessionStorage (effacée à la fermeture, poste partagé) + déconnexion après 30 min d'inactivité.
 */
export const AUTH_KEY = 'geocollect-auth'
const REMEMBER_KEY = 'geocollect-remember'

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn() } catch { return fallback } }

export const isRemembered = () => safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true)
export const setRemembered = (v: boolean) => safe(() => localStorage.setItem(REMEMBER_KEY, v ? '1' : '0'), undefined)

export const authStorage = {
  getItem: (name: string): string | null =>
    safe(() => localStorage.getItem(name), null) ?? safe(() => sessionStorage.getItem(name), null),
  setItem: (name: string, value: string) => {
    const keep = isRemembered()
    safe(() => (keep ? localStorage : sessionStorage).setItem(name, value), undefined)
    safe(() => (keep ? sessionStorage : localStorage).removeItem(name), undefined)
  },
  removeItem: (name: string) => {
    safe(() => localStorage.removeItem(name), undefined)
    safe(() => sessionStorage.removeItem(name), undefined)
  },
}

/** État de session enregistré ({ state: { token, refreshToken, user } }) — lu hors React (client API). */
export function readAuth(): { state?: { token?: string; refreshToken?: string; user?: Record<string, unknown> } } | null {
  const raw = authStorage.getItem(AUTH_KEY)
  return raw ? safe(() => JSON.parse(raw), null) : null
}

export function writeAuthToken(token: string) {
  const parsed = readAuth()
  if (!parsed?.state) return
  parsed.state.token = token
  authStorage.setItem(AUTH_KEY, JSON.stringify(parsed))
}
