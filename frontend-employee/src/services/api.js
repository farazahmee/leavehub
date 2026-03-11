import axios from 'axios'
import useAuthStore from '../store/authStore'

/** Extract tenant slug from subdomain: acme.localhost -> acme */
function getTenantSlugFromHost() {
  if (typeof window === 'undefined') return null
  const host = (window.location?.hostname || '').toLowerCase()
  const parts = host.split('.')
  if (parts.length >= 2 && parts[0] !== 'www') return parts[0]
  return null
}

/** Extract tenant slug from URL query: ?tenant=acme */
function getTenantSlugFromQuery() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location?.search || '')
  return params.get('tenant')?.toLowerCase().trim() || null
}

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const { token, user } = useAuthStore.getState()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const slugFromHost = getTenantSlugFromHost()
    const slugFromQuery = getTenantSlugFromQuery()
    const slug = slugFromHost || slugFromQuery || user?.company_slug
    if (slug) {
      config.headers['X-Tenant-Slug'] = slug
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
