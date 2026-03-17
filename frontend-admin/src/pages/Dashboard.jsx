import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { Users, Clock, CalendarCheck, FileText, LogIn, LogOut, AlertCircle } from 'lucide-react'

const Dashboard = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [systemTime, setSystemTime] = useState(new Date().toISOString())

  useEffect(() => {
    const t = setInterval(() => setSystemTime(new Date().toISOString()), 1000)
    return () => clearInterval(t)
  }, [])

  const { data: summary = {} } = useQuery({
    queryKey: ['ca-dashboard-summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data?.data || {}
    },
  })

  const { data: attendanceHistory = [] } = useQuery({
    queryKey: ['ca-attendance-history'],
    queryFn: async () => {
      const res = await api.get('/attendance/history')
      const d = res.data?.data
      return Array.isArray(d) ? d : []
    },
  })

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['ca-leave-requests'],
    queryFn: async () => {
      const res = await api.get('/leave/requests?status_filter=pending')
      const d = res.data?.data
      return Array.isArray(d) ? d : []
    },
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['ca-dashboard-alerts'],
    queryFn: async () => {
      const res = await api.get('/dashboard/alerts')
      const d = res.data?.data
      return Array.isArray(d) ? d : []
    },
  })

  const todayLocal = new Date().toLocaleDateString('en-CA')
  const todayRecord = attendanceHistory.find(r => {
    const d = r.date || (r.check_in_time ? new Date(r.check_in_time).toLocaleDateString('en-CA') : null)
    return d === todayLocal
  })

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-in', { is_late: false }),
    onSuccess: () => queryClient.invalidateQueries(['ca-attendance-history']),
  })

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-out', {}),
    onSuccess: () => queryClient.invalidateQueries(['ca-attendance-history']),
  })

  const stats = [
    { label: 'Total Employees', value: summary.total_employees ?? '--', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Present Today', value: summary.present_today ?? '--', icon: CalendarCheck, color: 'bg-green-50 text-green-600' },
    { label: 'Pending Leaves', value: pendingLeaves.length ?? '--', icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Documents', value: summary.total_documents ?? '--', icon: FileText, color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {summary.employee_name || user?.username}</h1>
        <p className="text-gray-500 text-sm mt-1">Your company overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Attendance Check-in */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Attendance
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending || !!todayRecord?.check_in_time}
              className="flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 font-medium"
            >
              <LogIn className="w-5 h-5" /> Check In
            </button>
            <button
              onClick={() => checkOutMutation.mutate()}
              disabled={checkOutMutation.isPending || !todayRecord?.check_in_time || !!todayRecord?.check_out_time}
              className="flex items-center justify-center gap-2 py-3 bg-orange-400 text-white rounded-xl hover:bg-orange-500 disabled:opacity-50 font-medium"
            >
              <LogOut className="w-5 h-5" /> Check Out
            </button>
          </div>
          {todayRecord && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <span className="font-medium">Today: </span>
              In: {todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString() : '--'}
              {' · '}
              Out: {todayRecord.check_out_time ? new Date(todayRecord.check_out_time).toLocaleTimeString() : '--'}
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" /> Alerts & Reminders
          </h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No alerts at this time</p>
          ) : (
            <ul className="space-y-2">
              {alerts.slice(0, 5).map((a, i) => (
                <li key={i} className="text-sm text-gray-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                  {a.message || a}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pending Leave Requests */}
      {pendingLeaves.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Leave Requests ({pendingLeaves.length})</h2>
          <div className="divide-y divide-gray-100">
            {pendingLeaves.slice(0, 5).map((l) => (
              <div key={l.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{l.employee_name || l.username}</p>
                  <p className="text-xs text-gray-500">{l.leave_type} · {l.start_date} to {l.end_date}</p>
                </div>
                <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
