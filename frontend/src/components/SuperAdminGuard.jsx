import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { isPlatformAdmin } from '../utils/authHelpers'

/**
 * Protects Super Admin routes: only platform_admin or legacy super_admin can access.
 */
const SuperAdminGuard = ({ children }) => {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!isPlatformAdmin(user)) return <Navigate to="/dashboard" replace />
  return children
}

export default SuperAdminGuard
