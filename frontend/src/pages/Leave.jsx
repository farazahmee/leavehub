import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { isAdminUser } from '../utils/authHelpers'
import useToastStore from '../store/toastStore'
import { Calendar, Check, X, Plus, UserCog } from 'lucide-react'

const Leave = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [quotaModalOpen, setQuotaModalOpen] = useState(false)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [formData, setFormData] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
  const [quotaForm, setQuotaForm] = useState({ employee_id: '', annual_leave: 15, sick_leave: 6, casual_leave: 5 })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)

  const { data: balanceData } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: async () => {
      const res = await api.get('/leave/balance')
      return res.data.data
    },
  })

  const { data: myRequests } = useQuery({
    queryKey: ['leave-my-requests'],
    queryFn: async () => {
      const res = await api.get('/leave/my-requests')
      return res.data.data
    },
  })

  const { data: allRequests } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => {
      const res = await api.get('/leave/requests')
      return res.data.data
    },
    enabled: isAdmin,
  })

  const { data: employeesList = [] } = useQuery({
    queryKey: ['employees-list-leave'],
    queryFn: async () => {
      const res = await api.get('/employees', { params: { page: 1, page_size: 500 } })
      const d = res.data?.data
      return Array.isArray(d) ? d : d?.data || []
    },
    enabled: isAdmin && quotaModalOpen,
  })

  const setQuotaMutation = useMutation({
    mutationFn: ({ employee_id, payload }) => api.put(`/leave/balance/${employee_id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['leave-balance'])
      queryClient.invalidateQueries(['leave-requests'])
      queryClient.invalidateQueries(['dashboard-summary'])
      setQuotaModalOpen(false)
      setQuotaForm({ employee_id: '', annual_leave: 15, sick_leave: 6, casual_leave: 5 })
      addToast('Leave quota updated')
    },
    onError: (err) => addToast(err.response?.data?.detail || 'Failed to set quota', 'error'),
  })

  const addToast = useToastStore((s) => s.addToast)
  const applyMutation = useMutation({
    mutationFn: (payload) => api.post('/leave/apply', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['leave-balance'])
      queryClient.invalidateQueries(['leave-my-requests'])
      queryClient.invalidateQueries(['pending-leaves-count'])
      setModalOpen(false)
      setFormData({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
      setError('')
      addToast('Leave application submitted')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to apply'
      setError(msg)
      addToast(msg, 'error')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id) => api.put(`/leave/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries(['leave-requests'])
      queryClient.invalidateQueries(['leave-my-requests'])
      queryClient.invalidateQueries(['dashboard-summary'])
      queryClient.invalidateQueries(['pending-leaves-count'])
      addToast('Leave approved')
    },
    onError: (err) => addToast(err.response?.data?.detail || 'Failed to approve', 'error'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/leave/${id}/reject`, null, { params: { rejection_reason: reason } }),
    onSuccess: () => {
      queryClient.invalidateQueries(['leave-requests'])
      queryClient.invalidateQueries(['leave-my-requests'])
      queryClient.invalidateQueries(['dashboard-summary'])
      queryClient.invalidateQueries(['pending-leaves-count'])
      setRejectModal(null)
      setRejectReason('')
      addToast('Leave rejected')
    },
    onError: (err) => addToast(err.response?.data?.detail || 'Failed to reject', 'error'),
  })

  const handleApply = (e) => {
    e.preventDefault()
    setError('')
    if (!formData.start_date || !formData.end_date) {
      setError('Start and end dates are required')
      return
    }
    applyMutation.mutate(formData)
  }

  const balance = balanceData || {}
  const available = {
    annual: (balance.annual_leave || 0) - (balance.used_annual || 0),
    sick: (balance.sick_leave || 0) - (balance.used_sick || 0),
    casual: (balance.casual_leave || 0) - (balance.used_casual || 0),
  }
  const requests = isAdmin ? (allRequests || []) : (myRequests || [])

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Leave Management</h1>

      {/* Leave balance cards - only for employees (admin sees balance in Employee Profile) */}
      {!isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600">Annual Leave</p>
            <p className="text-2xl font-bold text-gray-900">{available.annual} days</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600">Sick Leave</p>
            <p className="text-2xl font-bold text-gray-900">{available.sick} days</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <p className="text-sm text-gray-600">Casual Leave</p>
            <p className="text-2xl font-bold text-gray-900">{available.casual} days</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{isAdmin ? 'All Leave Requests' : 'My Leave Requests'}</h2>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => setQuotaModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
            >
              <UserCog className="w-4 h-4" /> Set employee leave quota
            </button>
          )}
          {!isAdmin && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Apply for Leave
            </button>
          )}
        </div>
      </div>

      {quotaModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold mb-4">Set employee leave quota</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  value={quotaForm.employee_id}
                  onChange={(e) => setQuotaForm({ ...quotaForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select employee</option>
                  {employeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Annual leave (days)</label>
                <input type="number" min={0} value={quotaForm.annual_leave} onChange={(e) => setQuotaForm({ ...quotaForm, annual_leave: parseInt(e.target.value, 10) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sick leave (days)</label>
                <input type="number" min={0} value={quotaForm.sick_leave} onChange={(e) => setQuotaForm({ ...quotaForm, sick_leave: parseInt(e.target.value, 10) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Casual leave (days)</label>
                <input type="number" min={0} value={quotaForm.casual_leave} onChange={(e) => setQuotaForm({ ...quotaForm, casual_leave: parseInt(e.target.value, 10) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setQuotaMutation.mutate({ employee_id: quotaForm.employee_id, payload: { annual_leave: quotaForm.annual_leave, sick_leave: quotaForm.sick_leave, casual_leave: quotaForm.casual_leave } })} disabled={!quotaForm.employee_id || setQuotaMutation.isPending} className="flex-1 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 disabled:opacity-50">Save</button>
                <button type="button" onClick={() => { setQuotaModalOpen(false); setQuotaForm({ employee_id: '', annual_leave: 15, sick_leave: 6, casual_leave: 5 }); }} className="py-2 px-4 border rounded-md hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold mb-4">Apply for Leave</h2>
            <form onSubmit={handleApply} className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select value={formData.leave_type} onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="annual">Annual</option>
                  <option value="sick">Sick</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" required value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={applyMutation.isPending} className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Apply</button>
                <button type="button" onClick={() => setModalOpen(false)} className="py-2 px-4 border rounded-md hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold mb-4">Reject Leave Request</h2>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason for rejection</label>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} required
              className="w-full px-3 py-2 border rounded-md mb-4" placeholder="Provide a reason..." />
            <div className="flex gap-3">
              <button onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })} disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">Reject</button>
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="py-2 px-4 border rounded-md hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Employee</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Start</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">End</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Days</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Status</th>
              {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requests.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 5} className="px-6 py-8 text-center text-gray-900">No leave requests</td></tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  {isAdmin && <td className="px-6 py-4 text-gray-900">{r.employee_name || '-'}</td>}
                  <td className="px-6 py-4 text-gray-900 capitalize">{r.leave_type}</td>
                  <td className="px-6 py-4 text-gray-900">{r.start_date}</td>
                  <td className="px-6 py-4 text-gray-900">{r.end_date}</td>
                  <td className="px-6 py-4 text-gray-900">{r.days || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      r.status === 'approved' ? 'bg-green-100 text-green-800' :
                      r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>{r.status}</span>
                  </td>
                  {isAdmin && r.status === 'pending' && (
                    <td className="px-6 py-4">
                      <button onClick={() => approveMutation.mutate(r.id)} className="text-green-600 hover:text-green-800 mr-3">
                        <Check className="w-4 h-4 inline" /> Approve
                      </button>
                      <button onClick={() => setRejectModal(r)} className="text-red-600 hover:text-red-800">
                        <X className="w-4 h-4 inline" /> Reject
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Leave
