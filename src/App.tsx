import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useAppStore } from './store/appStore'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RequireModule from './components/auth/RequireModule'
import Layout from './components/layout/Layout'

// Auth
import LoginPage from './pages/auth/LoginPage'
import CguPage from './pages/legal/CguPage'
import ConfidentialitePage from './pages/legal/ConfidentialitePage'

// Admin
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import CooperativesPage from './pages/admin/CooperativesPage'
import AdminAgentsPage from './pages/admin/AdminAgentsPage'
import AccountsPage from './pages/admin/AccountsPage'
import LogsPage from './pages/admin/LogsPage'

// Propriétaire de la plateforme (Super Super Admin)
import PlatformPage from './pages/owner/PlatformPage'
import SuperAdminsPage from './pages/owner/SuperAdminsPage'

// Shared account
import AccountPage from './pages/account/AccountPage'

// Cooperative
import CoopDashboardPage from './pages/coop/CoopDashboardPage'
import ProducersPage from './pages/coop/ProducersPage'
import CoopParcelsPage from './pages/coop/CoopParcelsPage'
import CoopAgentsPage from './pages/coop/CoopAgentsPage'
import ReportsPage from './pages/coop/ReportsPage'
import DeforestationPage from './pages/coop/DeforestationPage'
import ValidatorPage from './pages/coop/ValidatorPage'
import SelfIntersectionPage from './pages/coop/SelfIntersectionPage'
import GmrPage from './pages/coop/GmrPage'
// Le registre embarque le moteur de formules : chargé seulement à l'ouverture de la page
const RegistryPage = lazy(() => import('./pages/coop/RegistryPage'))

// Agent
import AgentDashboardPage from './pages/agent/AgentDashboardPage'
import MappingPage from './pages/agent/MappingPage'
import AgentParcelsPage from './pages/agent/AgentParcelsPage'
import AgentProducersPage from './pages/agent/AgentProducersPage'

// Shared
import MapPage from './pages/MapPage'

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'owner') return <Navigate to="/owner" replace />
  if (user?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (user?.role === 'cooperative') return <Navigate to="/coop" replace />
  return <Navigate to="/agent" replace />
}

export default function App() {
  const setIsOnline = useAppStore((s) => s.setIsOnline)
  const loadFromApi = useAppStore((s) => s.loadFromApi)
  const { isAuthenticated, token, user } = useAuthStore()

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [setIsOnline])

  // Charge les données réelles depuis la base dès qu'on est connecté avec un vrai compte (token JWT, pas mock)
  useEffect(() => {
    if (isAuthenticated && token && !token.startsWith('mock')) {
      loadFromApi(user?.id)
      // modules / licence à jour (les droits changés par le propriétaire s'appliquent sans reconnexion)
      useAuthStore.getState().refreshMe()
    }
  }, [isAuthenticated, token, user?.id, loadFromApi])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        {/* Pages juridiques publiques */}
        <Route path="/cgu" element={<CguPage />} />
        <Route path="/confidentialite" element={<ConfidentialitePage />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Propriétaire de la plateforme */}
        <Route
          element={
            <ProtectedRoute roles={['owner']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/owner" element={<PlatformPage />} />
          <Route path="/owner/admins" element={<SuperAdminsPage />} />
        </Route>

        {/* Super Admin (le propriétaire y a aussi accès, sur tous les clients) */}
        <Route
          element={
            <ProtectedRoute roles={['super_admin', 'owner']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/cooperatives" element={<CooperativesPage />} />
          <Route path="/admin/agents" element={<AdminAgentsPage />} />
          <Route path="/admin/accounts" element={<AccountsPage />} />
          <Route path="/admin/logs" element={<LogsPage />} />
        </Route>

        {/* Cooperative */}
        <Route
          element={
            <ProtectedRoute roles={['cooperative']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/coop" element={<CoopDashboardPage />} />
          <Route path="/coop/producers" element={<ProducersPage />} />
          <Route path="/coop/parcels" element={<CoopParcelsPage />} />
          <Route path="/coop/agents" element={<CoopAgentsPage />} />
          <Route path="/coop/reports" element={<ReportsPage />} />
          <Route path="/coop/deforestation" element={<RequireModule module="deforestation"><DeforestationPage /></RequireModule>} />
          <Route path="/coop/validator" element={<RequireModule module="validator"><ValidatorPage /></RequireModule>} />
          <Route path="/coop/selfintersection" element={<RequireModule module="selfintersection"><SelfIntersectionPage /></RequireModule>} />
          <Route path="/coop/gmr" element={<RequireModule module="gmr"><GmrPage /></RequireModule>} />
          <Route path="/coop/registry" element={<RequireModule module="registry"><Suspense fallback={<p className="p-6 text-gray-500">Chargement du registre…</p>}><RegistryPage /></Suspense></RequireModule>} />
        </Route>

        {/* Agent */}
        <Route
          element={
            <ProtectedRoute roles={['agent']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/agent" element={<AgentDashboardPage />} />
          <Route path="/agent/mapping" element={<MappingPage />} />
          <Route path="/agent/parcels" element={<AgentParcelsPage />} />
          <Route path="/agent/producers" element={<AgentProducersPage />} />
        </Route>

        {/* Pages communes à tous les rôles (déclarées une seule fois : sinon la première
            déclaration, réservée à l'admin, renvoyait coopérative et agent vers leur accueil) */}
        <Route
          element={
            <ProtectedRoute roles={['owner', 'super_admin', 'cooperative', 'agent']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/account" element={<AccountPage />} />
          <Route path="/map" element={<MapPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
