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
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })

          const { data } = response.data
          const token = data?.access_token
          if (!token) {
            return { success: false, error: 'Invalid login response' }
          }

          set({
            token,
            isAuthenticated: true,
          })

          // Fetch user immediately with the fresh token to verify auth works
          try {
            const meRes = await api.get('/auth/me')
            if (meRes.data?.data) {
              set({ user: meRes.data.data })
            }
          } catch (err) {
            console.error('auth/me failed after login:', err)
            set({ token: null, isAuthenticated: false })
            return {
              success: false,
              error: 'Session could not be established. Please try again.',
            }
          }
          return { success: true }
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.detail || error.response?.data?.message || 'Login failed',
          }
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },

      setUser: (user) => set({ user }),

      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me')
          if (response.data?.data) {
            set({ user: response.data.data })
          }
        } catch (error) {
          console.error('Failed to fetch user:', error)
        }
      },

      signup: async (first_name, last_name, company_name, email, password) => {
        try {
          await api.post('/auth/signup', {
            first_name,
            last_name,
            company_name,
            email,
            password,
          })
          return { success: true, message: 'Account created. You can now sign in.' }
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.detail || error.response?.data?.message || 'Signup failed',
          }
        }
      },

      // For Google OAuth callback - set tokens and fetch user
      setTokensFromCallback: async (accessToken, refreshToken) => {
        set({
          token: accessToken,
          refreshToken: refreshToken,
          isAuthenticated: true,
        })
        try {
          const response = await api.get('/auth/me')
          set({ user: response.data.data })
        } catch (error) {
          console.error('Failed to fetch user info:', error)
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
)

export default useAuthStore
export { useAuthStore }
