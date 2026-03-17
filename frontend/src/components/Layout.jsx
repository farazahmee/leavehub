import { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import api from '../services/api'
import { isAdminUser, getUserRoleLabel, isPlatformAdmin } from '../utils/authHelpers'
import AnnouncementBanner from './AnnouncementBanner'
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
  LogOut,
  Megaphone,
  Shield,
} from 'lucide-react'

const Layout = () => {
  const location = useLocation()
  const { user, token, fetchUser, logout } = useAuthStore()
  const isAdmin = isAdminUser(user)
  const isPlatformAdminUser = isPlatformAdmin(user)
  const hasAdminRole =
    isAdmin || (Array.isArray(user?.tenant_roles) && user.tenant_roles.some((r) => ['Company Admin', 'HR Manager', 'Team Lead'].includes(r)))
  const isEmployee = user?.role === 'employee' && !hasAdminRole

  useEffect(() => {
    if (token && !user) {
      fetchUser()
    }
  }, [token, user, fetchUser])

  const { data: pendingLetterCount = 0 } = useQuery({
    queryKey: ['letter-requests-count'],
    queryFn: async () => {
      const res = await api.get('/letters/requests', { params: { status_filter: 'pending' } })
      const list = res.data?.data || []
      return list.length
    },
    enabled: isAdmin,
  })

  const { data: pendingLeaveCount = 0 } = useQuery({
    queryKey: ['pending-leaves-count'],
    queryFn: async () => {
      const res = await api.get('/leave/requests', { params: { status_filter: 'pending' } })
      const list = res.data?.data || []
      return list.length
    },
    enabled: isAdmin,
  })

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data.data
    },
    enabled: isEmployee,
  })
  const displayName = isEmployee ? (summary?.employee_name || user?.username || 'Employee') : null

  const tenantOnlyNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Tenants', href: '/superadmin', icon: Shield },
  ]
  const allNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
    ...(isPlatformAdminUser ? [{ name: 'Tenants', href: '/superadmin', icon: Shield, platformAdminOnly: true }] : []),
    { name: 'Employees', href: '/employees', icon: Users, adminOnly: true },
    { name: 'Teams', href: '/teams', icon: UserCog, adminOnly: false },
    { name: 'Attendance', href: '/attendance', icon: Clock, adminOnly: false },
    { name: 'Leave', href: '/leave', icon: Calendar, adminOnly: false, badge: pendingLeaveCount },
    { name: 'Documents', href: '/documents', icon: FileText, adminOnly: false },
    { name: 'Letters', href: '/letters', icon: Mail, adminOnly: false, hideForEmployee: true, badge: pendingLetterCount },
    { name: 'Payroll', href: '/payroll', icon: DollarSign, adminOnly: false },
    { name: 'Reports', href: '/reports', icon: FileBarChart, adminOnly: true },
    { name: 'Announcements', href: '/announcements', icon: Megaphone, adminOnly: true },
  ]
  const navigation = isPlatformAdminUser
    ? tenantOnlyNav
    : allNav.filter((item) => {
        if (item.platformAdminOnly && !isPlatformAdminUser) return false
        if (item.adminOnly && !isAdmin) return false
        if (item.hideForEmployee && isEmployee) return false
        return true
      })

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50/20">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 max-md:w-56 bg-white/95 backdrop-blur shadow-xl border-r border-gray-200 z-40">
        <div className="flex flex-col h-full">
          {/* Logo / User name for employees */}
          <div className="flex flex-col items-center justify-center h-16 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-center">
            <span className="text-base font-bold text-white truncate max-w-full">
              {isEmployee && displayName ? displayName : 'LeaveHub'}
            </span>
            {isEmployee && summary?.employee_designation && (
              <span className="text-xs text-white/90 truncate max-w-full">{summary.employee_designation}</span>
            )}
          </div>

          {/* Navigation */}
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

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
              <p className="text-xs text-gray-500">{getUserRoleLabel(user)}</p>
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

      {/* Main content */}
      <div className="pl-64 max-md:pl-56">
        <main className="p-8 max-md:p-4">
          <AnnouncementBanner />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
