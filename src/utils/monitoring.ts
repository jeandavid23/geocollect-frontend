// Supervision côté navigateur :
//  - erreurs JavaScript → API (/monitoring/client-error/) → compteur Prometheus visible dans Grafana ;
//  - sur Vercel uniquement : Web Analytics et Speed Insights (temps de chargement réels des utilisateurs).
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const MAX_REPORTS = 10          // par session : jamais de rafale vers l'API

let sent = 0
function report(kind: 'error' | 'unhandledrejection' | 'chunk', message: string, source = '') {
  if (sent >= MAX_REPORTS || import.meta.env.DEV) return
  sent++
  try {
    const body = JSON.stringify({ message: message.slice(0, 300), source: source.slice(0, 200), page: location.pathname, ua: navigator.userAgent.slice(0, 120) })
    // sendBeacon : envoi « text/plain » sans requête préalable CORS, même pendant la fermeture de la page
    navigator.sendBeacon?.(`${API}/monitoring/client-error/?kind=${kind}`, body)
  } catch { /* ignore */ }
}

export function initMonitoring() {
  window.addEventListener('error', (e) => {
    const msg = e.message || String(e.error ?? '')
    report(/Loading chunk|dynamically imported module|Failed to fetch dynamically/i.test(msg) ? 'chunk' : 'error', msg, `${e.filename}:${e.lineno}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    // les refus de l'API (401, réseau…) sont déjà comptés côté serveur
    if (r && typeof r === 'object' && 'isAxiosError' in r) return
    report('unhandledrejection', r instanceof Error ? r.message : String(r))
  })
  if (location.hostname.endsWith('.vercel.app') || import.meta.env.VITE_HOSTING === 'vercel') {
    import('@vercel/analytics').then((m) => m.inject({ mode: 'production' })).catch(() => {})
    import('@vercel/speed-insights').then((m) => m.injectSpeedInsights()).catch(() => {})
  }
}
