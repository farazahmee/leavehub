import axios from 'axios'
import useAuthStore from '../store/authStore'

/** Extract tenant slug from subdomain: newtenant.localhost -> newtenant, acme.workforce.com -> acme */
function getTenantSlugFromHost() {
  if (typeof window === 'undefined') return null
  const host = (window.location?.hostname || '').toLowerCase()
  const parts = host.split('.')
  if (parts.length >= 2 && parts[0] !== 'www') return parts[0]
  return null
}

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: auth + X-Tenant-Slug from subdomain or user's company
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const slugFromHost = getTenantSlugFromHost()
    const companySlug = useAuthStore.getState().user?.company_slug
    const slug = slugFromHost || companySlug
    if (slug) {
      config.headers['X-Tenant-Slug'] = slug
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
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
