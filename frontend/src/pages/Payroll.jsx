import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { isAdminUser } from '../utils/authHelpers'
import { CURRENCIES } from '../constants/currencies'
import useToastStore from '../store/toastStore'
import { Plus, Upload, Download, X } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const Payroll = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    employee_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    basic_salary: '',
    allowances: '',
    deductions: '',
  })
  const [uploadData, setUploadData] = useState({
    employee_id: '',
    currency: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    file: null,
  })
  const [error, setError] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)

  const netSalary = useMemo(() => {
    const b = parseFloat(formData.basic_salary) || 0
    const a = parseFloat(formData.allowances) || 0
    const d = parseFloat(formData.deductions) || 0
    return b + a - d
  }, [formData.basic_salary, formData.allowances, formData.deductions])

  const { data: payrollsData } = useQuery({
    queryKey: ['payrolls', yearFilter, employeeFilter],
    queryFn: async () => {
      const params = {}
      if (yearFilter) params.year = parseInt(yearFilter, 10)
      if (employeeFilter) params.employee_id = parseInt(employeeFilter, 10)
      const res = await api.get('/payroll', { params })
      return res.data.data
    },
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-payroll'],
    queryFn: async () => {
      const res = await api.get('/dashboard/card/employees')
      const list = res.data?.data
      return Array.isArray(list) ? list : []
    },
    enabled: isAdmin,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/payroll', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['payrolls'])
      setCreateModalOpen(false)
      setFormData({ employee_id: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), basic_salary: '', allowances: '', deductions: '' })
      setError('')
      useToastStore.getState().addToast('Salary slip created')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to create'
      setError(msg)
      useToastStore.getState().addToast(msg, 'error')
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (data) => {
      const fd = new FormData()
      fd.append('file', data.file)
      fd.append('currency', data.currency)
      const res = await api.post(
        `/payroll/upload?employee_id=${data.employee_id}&month=${data.month}&year=${data.year}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payrolls'])
      setUploadModalOpen(false)
      setUploadData({ employee_id: '', currency: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), file: null })
      setError('')
      useToastStore.getState().addToast('Salary slip uploaded')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Upload failed'
      setError(msg)
      useToastStore.getState().addToast(msg, 'error')
    },
  })

  const handleCreate = (e) => {
    e.preventDefault()
    setError('')
    const empId = parseInt(formData.employee_id, 10)
    if (!empId) { setError('Select employee'); return }
    if (!formData.basic_salary || parseFloat(formData.basic_salary) < 0) { setError('Enter basic salary'); return }
    createMutation.mutate({
      employee_id: empId,
      month: formData.month,
      year: formData.year,
      basic_salary: parseFloat(formData.basic_salary) || 0,
      allowances: parseFloat(formData.allowances) || 0,
      deductions: parseFloat(formData.deductions) || 0,
    })
  }

  const handleUpload = (e) => {
    e.preventDefault()
    setError('')
    if (!uploadData.currency) { setError('Please select currency'); return }
    if (!uploadData.file) { setError('Select file'); return }
    if (!uploadData.employee_id) { setError('Select employee'); return }
    uploadMutation.mutate(uploadData)
  }

  const handleDownload = async (p) => {
    try {
      const res = await api.get(`/payroll/${p.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `salary_slip_${p.month}_${p.year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (_) {
      setError('Download failed - file may not exist')
    }
  }

  const payrolls = payrollsData || []
  const employees = employeesData || []

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setCreateModalOpen(true); setError(''); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4" /> Create Salary Slip
            </button>
            <button onClick={() => { setUploadModalOpen(true); setError(''); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Upload className="w-4 h-4" /> Upload Salary Slip
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex gap-4 mb-6">
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-gray-900">
            <option value="">All years</option>
            {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-gray-900">
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
            ))}
          </select>
        </div>
      )}

      {createModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Create Salary Slip</h2>
              <button onClick={() => { setCreateModalOpen(false); setError(''); }} className="text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Employee *</label>
                <select required value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                  <option value="">Select</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Month</label>
                  <select value={formData.month} onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Year</label>
                  <input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Basic Salary *</label>
                <input type="number" step="0.01" required value={formData.basic_salary} onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Allowances</label>
                <input type="number" step="0.01" value={formData.allowances} onChange={(e) => setFormData({ ...formData, allowances: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Deductions</label>
                <input type="number" step="0.01" value={formData.deductions} onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" placeholder="0" />
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <strong className="text-gray-900">Net Salary: {netSalary.toFixed(2)}</strong>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={createMutation.isPending} className="flex-1 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">Create</button>
                <button type="button" onClick={() => setCreateModalOpen(false)} className="py-2 px-4 border rounded-md hover:bg-gray-50 text-gray-900">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {uploadModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Upload Salary Slip (PDF)</h2>
              <button onClick={() => { setUploadModalOpen(false); setError(''); }} className="text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Employee *</label>
                <select required value={uploadData.employee_id} onChange={(e) => setUploadData({ ...uploadData, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                  <option value="">Select</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Currency *</label>
                <select required value={uploadData.currency} onChange={(e) => setUploadData({ ...uploadData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                  <option value="">Select currency</option>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Month</label>
                  <select value={uploadData.month} onChange={(e) => setUploadData({ ...uploadData, month: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                    {MONTHS.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Year</label>
                  <input type="number" value={uploadData.year} onChange={(e) => setUploadData({ ...uploadData, year: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">PDF File *</label>
                <input type="file" accept=".pdf" required onChange={(e) => setUploadData({ ...uploadData, file: e.target.files?.[0] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={!uploadData.currency || !uploadData.file || uploadMutation.isPending} className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Upload</button>
                <button type="button" onClick={() => setUploadModalOpen(false)} className="py-2 px-4 border rounded-md hover:bg-gray-50 text-gray-900">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Employee</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Month / Year</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Basic</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Allowances</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Deductions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Net</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payrolls.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 6} className="px-6 py-8 text-center text-gray-900">No payroll records yet</td></tr>
            ) : (
              payrolls.map((p) => (
                <tr key={p.id}>
                  {isAdmin && <td className="px-6 py-4 text-gray-900">{p.employee_name || '-'}</td>}
                  <td className="px-6 py-4 font-medium text-gray-900">{MONTHS[(p.month || 1) - 1]}/{p.year}</td>
                  <td className="px-6 py-4 text-gray-900">{p.basic_salary != null ? Number(p.basic_salary).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 text-gray-900">{p.allowances != null ? Number(p.allowances).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 text-gray-900">{p.deductions != null ? Number(p.deductions).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{p.net_salary != null ? Number(p.net_salary).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4">
                    {p.file_path && (
                      <button onClick={() => handleDownload(p)} className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-sm">
                        <Download className="w-4 h-4" /> Download
                      </button>
                    )}
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

export default Payroll
