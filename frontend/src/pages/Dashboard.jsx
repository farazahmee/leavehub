import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { isPlatformAdmin } from '../utils/authHelpers'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Users, Clock, Calendar, FileText, UserCog, AlertCircle, LogIn, LogOut, X, Award, UserCheck, ChevronLeft, ChevronRight, Building2, Activity } from 'lucide-react'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, format, isSameMonth, isSameDay } from 'date-fns'

const cardEndpoints = {
  'Total Employees': '/dashboard/card/employees',
  'Present Today': '/dashboard/card/present-today',
  'On Leave Today': '/dashboard/card/on-leave-today',
  'Pending Leave Requests': '/dashboard/card/pending-leaves',
  'Total Teams': '/dashboard/card/teams',
  'Documents Uploaded': '/dashboard/card/documents',
}

const DetailModal = ({ title, onClose, endpoint }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-card', endpoint],
    queryFn: async () => {
      const res = await api.get(endpoint)
      return res.data.data
    },
    enabled: !!endpoint,
  })

  const isEmployees = endpoint?.includes('employees') || endpoint?.includes('present') || endpoint?.includes('on-leave')
  const isPendingLeaves = endpoint?.includes('pending-leaves')
  const isTeams = endpoint?.includes('teams')
  const isDocuments = endpoint?.includes('documents')

  const renderRows = () => {
    if (isLoading) return <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-900">Loading...</td></tr>
    if (!data?.length) return <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-900">No data</td></tr>
    if (isPendingLeaves) {
      return data.map((r) => (
        <tr key={r.id} className="border-b border-gray-100">
          <td className="px-4 py-3 text-sm">{r.employee_id}</td>
          <td className="px-4 py-3 text-sm">{r.employee_name}</td>
          <td className="px-4 py-3 text-sm">{r.leave_type} ({r.days} day{r.days !== 1 ? 's' : ''})</td>
          <td className="px-4 py-3 text-sm">{r.start_date} – {r.end_date}</td>
        </tr>
      ))
    }
    if (isTeams) {
      return data.map((t) => (
        <tr key={t.id} className="border-b border-gray-100">
          <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
          <td className="px-4 py-3 text-sm text-gray-900 col-span-3">{t.description || '-'}</td>
        </tr>
      ))
    }
    if (isDocuments) {
      return data.map((d) => (
        <tr key={d.id} className="border-b border-gray-100">
          <td className="px-4 py-3 text-sm">{d.name}</td>
          <td className="px-4 py-3 text-sm">{d.employee_name}</td>
          <td className="px-4 py-3 text-sm">{d.file_type}</td>
          <td className="px-4 py-3 text-sm text-gray-900">{d.created_at?.slice(0, 10)}</td>
        </tr>
      ))
    }
    if (isEmployees) {
      return data.map((e) => (
        <tr key={e.id} className="border-b border-gray-100">
          <td className="px-4 py-3 text-sm">{e.employee_id}</td>
          <td className="px-4 py-3 text-sm font-medium">{e.first_name} {e.last_name}</td>
          <td className="px-4 py-3 text-sm">{e.designation || '-'}</td>
          <td className="px-4 py-3 text-sm">{e.department || '-'}</td>
        </tr>
      ))
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-900 hover:text-gray-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-auto flex-1 text-gray-900">
          <table className="min-w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {isPendingLeaves && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">ID</th>}
                {isPendingLeaves && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Employee</th>}
                {isPendingLeaves && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Leave</th>}
                {isPendingLeaves && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Period</th>}
                {isTeams && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Name</th>}
                {isTeams && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase col-span-3">Description</th>}
                {isDocuments && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Name</th>}
                {isDocuments && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Employee</th>}
                {isDocuments && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Type</th>}
                {isDocuments && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Date</th>}
                {isEmployees && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">ID</th>}
                {isEmployees && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Name</th>}
                {isEmployees && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Designation</th>}
                {isEmployees && <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">Department</th>}
              </tr>
            </thead>
            <tbody>{renderRows()}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const Dashboard = () => {
  const user = useAuthStore((s) => s.user)
  const isPlatformAdminUser = isPlatformAdmin(user)
  const [detailCard, setDetailCard] = useState(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [todayOverride, setTodayOverride] = useState(null)
  const [forceCheckedIn, setForceCheckedIn] = useState(false)
  const queryClient = useQueryClient()

  const { data: platformStats = {}, isLoading: platformStatsLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const res = await api.get('/superadmin/stats')
      return res.data?.data || {}
    },
    enabled: isPlatformAdminUser,
  })

  const { data: alerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const res = await api.get('/dashboard/alerts')
      return res.data.data
    },
    enabled: !isPlatformAdminUser,
  })
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const response = await api.get('/dashboard/summary')
      return response.data.data
    },
    enabled: !isPlatformAdminUser,
  })

  const { data: analytics } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: async () => {
      const res = await api.get('/dashboard/analytics')
      return res.data.data
    },
    enabled: !isPlatformAdminUser,
  })

  const isEmployeeDashboard = data?.role === 'employee' && !data?.is_admin
  const { data: historyRaw, refetch: refetchHistory } = useQuery({
    queryKey: ['attendance-history'],
    queryFn: async () => {
      const res = await api.get('/attendance/history')
      const raw = res.data?.data
      return Array.isArray(raw) ? raw : raw?.data ?? []
    },
    enabled: isEmployeeDashboard,
  })
  const history = historyRaw ?? []

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-in', { is_late: false }),
    onSuccess: (res) => {
      setForceCheckedIn(true)
      const body = res?.data
      const newRecord = body?.data ?? (body && (body.id != null || body.check_in_time != null) ? body : null)
      const systemTime = new Date().toISOString()
      const recordToStore = newRecord
        ? { ...newRecord, check_out_time: null, check_in_time: systemTime }
        : { check_in_time: systemTime, check_out_time: null, date: new Date().toISOString().slice(0, 10) }
      setTodayOverride(recordToStore)
      if (newRecord?.id != null) {
        queryClient.setQueryData(['attendance-history'], (prev) => {
          const list = Array.isArray(prev) ? prev : []
          return [recordToStore, ...list.filter((h) => h.id !== newRecord.id)]
        })
      }
      refetchHistory()
      queryClient.invalidateQueries(['dashboard-summary'])
    },
  })

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-out', {}),
    onSuccess: (res) => {
      setForceCheckedIn(false)
      const payload = res?.data
      const updated = payload?.data ?? payload
      if (updated?.id) {
        setTodayOverride(updated)
        queryClient.setQueryData(['attendance-history'], (prev) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((h) => (h.id === updated.id ? { ...h, ...updated } : h))
        })
      }
      refetchHistory()
      queryClient.invalidateQueries(['dashboard-summary'])
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? ''
      if (typeof detail === 'string' && (detail.toLowerCase().includes('no active check-in') || detail.toLowerCase().includes('check in first'))) {
        setForceCheckedIn(false)
        refetchHistory()
        queryClient.invalidateQueries(['dashboard-summary'])
      }
    },
  })

  const now = new Date()
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayRecordFromHistory =
    history.find((h) => (h.date || '').toString().slice(0, 10) === todayLocal) ||
    history.find((h) => !h.check_out_time)
  const todayRecord = todayOverride ?? todayRecordFromHistory
  const checkedIn = forceCheckedIn || Boolean(todayRecord && !todayRecord.check_out_time)
  const today = todayLocal

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }
  const getAttendanceForDate = (d) => {
    const dateStr = format(d, 'yyyy-MM-dd')
    return history.find((h) => (h.date || '').slice(0, 10) === dateStr)
  }
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const platformAdminStats = [
    { name: 'Total Companies', value: platformStats.companies_total ?? 0, icon: Building2, color: 'bg-blue-500', clickable: false },
    { name: 'Active Companies', value: platformStats.companies_active ?? 0, icon: Activity, color: 'bg-green-500', clickable: false },
    { name: 'Deactive Companies', value: platformStats.companies_inactive ?? 0, icon: UserCog, color: 'bg-gray-500', clickable: false },
    { name: 'Pending Invoices', value: platformStats.pending_invoices ?? 0, icon: AlertCircle, color: 'bg-amber-500', clickable: false },
    { name: 'Coming Invoices (7 days)', value: platformStats.coming_invoices ?? 0, icon: Calendar, color: 'bg-indigo-500', clickable: false },
  ]

  const adminStats = [
    { name: 'Total Employees', value: data?.total_employees ?? 0, icon: Users, color: 'bg-blue-500', clickable: true },
    { name: 'Admins', value: data?.total_admins ?? 0, icon: UserCheck, color: 'bg-slate-600', clickable: false },
    { name: 'Present Today', value: data?.present_today ?? 0, icon: Clock, color: 'bg-green-500', clickable: true },
    { name: 'On Leave Today', value: data?.on_leave_today ?? 0, icon: Calendar, color: 'bg-yellow-500', clickable: true },
    { name: 'Pending Leave Requests', value: data?.pending_leave_requests ?? 0, icon: AlertCircle, color: 'bg-orange-500', clickable: true },
    { name: 'Total Teams', value: data?.total_teams ?? 0, icon: UserCog, color: 'bg-purple-500', clickable: true },
    { name: 'Documents Uploaded', value: data?.documents_uploaded ?? 0, icon: FileText, color: 'bg-indigo-500', clickable: true },
  ]

  const employeeStats = [
    { name: 'Checked In Today', value: data?.checked_in_today ? 'Yes' : 'No', icon: LogIn, color: data?.checked_in_today ? 'bg-green-500' : 'bg-gray-400', clickable: false },
    { name: 'Annual Leave Balance', value: data?.leave_balance?.annual ?? 0, icon: Calendar, color: 'bg-blue-500', clickable: false },
    { name: 'Sick Leave Balance', value: data?.leave_balance?.sick ?? 0, icon: Calendar, color: 'bg-yellow-500', clickable: false },
    { name: 'Casual Leave Balance', value: data?.leave_balance?.casual ?? 0, icon: Calendar, color: 'bg-orange-500', clickable: false },
    { name: 'Pending Leave Requests', value: data?.my_leave_requests_pending ?? 0, icon: AlertCircle, color: 'bg-amber-500', clickable: false },
    { name: 'My Documents', value: data?.documents_uploaded ?? 0, icon: FileText, color: 'bg-indigo-500', clickable: false },
  ]

  const stats = isPlatformAdminUser
    ? platformAdminStats
    : isEmployeeDashboard
      ? employeeStats
      : adminStats

  const dashboardLoading = isPlatformAdminUser ? platformStatsLoading : isLoading
  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-900">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {isEmployeeDashboard && data?.employee_name ? `Welcome, ${data.employee_name}` : 'Dashboard'}
      </h1>
      {isEmployeeDashboard && (
        <p className="text-gray-900 mb-8">Your personal overview</p>
      )}
      {!isEmployeeDashboard && (
        <p className="text-gray-900 mb-8">Organization overview</p>
      )}

      {alerts && (alerts.probation_ending_soon?.length > 0 || alerts.work_anniversaries?.length > 0) && (
        <div className="mb-8 space-y-4">
          {alerts.probation_ending_soon?.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-2">
                <UserCheck className="w-5 h-5" /> Probation ending soon (next 14 days)
              </h3>
              <ul className="text-sm text-amber-800 space-y-1">
                {alerts.probation_ending_soon.map((p) => (
                  <li key={p.employee_id}>
                    <strong>{p.employee_name}</strong> ({p.designation || '-'}) — ends {p.probation_end_date}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {alerts.work_anniversaries?.length > 0 && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <h3 className="font-semibold text-emerald-900 flex items-center gap-2 mb-2">
                <Award className="w-5 h-5" /> Work anniversaries (next 7 days)
              </h3>
              <ul className="text-sm text-emerald-800 space-y-1">
                {alerts.work_anniversaries.map((a) => (
                  <li key={a.employee_id}>
                    <strong>{a.employee_name}</strong> ({a.designation || '-'}) — {a.years} year{a.years !== 1 ? 's' : ''} on {a.anniversary_date}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {isEmployeeDashboard && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Attendance</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={() => checkInMutation.mutate()}
                  disabled={checkedIn || checkInMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <LogIn className="w-5 h-5" /> Check In
                </button>
                <button
                  onClick={() => checkOutMutation.mutate()}
                  disabled={!checkedIn || checkOutMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <LogOut className="w-5 h-5" /> Check Out
                </button>
              </div>
              {todayRecord && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm font-medium text-gray-700">Today&apos;s status</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    In: {todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString() : '--'}
                    {todayRecord.check_out_time && (
                      <> &bull; Out: {new Date(todayRecord.check_out_time).toLocaleTimeString()}</>
                    )}
                    {todayRecord.total_time_display && (
                      <span className="font-medium text-gray-800"> &bull; Total: {todayRecord.total_time_display}</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Attendance Calendar</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-center font-medium text-gray-700 mb-4">{format(currentMonth, 'MMMM yyyy')}</p>
              <div className="grid grid-cols-7 gap-1 text-xs font-medium text-gray-500 mb-2">
                {weekDays.map((d) => (
                  <div key={d} className="text-center py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const att = getAttendanceForDate(d)
                  const isCurrentMonth = isSameMonth(d, currentMonth)
                  const isToday = isSameDay(d, new Date())
                  return (
                    <div
                      key={d.toString()}
                      className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm
                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                        ${isToday ? 'bg-blue-100 font-bold text-blue-700 ring-2 ring-blue-400' : ''}
                        ${att && isCurrentMonth && !isToday ? 'bg-green-50 text-green-700' : ''}
                      `}
                    >
                      {format(d, 'd')}
                      {att && isCurrentMonth && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-0.5" />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Present
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Today
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-6 ${isPlatformAdminUser ? 'md:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
        {stats.map((stat) => {
          const Icon = stat.icon
          const isClickable = !isPlatformAdminUser && stat.clickable && cardEndpoints[stat.name]
          return (
            <div
              key={stat.name}
              onClick={() => isClickable && setDetailCard({ name: stat.name, endpoint: cardEndpoints[stat.name] })}
              className={`bg-white rounded-lg shadow p-6 border border-gray-200 ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-shadow' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!isEmployeeDashboard && !isPlatformAdminUser && analytics?.leave_by_type?.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave by type (this year)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.leave_by_type}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" name="Days" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {detailCard && (
        <DetailModal
          title={detailCard.name}
          endpoint={detailCard.endpoint}
          onClose={() => setDetailCard(null)}
        />
      )}
    </div>
  )
}

export default Dashboard
