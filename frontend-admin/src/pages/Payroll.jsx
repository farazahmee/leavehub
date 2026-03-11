import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const CURRENCIES = [
  { value: 'PKR', label: 'PKR (Pakistani Rupee)' },
  { value: 'USD', label: 'USD (US Dollar)' },
  { value: 'EUR', label: 'EUR (Euro)' },
  { value: 'CAD', label: 'CAD (Canadian Dollar)' },
  { value: 'AUD', label: 'AUD (Australian Dollar)' },
]

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
]

const Payroll = () => {
  const [employeeId, setEmployeeId] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadEmployeeId, setUploadEmployeeId] = useState('')
  const [uploadMonth, setUploadMonth] = useState('')
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear().toString())
  const [uploadCurrency, setUploadCurrency] = useState('PKR')
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)
  const queryClient = useQueryClient()

  const { data: payrolls = [], isLoading, refetch } = useQuery({
    queryKey: ['ca-payroll', employeeId, year, month],
    queryFn: async () => {
      const params = {}
      if (employeeId) params.employee_id = employeeId
      if (year) params.year = year
      if (month) params.month = month
      const res = await api.get('/payroll', { params })
      return res.data.data || []
    },
  })

  const { data: employees = [], refetch: refetchEmployees } = useQuery({
    queryKey: ['ca-employees-all'],
    queryFn: async () => {
      const res = await api.get('/employees', {
        params: { page: 1, page_size: 100 },
      })
      const payload = res.data?.data
      return Array.isArray(payload) ? payload : payload?.data || []
    },
    enabled: showUploadModal,
  })

  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      const res = await api.post('/payroll/upload', formData)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-payroll'])
      setShowUploadModal(false)
      setUploadEmployeeId('')
      setUploadMonth('')
      setUploadYear(new Date().getFullYear().toString())
      setUploadCurrency('PKR')
      setUploadError('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err) => {
      const d = err.response?.data?.detail
      const msg = err.response?.data?.message
      let text = msg || 'Upload failed'
      if (Array.isArray(d)) {
        text = d.map((e) => e.msg || `${e.loc?.join('.')}: ${e.msg}`).join('. ')
      } else if (typeof d === 'string') {
        text = d
      }
      setUploadError(text)
    },
  })

  const handleFilter = (e) => {
    e.preventDefault()
    refetch()
  }

  const handleDownload = (id) => {
    window.open(`/api/v1/payroll/${id}/download`, '_blank', 'noopener')
  }

  const handleUploadSubmit = (e) => {
    e.preventDefault()
    setUploadError('')
    const file = fileInputRef.current?.files?.[0]
    if (!uploadEmployeeId || !uploadMonth || !uploadYear || !uploadCurrency) {
      setUploadError('Please select employee, month, year and currency.')
      return
    }
    if (!file) {
      setUploadError('Please choose a PDF file.')
      return
    }
    const formData = new FormData()
    formData.append('employee_id', String(uploadEmployeeId))
    formData.append('month', String(uploadMonth))
    formData.append('year', String(uploadYear))
    formData.append('currency', String(uploadCurrency))
    formData.append('file', file)
    uploadMutation.mutate(formData)
  }

  const openUploadModal = () => {
    refetchEmployees()
    setShowUploadModal(true)
    setUploadError('')
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
        <button
          type="button"
          onClick={openUploadModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Upload payroll
        </button>
      </div>

      <form
        onSubmit={handleFilter}
        className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">Employee ID</label>
          <input
            type="text"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Month (1-12)</label>
          <input
            type="number"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            min={1}
            max={12}
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
              setYear('')
              setMonth('')
              refetch()
            }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-100"
          >
            Clear
          </button>
        </div>
      </form>

      {isLoading ? (
        <div>Loading payrolls...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Employee
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Month
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Basic
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Allowances
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Deductions
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Net
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payrolls.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">
                      {p.employee_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {p.employee_id}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {p.month}/{p.year}
                  </td>
                  <td className="px-4 py-2">{p.basic_salary}</td>
                  <td className="px-4 py-2">{p.allowances}</td>
                  <td className="px-4 py-2">{p.deductions}</td>
                  <td className="px-4 py-2 font-semibold">{p.net_salary}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(p.id)}
                      className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
              {(!payrolls || payrolls.length === 0) && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No payroll records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Upload payroll</h2>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadError('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {uploadError && (
                <div className="p-3 rounded bg-red-50 text-red-700 text-sm">
                  {uploadError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  value={uploadEmployeeId}
                  onChange={(e) => setUploadEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month *</label>
                  <select
                    value={uploadMonth}
                    onChange={(e) => setUploadMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select</option>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                  <input
                    type="number"
                    value={uploadYear}
                    onChange={(e) => setUploadYear(e.target.value)}
                    min={2000}
                    max={2100}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency *</label>
                <select
                  value={uploadCurrency}
                  onChange={(e) => setUploadCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF file (salary slip) *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Payroll

