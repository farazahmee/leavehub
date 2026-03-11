import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      companySlug: null,
      companyName: null,

      login: async (username, password, rememberMe = false) => {
        try {
          const response = await api.post(
            '/auth/login',
            new URLSearchParams({
              username,
              password,
              remember_me: rememberMe ? 'true' : 'false',
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            },
          )

          const { data } = response.data
          const token = data?.access_token
          if (!token) {
            return { success: false, error: 'Invalid login response' }
          }

          set({
            token,
            isAuthenticated: true,
          })

          try {
            const meRes = await api.get('/auth/me')
            if (meRes.data?.data) {
              const u = meRes.data.data
              set({
                user: u,
                companySlug: u.company_slug || null,
                companyName: u.company_name || null,
              })
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
          companySlug: null,
          companyName: null,
        })
      },

      setUser: (user) =>
        set({
          user,
          companySlug: user?.company_slug || null,
          companyName: user?.company_name || null,
        }),

      fetchUser: async () => {
        try {
          const response = await api.get('/auth/me')
          if (response.data?.data) {
            const u = response.data.data
            set({
              user: u,
              companySlug: u.company_slug || null,
              companyName: u.company_name || null,
            })
          }
        } catch (error) {
          console.error('Failed to fetch user:', error)
        }
      },
    }),
    {
      name: 'auth-storage-company-admin',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        companySlug: state.companySlug,
        companyName: state.companyName,
      }),
    },
  ),
)

export default useAuthStore

