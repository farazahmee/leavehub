import { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import api from '../services/api'
import AnnouncementBanner from './AnnouncementBanner'
import {
  LayoutDashboard,
  UserCog,
  Calendar,
  FileText,
  DollarSign,
  User,
  LogOut,
} from 'lucide-react'

const Layout = () => {
  const location = useLocation()
  const { user, token, fetchUser, logout } = useAuthStore()

  useEffect(() => {
    if (token && !user) fetchUser()
  }, [token, user, fetchUser])

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data?.data || {}
    },
    enabled: !!token,
  })
  const tenantName = user?.company_name || 'WorkForceHub'
  const displayName = summary?.employee_name || user?.username || 'Employee'
  const displayDesignation = summary?.employee_designation || ''

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Teams', href: '/teams', icon: UserCog },
    { name: 'Leave Requests', href: '/leave', icon: Calendar },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Salary Slip', href: '/payroll', icon: DollarSign },
    { name: 'Personal Information', href: '/personal', icon: User },
  ]

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="fixed inset-y-0 left-0 w-64 bg-white/90 backdrop-blur shadow-xl border-r border-slate-200">
        <div className="flex flex-col h-full">
          <div className="flex flex-col items-center justify-center h-16 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-center">
            <span className="text-base font-bold text-white truncate max-w-full">{tenantName}</span>
            <span className="text-xs text-white/90 truncate max-w-full">{displayName}{displayDesignation ? ` · ${displayDesignation}` : ''}</span>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    isActive(item.href)
                      ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                      : 'text-gray-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          <div className="p-4 border-t border-slate-200">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-500">{tenantName}</p>
            <button
              onClick={logout}
              className="flex items-center w-full mt-3 px-4 py-2 text-sm text-gray-700 rounded-lg hover:bg-slate-100"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>
      <div className="pl-64">
        <main className="p-8">
          <AnnouncementBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
