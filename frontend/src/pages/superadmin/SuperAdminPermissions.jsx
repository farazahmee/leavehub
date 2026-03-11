import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { ShieldCheck } from 'lucide-react'

const SuperAdminPermissions = () => {
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['superadmin-permissions'],
    queryFn: async () => {
      const res = await api.get('/superadmin/permissions')
      return res.data?.data || []
    },
  })

  if (isLoading) return <div className="text-gray-600">Loading...</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5" />
        Platform Permissions
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        These permissions are available platform-wide. They are assigned to roles within each company.
      </p>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Codename</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {permissions.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">{p.codename}</code>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{p.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SuperAdminPermissions
