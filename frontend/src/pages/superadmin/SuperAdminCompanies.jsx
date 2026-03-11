import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import useToastStore from '../../store/toastStore'
import { Plus, Building2, Pencil, Activity, Users, FileText, Calendar, ToggleLeft, ToggleRight } from 'lucide-react'

const SuperAdminCompanies = () => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const { data: stats = {} } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const res = await api.get('/superadmin/stats')
      return res.data?.data || {}
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-companies', page, search],
    queryFn: async () => {
      const params = { page, page_size: 10 }
      if (search) params.search = search
      const res = await api.get('/superadmin/companies', { params })
      return res.data?.data || {}
    },
  })

  const patchMutation = useMutation({
    mutationFn: ({ companyId, is_active }) =>
      api.patch(`/superadmin/companies/${companyId}`, null, { params: { is_active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      addToast?.('Tenant updated', 'success')
    },
    onError: (err) => addToast?.(err.response?.data?.detail || 'Failed to update tenant', 'error'),
  })

  const list = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.total_pages ?? 0

  const cards = [
    { label: 'Total Companies', value: stats.companies_total ?? 0, icon: Building2, color: 'bg-blue-500' },
    { label: 'Active Companies', value: stats.companies_active ?? 0, icon: Activity, color: 'bg-green-500' },
    { label: 'Deactive Companies', value: stats.companies_inactive ?? 0, icon: Users, color: 'bg-gray-500' },
    { label: 'Pending Invoices', value: stats.pending_invoices ?? 0, icon: FileText, color: 'bg-amber-500' },
    { label: 'Coming Invoices (7 days)', value: stats.coming_invoices ?? 0, icon: Calendar, color: 'bg-indigo-500' },
  ]

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3"
            >
              <div className={`p-2.5 rounded-lg ${card.color} text-white`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <Link
          to="/superadmin/companies/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No companies yet. Create one to get started.</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{c.slug}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {(c.onboarding_date || c.created_at) ? new Date(c.onboarding_date || c.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => patchMutation.mutate({ companyId: c.id, is_active: !c.is_active })}
                          disabled={patchMutation.isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title={c.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {c.is_active ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-gray-500" />}
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <Link
                          to={`/superadmin/companies/${c.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
                        >
                          <Pencil className="w-4 h-4" />
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">Page {page} of {totalPages} ({total} total)</p>
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

export default SuperAdminCompanies
