import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const EmployeePortal = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.success) {
      navigate('/dashboard', { replace: true })
    } else {
      setError(result.error || 'Sign in failed')
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-100 via-emerald-50 to-slate-100 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-sky-200/60 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-emerald-200/55 blur-3xl" />
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-[520px] w-[520px] rounded-[40%] border border-slate-200/60 bg-slate-100/60 backdrop-blur-2xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-6 p-8 bg-white/85 border border-slate-200 rounded-2xl shadow-[0_20px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="text-center mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Employee Portal</h1>
            <p className="mt-2 text-gray-600">Sign in to access your dashboard</p>
          </div>
          <form onSubmit={handleSignIn} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email or Username</label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            First time? Check your email for the set-password link from your admin.
          </p>
          <p className="mt-4 text-center">
            <a href="/login" className="text-sm text-blue-600 hover:text-blue-800">
              Admin login
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default EmployeePortal
