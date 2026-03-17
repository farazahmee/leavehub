import useAuthStore from '../store/authStore'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) {
    window.location.href = window.location.origin + '/admin/login'
    return null
  }
  return children
}

export default ProtectedRoute
