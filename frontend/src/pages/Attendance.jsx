import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { isAdminUser } from '../utils/authHelpers'
import { LogIn, LogOut, Clock } from 'lucide-react'

const Attendance = () => {
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [message, setMessage] = useState(null)
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['attendance-history', dateRange.start, dateRange.end],
    queryFn: async () => {
      const params = {}
      if (dateRange.start) params.start_date = dateRange.start
      if (dateRange.end) params.end_date = dateRange.end
      const res = await api.get('/attendance/history', { params })
      const raw = res.data?.data
      return Array.isArray(raw) ? raw : raw?.data ?? []
    },
  })

  const { data: allAttendanceData } = useQuery({
    queryKey: ['attendance-all', dateRange.start, dateRange.end, employeeFilter],
    queryFn: async () => {
      const params = {}
      if (dateRange.start) params.start_date = dateRange.start
      if (dateRange.end) params.end_date = dateRange.end
      if (employeeFilter) params.employee_id = employeeFilter
      const res = await api.get('/attendance/all', { params })
      return res.data.data
    },
    enabled: isAdmin,
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-list-att'],
    queryFn: async () => {
      const res = await api.get('/dashboard/card/employees')
      const d = res.data?.data
      return Array.isArray(d) ? d : []
    },
    enabled: isAdmin,
  })

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-in', { is_late: false }),
    onSuccess: () => {
      setMessage(null)
      refetchHistory()
    },
    onError: (err) => {
      const detail = err.response?.data?.detail
      const isAlreadyIn = typeof detail === 'string' && detail.toLowerCase().includes('already checked in')
      if (isAlreadyIn) {
        setMessage('You\'re already checked in today. Use Check Out when you leave.')
      } else {
        setMessage(detail || 'Check-in failed. Please try again.')
      }
      refetchHistory()
    },
  })

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-out', {}),
    onSuccess: () => {
      setMessage(null)
      refetchHistory()
    },
    onError: (err) => {
      setMessage(err.response?.data?.detail || 'Check-out failed. Please try again.')
      refetchHistory()
    },
  })

  const history = isAdmin && allAttendanceData ? allAttendanceData : (historyData || [])
  const historyList = Array.isArray(history) ? history : []
  const now = new Date()
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayRecord =
    historyList.find((h) => (h.date || '').toString().slice(0, 10) === todayLocal) ||
    historyList.find((h) => !h.check_out_time)
  const isCheckedIn = Boolean(todayRecord && !todayRecord.check_out_time)

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Attendance</h1>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${message.includes('already checked in') ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
          role="alert"
        >
          {message}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex gap-3">
          <button
            onClick={() => checkInMutation.mutate()}
            disabled={isCheckedIn || checkInMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" /> Check In
          </button>
          <button
            onClick={() => checkOutMutation.mutate()}
            disabled={!isCheckedIn || checkOutMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4" /> Check Out
          </button>
        </div>
        {isAdmin && (
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-gray-900"
          >
            <option value="">All employees</option>
            {(employeesData || []).map((e) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
            ))}
          </select>
        )}
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
          <span>to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      {todayRecord && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-4">
          <Clock className="w-8 h-8 text-blue-600" />
          <div>
            <p className="font-medium text-gray-900">Today&apos;s status</p>
            <p className="text-sm text-gray-600">
              Checked in: {new Date(todayRecord.check_in_time).toLocaleTimeString()}
              {todayRecord.check_out_time && ` • Checked out: ${new Date(todayRecord.check_out_time).toLocaleTimeString()}`}
              {todayRecord.total_time_display && (
                <span className="ml-1 font-medium text-gray-800"> • Total: {todayRecord.total_time_display}</span>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Employee</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Check In</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Check Out</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Total Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.length === 0 ? (
              <tr><td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-gray-900">No attendance records</td></tr>
            ) : (
              history.map((h) => (
                <tr key={h.id}>
                  {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-gray-900">{h.employee_name || h.employee_id || '-'}</td>}
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">{h.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">{h.check_in_time ? new Date(h.check_in_time).toLocaleTimeString() : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">{h.check_out_time ? new Date(h.check_out_time).toLocaleTimeString() : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-700">{h.total_time_display ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${h.check_out_time ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {h.check_out_time ? 'Completed' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Attendance
