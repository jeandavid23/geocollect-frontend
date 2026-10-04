import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMonitoring } from './utils/monitoring'

// Build version (force un nom de bundle unique à chaque déploiement)
const BUILD_VERSION = '2026-10-04-cloisonnement'
console.info('GeoCollect EUDR', BUILD_VERSION)
initMonitoring()

// Nouvelle version déployée : le nouveau service worker prend la main → on recharge une fois la page,
// pour ne jamais rester sur l'ancienne version gardée en cache hors ligne.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
