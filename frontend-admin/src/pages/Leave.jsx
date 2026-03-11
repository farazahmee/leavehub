import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const Leave = () => {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectingId, setRejectingId] = useState(null)
  const queryClient = useQueryClient()

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['ca-leave-requests', statusFilter],
    queryFn: async () => {
      const params = {}
      if (statusFilter) params.status_filter = statusFilter
      const res = await api.get('/leave/requests', { params })
      return res.data.data || []
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id) => api.put(`/leave/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-leave-requests'])
      queryClient.invalidateQueries(['ca-dashboard-summary'])
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      api.put(`/leave/${id}/reject`, null, { params: { rejection_reason: reason } }),
    onSuccess: () => {
      setRejectingId(null)
      setRejectReason('')
      queryClient.invalidateQueries(['ca-leave-requests'])
      queryClient.invalidateQueries(['ca-dashboard-summary'])
    },
  })

  const startReject = (id) => {
    setRejectingId(id)
    setRejectReason('')
  }

  const submitReject = (e) => {
    e.preventDefault()
    if (!rejectingId || !rejectReason.trim()) return
    rejectMutation.mutate({ id: rejectingId, reason: rejectReason.trim() })
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Leave requests</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700">
          Status:{' '}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-1 px-2 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <div>Loading leave requests...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Employee
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Type
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Period
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Days
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Status
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">
                      {r.employee_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {r.employee_id_display}
                    </div>
                  </td>
                  <td className="px-4 py-2 capitalize">{r.leave_type}</td>
                  <td className="px-4 py-2">
                    {r.start_date} – {r.end_date}
                  </td>
                  <td className="px-4 py-2">{r.days}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        r.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : r.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => approveMutation.mutate(r.id)}
                          disabled={approveMutation.isPending}
                          className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => startReject(r.id)}
                          className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {(!requests || requests.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No leave requests
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {rejectingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-semibold mb-3">Reject leave request</h2>
            <form onSubmit={submitReject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(null)
                    setRejectReason('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
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

