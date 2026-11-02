import { Navigate } from 'react-router-dom'
import { homeFor } from '../../utils/roleHome'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types'
import SecurityGate from './SecurityGate'

interface Props {
  roles?: UserRole[]
  children: React.ReactNode
}

export default function ProtectedRoute({ roles, children }: Props) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />
  }

  // mot de passe provisoire à changer / double authentification à activer avant d'accéder aux pages
  return <SecurityGate>{children}</SecurityGate>
}
