import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { useAuthStore } from './store/authStore'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'

// Auth
import LoginPage from './pages/auth/LoginPage'

// Admin
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import CooperativesPage from './pages/admin/CooperativesPage'
import AdminAgentsPage from './pages/admin/AdminAgentsPage'
import LogsPage from './pages/admin/LogsPage'

// Cooperative
import CoopDashboardPage from './pages/coop/CoopDashboardPage'
import ProducersPage from './pages/coop/ProducersPage'
import CoopParcelsPage from './pages/coop/CoopParcelsPage'
import CoopAgentsPage from './pages/coop/CoopAgentsPage'
import ReportsPage from './pages/coop/ReportsPage'

// Agent
import AgentDashboardPage from './pages/agent/AgentDashboardPage'
import MappingPage from './pages/agent/MappingPage'
import AgentParcelsPage from './pages/agent/AgentParcelsPage'

// Shared
import MapPage from './pages/MapPage'

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (user?.role === 'cooperative') return <Navigate to="/coop" replace />
  return <Navigate to="/agent" replace />
}

export default function App() {
  const setIsOnline = useAppStore((s) => s.setIsOnline)

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

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RootRedirect />} />

        {/* Super Admin */}
        <Route
          element={
            <ProtectedRoute roles={['super_admin']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/cooperatives" element={<CooperativesPage />} />
          <Route path="/admin/agents" element={<AdminAgentsPage />} />
          <Route path="/admin/logs" element={<LogsPage />} />
          <Route path="/map" element={<MapPage />} />
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
          <Route path="/map" element={<MapPage />} />
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
          <Route path="/map" element={<MapPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
