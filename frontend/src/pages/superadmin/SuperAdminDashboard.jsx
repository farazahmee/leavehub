import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { Building2, Activity, Users, FileText, Calendar } from 'lucide-react'

const SuperAdminDashboard = () => {
  const {
    data: stats = {},
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const res = await api.get('/superadmin/stats')
      return res.data?.data || {}
    },
    retry: 1,
  })

  if (isLoading) {
    return <div className="text-gray-600">Loading...</div>
  }

  if (isError) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 max-w-xl">
        <p className="font-semibold text-red-800 mb-1">Unable to load super admin dashboard.</p>
        <p className="text-sm text-red-700">
          {error?.response?.data?.detail || error?.message || 'Something went wrong while fetching stats.'}
        </p>
      </div>
    )
  }

  const cards = [
    { label: 'Total Companies', value: stats.companies_total ?? 0, icon: Building2, color: 'bg-blue-500' },
    { label: 'Active Companies', value: stats.companies_active ?? 0, icon: Activity, color: 'bg-green-500' },
    { label: 'Deactive Companies', value: stats.companies_inactive ?? 0, icon: Users, color: 'bg-gray-500' },
    { label: 'Pending Invoices', value: stats.pending_invoices ?? 0, icon: FileText, color: 'bg-amber-500' },
    { label: 'Coming Invoices (7 days)', value: stats.coming_invoices ?? 0, icon: Calendar, color: 'bg-indigo-500' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4"
          >
            <div className={`p-3 rounded-lg ${card.color} text-white`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default SuperAdminDashboard
