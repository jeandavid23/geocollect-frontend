/**
 * Présence de l'utilisateur, pour les rafraîchissements automatiques.
 *
 * Un écran resté allumé sans personne devant ne doit pas interroger le serveur toutes les 15 s : chaque requête
 * réveille la base de données, dont le temps de calcul est facturé. Au-delà de IDLE_POLL_MS sans souris ni clavier,
 * les rafraîchissements s'arrêtent ; ils reprennent au premier geste (`onWake`).
 */
export const IDLE_POLL_MS = 10 * 60 * 1000

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'] as const
let lastActivity = Date.now()
const wakeListeners = new Set<() => void>()
let installed = false

function touch(): void {
  const wasIdle = Date.now() - lastActivity > IDLE_POLL_MS
  lastActivity = Date.now()
  if (wasIdle) wakeListeners.forEach((fn) => fn())
}

function install(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }))
}

/** Vrai si l'onglet est visible et que l'utilisateur a agi récemment : on peut interroger le serveur. */
export function shouldPoll(now: number = Date.now()): boolean {
  install()
  return document.visibilityState === 'visible' && now - lastActivity <= IDLE_POLL_MS
}

/** Appelle `fn` quand l'utilisateur revient après une période d'inactivité ; renvoie la fonction de désabonnement. */
export function onWake(fn: () => void): () => void {
  install()
  wakeListeners.add(fn)
  return () => { wakeListeners.delete(fn) }
}
