import axios from 'axios'
import useAuthStore from '../store/authStore'
import useConnectionStore from '../store/connectionStore'

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

api.interceptors.request.use(
  (config) => {
    const { token, companySlug, user } = useAuthStore.getState()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const slugFromHost = getTenantSlugFromHost()
    const slug = slugFromHost || companySlug || user?.company_slug
    if (slug) {
      config.headers['X-Tenant-Slug'] = slug
    }
    // FormData must be sent as multipart/form-data; let the browser set Content-Type with boundary
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => Promise.reject(error),
)

api.interceptors.response.use(
  (response) => {
    useConnectionStore.getState().setBackendUnreachable(false)
    return response
  },
  (error) => {
    const isUnreachable =
      error.code === 'ECONNREFUSED' ||
      error.message === 'Network Error' ||
      (error.response === undefined && error.request !== undefined)
    if (isUnreachable) {
      useConnectionStore.getState().setBackendUnreachable(true)
    }
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api

