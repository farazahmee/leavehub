import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { isAdminUser } from '../utils/authHelpers'
import { Upload, Download, X } from 'lucide-react'

const Documents = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [companyPolicyModalOpen, setCompanyPolicyModalOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [employeeId, setEmployeeId] = useState('')
  const [description, setDescription] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)

  const { data: docsData } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await api.get('/documents')
      return res.data.data
    },
  })

  const { data: expiringData } = useQuery({
    queryKey: ['documents-expiring'],
    queryFn: async () => {
      const res = await api.get('/documents/expiring-soon?days=90')
      return res.data.data || []
    },
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-docs'],
    queryFn: async () => {
      const res = await api.get('/dashboard/card/employees')
      const list = res.data?.data
      return Array.isArray(list) ? list : []
    },
    enabled: adminModalOpen,
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file)
      if (description) fd.append('description', description)
      if (expiryDate) fd.append('expiry_date', expiryDate)
      const res = await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['documents'])
      queryClient.invalidateQueries(['documents-expiring'])
      setModalOpen(false)
      setFile(null)
      setDescription('')
      setExpiryDate('')
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Upload failed'),
  })

  const companyPolicyUploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('is_company_policy', 'true')
      if (description) fd.append('description', description)
      if (expiryDate) fd.append('expiry_date', expiryDate)
      const res = await api.post('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['documents'])
      queryClient.invalidateQueries(['documents-expiring'])
      setCompanyPolicyModalOpen(false)
      setFile(null)
      setDescription('')
      setExpiryDate('')
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Upload failed'),
  })

  const adminUploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file)
      if (description) fd.append('description', description)
      if (expiryDate) fd.append('expiry_date', expiryDate)
      const res = await api.post(`/documents/upload-for-employee?employee_id=${employeeId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['documents'])
      queryClient.invalidateQueries(['documents-expiring'])
      setAdminModalOpen(false)
      setFile(null)
      setEmployeeId('')
      setDescription('')
      setExpiryDate('')
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Upload failed'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!file) { setError('Please select a file'); return }
    uploadMutation.mutate()
  }

  const handleCompanyPolicySubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!file) { setError('Please select a file'); return }
    companyPolicyUploadMutation.mutate()
  }

  const handleAdminSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!file) { setError('Please select a file'); return }
    if (!employeeId) { setError('Please select an employee'); return }
    adminUploadMutation.mutate()
  }

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = doc.name || 'document'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.message || 'Download failed')
    }
  }

  const documents = docsData || []
  const expiringSoon = expiringData || []
  const employees = employeesData || []

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => { setCompanyPolicyModalOpen(true); setError(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                <Upload className="w-4 h-4" /> Upload Company Policy
              </button>
              <button
                onClick={() => { setAdminModalOpen(true); setError(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Upload className="w-4 h-4" /> Upload for Employee
              </button>
            </>
          )}
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Upload Document (Personal)</h2>
              <button onClick={() => { setModalOpen(false); setFile(null); setDescription(''); setExpiryDate(''); setError(''); }} className="text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">File</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Expiry date (optional)</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={!file || uploadMutation.isPending} className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Upload</button>
                <button type="button" onClick={() => { setModalOpen(false); setFile(null); setDescription(''); setExpiryDate(''); setError(''); }} className="py-2 px-4 border rounded-md hover:bg-gray-50 text-gray-900">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {companyPolicyModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Upload Company Policy (Visible to All Employees)</h2>
              <button onClick={() => { setCompanyPolicyModalOpen(false); setFile(null); setDescription(''); setExpiryDate(''); setError(''); }} className="text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCompanyPolicySubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">File *</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Expiry date (optional)</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={!file || companyPolicyUploadMutation.isPending} className="flex-1 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50">Upload</button>
                <button type="button" onClick={() => { setCompanyPolicyModalOpen(false); setFile(null); setDescription(''); setError(''); }} className="py-2 px-4 border rounded-md hover:bg-gray-50 text-gray-900">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Upload for Employee</h2>
              <button onClick={() => { setAdminModalOpen(false); setFile(null); setEmployeeId(''); setDescription(''); setExpiryDate(''); setError(''); }} className="text-gray-500"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Employee *</label>
                <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900">
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">File *</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Expiry date (optional)</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={!file || !employeeId || adminUploadMutation.isPending} className="flex-1 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">Upload</button>
                <button type="button" onClick={() => { setAdminModalOpen(false); setFile(null); setEmployeeId(''); setDescription(''); setError(''); }} className="py-2 px-4 border rounded-md hover:bg-gray-50 text-gray-900">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Expiry</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Uploaded</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-900">No documents yet</td></tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-6 py-4 font-medium text-gray-900">{doc.name}</td>
                  <td className="px-6 py-4 text-gray-900">{doc.is_company_policy ? 'Company Policy' : 'Personal'}</td>
                  <td className="px-6 py-4 text-gray-900">{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : '-'}</td>
                  <td className="px-6 py-4 text-gray-900">{doc.expiry_date || '-'}</td>
                  <td className="px-6 py-4 text-gray-900">{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleDownload(doc)} className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-sm">
                      <Download className="w-4 h-4" /> Download
                    </button>
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

export default Documents
