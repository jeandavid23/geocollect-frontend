import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types'

interface Props {
  roles?: UserRole[]
  children: React.ReactNode
}

export default function ProtectedRoute({ roles, children }: Props) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) {
    const redirect = user.role === 'super_admin' ? '/admin' : user.role === 'cooperative' ? '/coop' : '/agent'
    return <Navigate to={redirect} replace />
  }

  return <>{children}</>
}
