import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { isAdminUser } from '../utils/authHelpers'
import api from '../services/api'
import { FileDown, Calendar, Users, DollarSign, UserCheck } from 'lucide-react'

const Reports = () => {
  const [year, setYear] = useState(new Date().getFullYear())
  const [employeeName, setEmployeeName] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)

  const { data: employeesData } = useQuery({
    queryKey: ['dashboard-card-employees'],
    queryFn: async () => {
      const res = await api.get('/dashboard/card/employees')
      const list = res.data?.data
      return Array.isArray(list) ? list : []
    },
    enabled: isAdmin,
  })
  const employees = employeesData || []

  const appendEmployeeParam = (path) => {
    if (employeeName?.trim()) {
      const sep = path.includes('?') ? '&' : '?'
      return `${path}${sep}employee_name=${encodeURIComponent(employeeName.trim())}`
    }
    return path
  }

  const appendEmployeeIdParam = (path, empId) => {
    const id = empId || selectedEmployeeId
    if (id) {
      const sep = path.includes('?') ? '&' : '?'
      return `${path}${sep}employee_id=${id}`
    }
    return path
  }

  const handleExport = async (path, filename) => {
    const token = useAuthStore.getState().token
    const url = `${window.location.origin}/api/v1${path}`
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const blob = await res.blob()
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = filename || 'export.csv'
      a.click()
      URL.revokeObjectURL(u)
    } catch (_) {}
  }

  if (!isAdmin) {
    return <div className="text-gray-900">Access denied</div>
  }

  const selectedEmployee = employees.find((e) => String(e.id) === String(selectedEmployeeId))
  const selectedLabel = selectedEmployee
    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name} (${selectedEmployee.employee_id})`
    : ''

  return (
    <div className="min-h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Reports & Exports</h1>
        <p className="mt-1 text-gray-500">Export attendance, leave, and payroll data as CSV</p>
      </div>

      {/* Extract by employee - prominent section */}
      <div className="mb-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <UserCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Extract report by employee</h2>
            <p className="text-sm text-slate-300">Download all reports for a single employee</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[280px]">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Select employee</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Choose an employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id} className="text-gray-900">
                  {e.first_name} {e.last_name} ({e.employee_id})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                const start = document.getElementById('att-start')?.value
                const end = document.getElementById('att-end')?.value
                let path = '/reports/attendance?'
                if (start) path += `start_date=${start}&`
                if (end) path += `end_date=${end}`
                path = appendEmployeeIdParam(path.replace(/\?$/, '') || '/reports/attendance')
                handleExport(path, selectedLabel ? `attendance_${selectedEmployee?.employee_id || 'export'}.csv` : 'attendance_export.csv')
              }}
              disabled={!selectedEmployeeId}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <Calendar className="w-4 h-4" /> Attendance
            </button>
            <button
              onClick={() => {
                const status = document.getElementById('leave-status')?.value
                const start = document.getElementById('leave-start')?.value
                const end = document.getElementById('leave-end')?.value
                let path = '/reports/leave'
                const params = []
                if (status) params.push(`status_filter=${status}`)
                if (start) params.push(`start_date=${start}`)
                if (end) params.push(`end_date=${end}`)
                if (params.length) path += `?${params.join('&')}`
                path = appendEmployeeIdParam(path)
                handleExport(path, selectedLabel ? `leave_${selectedEmployee?.employee_id || 'export'}.xlsx` : 'leave_export.xlsx')
              }}
              disabled={!selectedEmployeeId}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <Users className="w-4 h-4" /> Leave
            </button>
            <button
              onClick={() => {
                let path = `/reports/payroll?year=${year}`
                path = appendEmployeeIdParam(path)
                handleExport(path, selectedLabel ? `payroll_${selectedEmployee?.employee_id || 'export'}.csv` : 'payroll_export.csv')
              }}
              disabled={!selectedEmployeeId}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors shadow-lg"
            >
              <DollarSign className="w-4 h-4" /> Payroll
            </button>
          </div>
        </div>
      </div>

      {/* Global filter */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by employee name (optional)</label>
        <input
          type="text"
          value={employeeName}
          onChange={(e) => setEmployeeName(e.target.value)}
          placeholder="Enter name or employee ID to filter exports below"
          className="max-w-md px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-xl hover:border-blue-100 transition-all duration-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Attendance Export</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">Export attendance records as CSV.</p>
          <div className="flex gap-2 mb-4">
            <input type="date" id="att-start" className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-blue-500" />
            <input type="date" id="att-end" className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <button
            onClick={() => {
              const start = document.getElementById('att-start')?.value
              const end = document.getElementById('att-end')?.value
              let path = '/reports/attendance?'
              if (start) path += `start_date=${start}&`
              if (end) path += `end_date=${end}`
              path = appendEmployeeParam(path.replace(/\?$/, '') || '/reports/attendance')
              handleExport(path, 'attendance_export.csv')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            <FileDown className="w-4 h-4" /> Export CSV
          </button>
        </div>

        <div className="group bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-xl hover:border-emerald-100 transition-all duration-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Leave Export</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">Export leave requests as Excel (.xlsx).</p>
          <div className="flex gap-2 mb-4">
            <input type="date" id="leave-start" className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-gray-900 text-sm" placeholder="Start date" />
            <input type="date" id="leave-end" className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-gray-900 text-sm" placeholder="End date" />
          </div>
          <div className="mb-4">
            <select id="leave-status" className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-emerald-500">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <button
            onClick={() => {
              const status = document.getElementById('leave-status')?.value
              const start = document.getElementById('leave-start')?.value
              const end = document.getElementById('leave-end')?.value
              let path = '/reports/leave'
              const params = []
              if (status) params.push(`status_filter=${status}`)
              if (start) params.push(`start_date=${start}`)
              if (end) params.push(`end_date=${end}`)
              if (params.length) path += `?${params.join('&')}`
              path = appendEmployeeParam(path)
              handleExport(path, 'leave_export.xlsx')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors"
          >
            <FileDown className="w-4 h-4" /> Export Excel
          </button>
        </div>

        <div className="group bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-xl hover:border-violet-100 transition-all duration-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-violet-50 rounded-xl group-hover:bg-violet-100 transition-colors">
              <DollarSign className="w-6 h-6 text-violet-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Payroll Export</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">Export payroll records as CSV.</p>
          <div className="mb-4">
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-violet-500">
              {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              let path = `/reports/payroll?year=${year}`
              path = appendEmployeeParam(path)
              handleExport(path, 'payroll_export.csv')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors"
          >
            <FileDown className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}

export default Reports
