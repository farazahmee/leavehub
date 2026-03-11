import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Search, Filter, CheckCircle2, XCircle } from 'lucide-react'
import api from '../../services/api'
import useToastStore from '../../store/toastStore'

const SuperAdminInvoices = () => {
  const [page, setPage] = useState(1)
  const [tenantName, setTenantName] = useState('')
  const [status, setStatus] = useState('all')
  const [tenantActive, setTenantActive] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const addToast = useToastStore((s) => s.addToast)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-invoices', page, tenantName, status, tenantActive, startDate, endDate],
    queryFn: async () => {
      const params = { page, page_size: 20 }
      if (tenantName) params.tenant_name = tenantName
      if (status !== 'all') params.status = status
      if (tenantActive === 'active') params.tenant_active = true
      if (tenantActive === 'inactive') params.tenant_active = false
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const res = await api.get('/superadmin/invoices', { params })
      return res.data?.data || {}
    },
  })

  const list = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 0

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId) => api.patch(`/superadmin/invoices/${invoiceId}`, null, { params: { status: 'paid' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      addToast?.('Invoice marked as paid', 'success')
    },
    onError: (err) => addToast?.(err.response?.data?.detail || 'Failed to update invoice', 'error'),
  })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by tenant name..."
              value={tenantName}
              onChange={(e) => { setTenantName(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="all">All invoices</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
            <select
              value={tenantActive}
              onChange={(e) => { setTenantActive(e.target.value); setPage(1) }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
            >
              <option value="all">All tenants</option>
              <option value="active">Active tenants</option>
              <option value="inactive">Deactive tenants</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No invoices found.</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {list.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{inv.company_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{inv.company_slug}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                          inv.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {inv.status === 'paid' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          inv.company_is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {inv.company_is_active ? 'Active' : 'Deactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {inv.status === 'unpaid' && (
                        <button
                          onClick={() => markPaidMutation.mutate(inv.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SuperAdminInvoices

