/**
 * Statistiques d'utilisation : chaque page ouverte est mise en file et envoyée par lots au serveur (GeoCollect,
 * jamais un service tiers). Pas d'envoi en mode « Voir comme » ni en démonstration. Une session = un onglet,
 * renouvelée après 30 min sans activité.
 */
import api from '../api/client'
import { useAuthStore } from '../store/authStore'

const SESSION_KEY = 'geocollect-usage-session'
const IDLE_MS = 30 * 60 * 1000
const FLUSH_MS = 20 * 1000
const MAX_QUEUE = 50

type PageEvent = { path: string; session: string; at: string }
let queue: PageEvent[] = []
let timer: ReturnType<typeof setInterval> | null = null

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn() } catch { return fallback } }

function session(): string {
  const now = Date.now()
  const saved = safe(() => JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as { id: string; last: number } | null, null)
  const id = saved && now - saved.last < IDLE_MS ? saved.id : crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  safe(() => sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now })), undefined)
  return id
}

function tracking(): boolean {
  const { token, impersonator } = useAuthStore.getState()
  return !!token && !token.startsWith('mock') && !impersonator
}

export async function flushUsage() {
  if (!queue.length || !tracking()) { queue = []; return }
  const events = queue
  queue = []
  // statistiques seulement : une perte d'envoi (hors ligne) n'est pas grave et ne doit rien bloquer
  await api.post('/usage/track/', { events }).catch(() => {})
}

export function trackPage(path: string) {
  if (!tracking()) return
  queue = [...queue, { path, session: session(), at: new Date().toISOString() }].slice(-MAX_QUEUE)
  if (!timer) {
    timer = setInterval(flushUsage, FLUSH_MS)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushUsage() })
  }
}
