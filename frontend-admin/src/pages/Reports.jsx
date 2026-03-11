import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

const Reports = () => {
  const [downloading, setDownloading] = useState(null)

  const { data: employees = [] } = useQuery({
    queryKey: ['reports-employees'],
    queryFn: async () => {
      const res = await api.get('/employees', { params: { page: 1, page_size: 100 } })
      const payload = res.data?.data
      return Array.isArray(payload) ? payload : payload?.data || []
    },
  })

  // Attendance card filters
  const [attEmployeeId, setAttEmployeeId] = useState('')
  const [attStartDate, setAttStartDate] = useState('')
  const [attEndDate, setAttEndDate] = useState('')

  // Leave card filters
  const [leaveEmployeeId, setLeaveEmployeeId] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState('')
  const [leaveEndDate, setLeaveEndDate] = useState('')

  // Payroll card filters
  const [payrollEmployeeId, setPayrollEmployeeId] = useState('')
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear())
  const [payrollMonth, setPayrollMonth] = useState('')

  const downloadFile = async (url, params, filename, key) => {
    setDownloading(key)
    try {
      const res = await api.get(url, { params, responseType: 'blob' })
      const blob = new Blob([res.data])
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(link.href)
    } catch (err) {
      console.error(err)
    } finally {
      setDownloading(null)
    }
  }

  const downloadAttendance = () => {
    const params = {}
    if (attEmployeeId) params.employee_id = Number(attEmployeeId)
    if (attStartDate) params.start_date = attStartDate
    if (attEndDate) params.end_date = attEndDate
    downloadFile('reports/attendance', params, 'attendance_export.csv', 'attendance')
  }

  const downloadLeave = () => {
    const params = {}
    if (leaveEmployeeId) params.employee_id = Number(leaveEmployeeId)
    if (leaveStartDate) params.start_date = leaveStartDate
    if (leaveEndDate) params.end_date = leaveEndDate
    downloadFile('reports/leave', params, 'leave_export.xlsx', 'leave')
  }

  const downloadPayroll = () => {
    const params = {}
    if (payrollEmployeeId) params.employee_id = Number(payrollEmployeeId)
    if (payrollYear) params.year = payrollYear
    if (payrollMonth) params.month = payrollMonth
    downloadFile('reports/payroll', params, 'payroll_export.csv', 'payroll')
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500'
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Reports</h1>
      <p className="text-sm text-gray-700 mb-6">
        Export CSV / Excel reports for attendance, leave, and payroll.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Attendance report card */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Attendance report
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Exports attendance records to CSV.
          </p>
          <div className="space-y-3 mb-4">
            <div>
              <label className={labelClass}>Select employee</label>
              <select
                value={attEmployeeId}
                onChange={(e) => setAttEmployeeId(e.target.value)}
                className={inputClass}
              >
                <option value="">All employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Start date</label>
              <input
                type="date"
                value={attStartDate}
                onChange={(e) => setAttStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>End date</label>
              <input
                type="date"
                value={attEndDate}
                onChange={(e) => setAttEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={downloadAttendance}
            disabled={downloading === 'attendance'}
            className="mt-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {downloading === 'attendance' ? 'Downloading…' : 'Download CSV'}
          </button>
        </div>

        {/* Leave report card */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Leave report
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Exports leave requests to Excel.
          </p>
          <div className="space-y-3 mb-4">
            <div>
              <label className={labelClass}>Select employee</label>
              <select
                value={leaveEmployeeId}
                onChange={(e) => setLeaveEmployeeId(e.target.value)}
                className={inputClass}
              >
                <option value="">All employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Start date</label>
              <input
                type="date"
                value={leaveStartDate}
                onChange={(e) => setLeaveStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>End date</label>
              <input
                type="date"
                value={leaveEndDate}
                onChange={(e) => setLeaveEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={downloadLeave}
            disabled={downloading === 'leave'}
            className="mt-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {downloading === 'leave' ? 'Downloading…' : 'Download XLSX'}
          </button>
        </div>

        {/* Payroll report card */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Payroll report
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            Exports payroll data to CSV.
          </p>
          <div className="space-y-3 mb-4">
            <div>
              <label className={labelClass}>Select employee</label>
              <select
                value={payrollEmployeeId}
                onChange={(e) => setPayrollEmployeeId(e.target.value)}
                className={inputClass}
              >
                <option value="">All employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Year</label>
              <input
                type="number"
                min={2000}
                max={2100}
                value={payrollYear}
                onChange={(e) => setPayrollYear(Number(e.target.value) || new Date().getFullYear())}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Month</label>
              <select
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className={inputClass}
              >
                <option value="">All months</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadPayroll}
            disabled={downloading === 'payroll'}
            className="mt-auto px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {downloading === 'payroll' ? 'Downloading…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Reports
