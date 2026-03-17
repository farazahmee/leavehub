import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import api from '../services/api'

const Login = () => {
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [tenantName, setTenantName] = useState('LeaveHub')

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
      } catch {}
    }
    fetchTenant()
  }, [])

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
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

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSuccess('Reset link sent! Check your inbox — it may take 1-2 minutes to arrive. Also check your spam folder.')
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const s = {
    page: { minHeight: '100vh', background: '#0f1829', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' },
    card: { width: '100%', maxWidth: '400px', background: '#1a2540', borderRadius: '16px', border: '0.5px solid #2e3f5c', padding: '2.5rem' },
    logo: { width: '48px', height: '48px', background: '#c9a227', borderRadius: '12px', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    title: { color: '#f0d060', fontSize: '22px', fontWeight: '500', textAlign: 'center', margin: '0 0 4px' },
    subtitle: { color: '#7a8fad', fontSize: '14px', textAlign: 'center', margin: '0 0 2rem' },
    label: { display: 'block', fontSize: '13px', color: '#7a8fad', marginBottom: '6px' },
    input: { width: '100%', background: '#0f1829', border: '0.5px solid #2e3f5c', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none', marginBottom: '1.25rem' },
    btn: { width: '100%', background: '#c9a227', border: 'none', borderRadius: '8px', padding: '11px', color: '#0f1829', fontSize: '15px', fontWeight: '500', cursor: 'pointer', marginTop: '0.5rem' },
    btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
    error: { background: '#2d1515', border: '0.5px solid #7a2020', color: '#f87171', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '1rem' },
    success: { background: '#0f2d1a', border: '0.5px solid #1a6b3a', color: '#4ade80', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '1rem' },
    link: { color: '#c9a227', cursor: 'pointer', background: 'none', border: 'none', fontSize: '13px', padding: 0 },
    check: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem' },
    checkLabel: { fontSize: '13px', color: '#7a8fad' },
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#0f1829" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={s.title}>{tenantName}</h1>
        <p style={s.subtitle}>{mode === 'login' ? 'Sign in to manage your company' : 'Reset your password'}</p>

        {error && <div style={s.error}>{error}</div>}
        {success && <div style={s.success}>{success}</div>}

        {mode === 'login' ? (
          <form onSubmit={handleSignIn}>
            <label style={s.label}>Company email</label>
            <input style={s.input} type="email" required placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            <div style={s.check}>
              <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ accentColor: '#c9a227' }} />
              <label htmlFor="remember" style={s.checkLabel}>Remember me (stay signed in for 14 days)</label>
            </div>
            <button type="submit" style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '13px', color: '#7a8fad' }}>
              <button style={s.link} type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}>Forgot password?</button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword}>
            <label style={s.label}>Company email</label>
            <input style={s.input} type="email" required placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            <button type="submit" style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '13px', color: '#7a8fad' }}>
              <button style={s.link} type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>Back to sign in</button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default Login
