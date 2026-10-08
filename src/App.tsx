import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { useAppStore } from './store/appStore'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RequireModule from './components/auth/RequireModule'
import Layout from './components/layout/Layout'

// Auth
import LoginPage from './pages/auth/LoginPage'
const CguPage = lazy(() => import('./pages/legal/CguPage'))
const ConfidentialitePage = lazy(() => import('./pages/legal/ConfidentialitePage'))

// Admin
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const CooperativesPage = lazy(() => import('./pages/admin/CooperativesPage'))
const AdminAgentsPage = lazy(() => import('./pages/admin/AdminAgentsPage'))
const AccountsPage = lazy(() => import('./pages/admin/AccountsPage'))
const LogsPage = lazy(() => import('./pages/admin/LogsPage'))

// Propriétaire de la plateforme (Super Super Admin)
const PlatformPage = lazy(() => import('./pages/owner/PlatformPage'))
const SuperAdminsPage = lazy(() => import('./pages/owner/SuperAdminsPage'))

// Shared account
const AccountPage = lazy(() => import('./pages/account/AccountPage'))

// Cooperative
const CoopDashboardPage = lazy(() => import('./pages/coop/CoopDashboardPage'))
const ProducersPage = lazy(() => import('./pages/coop/ProducersPage'))
const CoopParcelsPage = lazy(() => import('./pages/coop/CoopParcelsPage'))
const CoopAgentsPage = lazy(() => import('./pages/coop/CoopAgentsPage'))
const ReportsPage = lazy(() => import('./pages/coop/ReportsPage'))
const DeforestationPage = lazy(() => import('./pages/coop/DeforestationPage'))
const ValidatorPage = lazy(() => import('./pages/coop/ValidatorPage'))
const SelfIntersectionPage = lazy(() => import('./pages/coop/SelfIntersectionPage'))
const GmrPage = lazy(() => import('./pages/coop/GmrPage'))
const LotsPage = lazy(() => import('./pages/coop/LotsPage'))
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'))
// Le registre embarque le moteur de formules : chargé seulement à l'ouverture de la page
const RegistryPage = lazy(() => import('./pages/coop/RegistryPage'))

// Agent
const AgentDashboardPage = lazy(() => import('./pages/agent/AgentDashboardPage'))
const MappingPage = lazy(() => import('./pages/agent/MappingPage'))
const AgentParcelsPage = lazy(() => import('./pages/agent/AgentParcelsPage'))
const AgentProducersPage = lazy(() => import('./pages/agent/AgentProducersPage'))

// Shared
const MapPage = lazy(() => import('./pages/MapPage'))

function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center" role="status" aria-label="Chargement">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" />
    </div>
  )
}

const LandingPage = lazy(() => import('./pages/public/LandingPage'))

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  // visiteur : page de présentation publique (offre, tarifs, demande de démo)
  if (!isAuthenticated) return <LandingPage />
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
      {/* chaque page est chargée à l'ouverture (premier affichage plus rapide sur réseau mobile) */}
      <Suspense fallback={<PageLoader />}>
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
          <Route path="/admin/reports" element={<AdminReportsPage />} />
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
          <Route path="/coop/lots" element={<RequireModule module="lots"><LotsPage /></RequireModule>} />
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
      </Suspense>
    </BrowserRouter>
  )
}
