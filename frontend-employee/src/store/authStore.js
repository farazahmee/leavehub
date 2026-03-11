import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username, password, rememberMe = false) => {
        try {
          const response = await api.post('/auth/login', new URLSearchParams({
            username,
            password,
            remember_me: rememberMe ? 'true' : 'false',
          }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          })
          const { data } = response.data
          const token = data?.access_token
          if (!token) return { success: false, error: 'Invalid login response' }

          set({ token, isAuthenticated: true })

          try {
            const meRes = await api.get('/auth/me')
            if (meRes.data?.data) set({ user: meRes.data.data })
          } catch (err) {
            set({ token: null, isAuthenticated: false })
            return { success: false, error: 'Session could not be established.' }
          }
          return { success: true }
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.detail || error.response?.data?.message || 'Login failed',
          }
        }
      },

      logout: () => set({ user: null, token: null, isAuthenticated: false }),

      fetchUser: async () => {
        try {
          const res = await api.get('/auth/me')
          if (res.data?.data) set({ user: res.data.data })
        } catch (e) {
          console.error('Failed to fetch user:', e)
        }
      },
    }),
    {
      name: 'auth-storage-employee',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, isAuthenticated: s.isAuthenticated, user: s.user }),
    }
  )
)

export default useAuthStore
