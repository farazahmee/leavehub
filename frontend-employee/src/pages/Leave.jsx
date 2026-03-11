import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { Calendar, Plus, X } from 'lucide-react'

const Leave = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const { data: balance = {} } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: async () => {
      const res = await api.get('/leave/balance')
      return res.data.data
    },
  })

  const { data: myRequests = [] } = useQuery({
    queryKey: ['leave-my-requests'],
    queryFn: async () => {
      const res = await api.get('/leave/my-requests')
      return res.data.data
    },
  })

  const applyMutation = useMutation({
    mutationFn: (payload) => api.post('/leave/apply', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['leave-balance'])
      queryClient.invalidateQueries(['leave-my-requests'])
      setModalOpen(false)
      setFormData({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Failed to apply'),
  })

  const handleApply = (e) => {
    e.preventDefault()
    setError('')
    if (!formData.start_date || !formData.end_date) {
      setError('Start and end dates are required')
      return
    }
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      setError('End date must be after start date')
      return
    }
    applyMutation.mutate({
      leave_type: formData.leave_type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason: formData.reason || undefined,
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Leave Requests</h1>
        <button
          onClick={() => { setModalOpen(true); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Apply Leave
        </button>
      </div>

      <div className="grid gap-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900">Leave Balance</h2>
        <div className="flex gap-4 flex-wrap">
          <div className="bg-white rounded-xl shadow p-6 border border-slate-100 flex-1 min-w-[140px]">
            <p className="text-sm text-gray-500">Annual</p>
            <p className="text-2xl font-bold text-indigo-600">{balance.annual ?? 0} days</p>
            {balance.annual_leave != null && (
              <p className="text-xs text-gray-400 mt-1">{balance.annual ?? 0} of {balance.annual_leave} remaining</p>
            )}
          </div>
          <div className="bg-white rounded-xl shadow p-6 border border-slate-100 flex-1 min-w-[140px]">
            <p className="text-sm text-gray-500">Sick</p>
            <p className="text-2xl font-bold text-emerald-600">{balance.sick ?? 0} days</p>
            {balance.sick_leave != null && (
              <p className="text-xs text-gray-400 mt-1">{balance.sick ?? 0} of {balance.sick_leave} remaining</p>
            )}
          </div>
          <div className="bg-white rounded-xl shadow p-6 border border-slate-100 flex-1 min-w-[140px]">
            <p className="text-sm text-gray-500">Casual</p>
            <p className="text-2xl font-bold text-amber-600">{balance.casual ?? 0} days</p>
            {balance.casual_leave != null && (
              <p className="text-xs text-gray-400 mt-1">{balance.casual ?? 0} of {balance.casual_leave} remaining</p>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">My Requests</h2>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {myRequests.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No leave requests yet</td></tr>
            ) : (
              myRequests.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 capitalize text-gray-900">{r.leave_type}</td>
                  <td className="px-6 py-4 text-gray-900">{r.start_date}</td>
                  <td className="px-6 py-4 text-gray-900">{r.end_date}</td>
                  <td className="px-6 py-4 text-gray-900">{r.days}</td>
                  <td>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                      r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Apply Leave</h2>
              <button onClick={() => { setModalOpen(false); setError(''); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleApply} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                >
                  <option value="annual">Annual</option>
                  <option value="sick">Sick</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={applyMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {applyMutation.isPending ? 'Submitting...' : 'Submit'}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setError(''); }}
                  className="py-2 px-4 border border-gray-300 rounded-xl hover:bg-gray-50"
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

export default Leave
