import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import api from '../services/api'

const Login = () => {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [tenantName, setTenantName] = useState('WorkForceHub')

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const login = useAuthStore((state) => state.login)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      setError('Sign in was cancelled or failed. Please try again.')
      window.history.replaceState({}, '', '/login')
    }
  }, [searchParams])

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await api.get('/tenant/info')
        const name = res.data?.data?.name
        if (name) setTenantName(name)
      } catch {
        // Keep WorkForceHub fallback
      }
    }
    fetchTenant()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password, rememberMe)
    setLoading(false)
    if (result.success) {
      navigate('/', { replace: true })
    } else {
      setError(result.error || 'Sign in failed')
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-100 via-emerald-50 to-slate-100 text-slate-900">
      {/* Decorative background shapes */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-emerald-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-sky-200/55 blur-3xl" />
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-[520px] w-[520px] rounded-[40%] border border-slate-200/60 bg-slate-100/60 backdrop-blur-2xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-6 p-8 bg-white/85 border border-slate-200 rounded-2xl shadow-[0_20px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            {tenantName}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to manage your company in WorkForceHub.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
              Remember me (stay signed in for 14 days)
            </label>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  </div>
  )
}

export default Login

