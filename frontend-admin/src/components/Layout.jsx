import { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import useConnectionStore from '../store/connectionStore'
import api from '../services/api'
import {
  LayoutDashboard,
  Users,
  UserCog,
  Clock,
  Calendar,
  FileText,
  FileBarChart,
  Mail,
  DollarSign,
  Megaphone,
  Shield,
  LogOut,
} from 'lucide-react'

const Layout = () => {
  const location = useLocation()
  const { user, token, fetchUser, logout, companyName } = useAuthStore()
  const { backendUnreachable, setBackendUnreachable } = useConnectionStore()

  useEffect(() => {
    if (token && !user) {
      fetchUser()
    }
  }, [token, user, fetchUser])

  const { data: pendingLetterCount = 0 } = useQuery({
    queryKey: ['ca-letter-requests-count'],
    queryFn: async () => {
      const res = await api.get('/letters/requests', { params: { status_filter: 'pending' } })
      const list = res.data?.data || []
      return list.length
    },
    enabled: !!token,
  })

  const { data: pendingLeaveCount = 0 } = useQuery({
    queryKey: ['ca-pending-leaves-count'],
    queryFn: async () => {
      const res = await api.get('/leave/requests', { params: { status_filter: 'pending' } })
      const list = res.data?.data || []
      return list.length
    },
    enabled: !!token,
  })

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Employees', href: '/employees', icon: Users },
    { name: 'Teams', href: '/teams', icon: UserCog },
    { name: 'Attendance', href: '/attendance', icon: Clock },
    { name: 'Leave', href: '/leave', icon: Calendar, badge: pendingLeaveCount },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Letters', href: '/letters', icon: Mail, badge: pendingLetterCount },
    { name: 'Payroll', href: '/payroll', icon: DollarSign },
    { name: 'Reports', href: '/reports', icon: FileBarChart },
    { name: 'Announcements', href: '/announcements', icon: Megaphone },
    { name: 'Roles & Permissions', href: '/roles', icon: Shield },
  ]

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const headerTitle = companyName || user?.company_name || 'WorkForceHub'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/20">
      <div className="fixed inset-y-0 left-0 w-64 max-md:w-56 bg-white/95 backdrop-blur shadow-xl border-r border-gray-200 z-40">
        <div className="flex flex-col h-full">
          <div className="flex flex-col items-center justify-center h-16 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-center">
            <span className="text-base font-bold text-white truncate max-w-full">
              {headerTitle}
            </span>
            {user?.email && (
              <span className="text-xs text-white/90 truncate max-w-full">
                {user.email}
              </span>
            )}
          </div>

          <nav className="flex-1 px-3 py-6 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const badge = item.badge
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    isActive(item.href)
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center">
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </span>
                  {badge != null && badge > 0 && (
                    <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold text-white bg-red-500 rounded-full">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.username}
              </p>
              <p className="text-xs text-gray-500">
                Company Admin
              </p>
            </div>
            <button
              onClick={logout}
              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="pl-64 max-md:pl-56">
        {backendUnreachable && (
          <div className="bg-amber-500 text-white px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Backend not running — employees and data will not load.</p>
              <p className="text-sm text-amber-100 mt-0.5">
                In a separate terminal run: <code className="bg-amber-600/80 px-1.5 py-0.5 rounded text-xs">cd backend</code> then <code className="bg-amber-600/80 px-1.5 py-0.5 rounded text-xs">uvicorn main:app --reload --host 0.0.0.0 --port 8080</code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBackendUnreachable(false)}
              className="shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        )}
        <main className="p-8 max-md:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout

