import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

const Attendance = () => {
  const [employeeId, setEmployeeId] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ca-attendance', employeeId, startDate, endDate],
    queryFn: async () => {
      const params = {}
      if (employeeId) params.employee_id = employeeId
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const res = await api.get('/attendance/all', { params })
      return res.data.data || []
    },
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['ca-attendance-employees'],
    queryFn: async () => {
      const res = await api.get('/employees', { params: { page: 1, page_size: 200 } })
      const payload = res.data?.data
      return Array.isArray(payload) ? payload : payload?.data || []
    },
  })

  const filteredEmployees = employees.filter((emp) => {
    const q = employeeSearch.trim().toLowerCase()
    if (!q) return true
    const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase()
    const code = (emp.employee_id || '').toLowerCase()
    return name.includes(q) || code.includes(q)
  })

  const handleFilter = (e) => {
    e.preventDefault()
    refetch()
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Attendance</h1>
      <form
        onSubmit={handleFilter}
        className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Employee</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All employees</option>
            {filteredEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name} ({emp.employee_id})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            placeholder="Search by name or ID"
            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setEmployeeId('')
              setStartDate('')
              setEndDate('')
              refetch()
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-100"
          >
            Clear
          </button>
        </div>
      </form>

      {isLoading ? (
        <div>Loading attendance...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Employee ID
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Employee
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Date
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Check In
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Check Out
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Total Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.employee_id}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.employee_name}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.date}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.check_in_time
                      ? new Date(row.check_in_time).toLocaleTimeString()
                      : '-'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.check_out_time
                      ? new Date(row.check_out_time).toLocaleTimeString()
                      : 'Active'}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-700">
                    {row.total_time_display ?? '—'}
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No attendance records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Attendance

