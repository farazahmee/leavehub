import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5176,
    allowedHosts: ['all'],
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.headers?.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization)
            }
            if (req.headers?.['x-tenant-slug']) {
              proxyReq.setHeader('X-Tenant-Slug', req.headers['x-tenant-slug'])
            }
          })
        },
      },
    },
  },
})

