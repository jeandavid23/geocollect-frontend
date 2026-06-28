import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Build version (force un nom de bundle unique à chaque déploiement)
const BUILD_VERSION = '2026-06-28-4'
console.info('GeoCollect EUDR', BUILD_VERSION)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
