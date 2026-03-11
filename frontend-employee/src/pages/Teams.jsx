import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { UserCog, Users, ChevronDown, ChevronUp } from 'lucide-react'

const Teams = () => {
  const [expandedTeamId, setExpandedTeamId] = useState(null)

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await api.get('/teams')
      return res.data.data
    },
  })

  const { data: membersMap = {}, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', expandedTeamId],
    queryFn: async () => {
      const res = await api.get(`/teams/${expandedTeamId}/members`)
      return { [expandedTeamId]: res.data.data || [] }
    },
    enabled: !!expandedTeamId,
  })

  const members = expandedTeamId ? (membersMap[expandedTeamId] || []) : []

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Teams</h1>

      <div className="grid gap-4">
        {teams.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">No teams yet</div>
        ) : (
          teams.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden"
            >
              <button
                onClick={() => setExpandedTeamId(expandedTeamId === t.id ? null : t.id)}
                className="w-full p-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-violet-100 text-violet-600">
                    <UserCog className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                  </div>
                </div>
                <span className="text-gray-400">
                  {expandedTeamId === t.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </span>
              </button>
              {expandedTeamId === t.id && (
                <div className="border-t border-slate-100 px-6 py-4 bg-slate-50">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Team Members
                  </h4>
                  {membersLoading ? (
                    <p className="text-gray-500 text-sm">Loading...</p>
                  ) : members.length === 0 ? (
                    <p className="text-gray-500 text-sm">No members assigned to this team yet.</p>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                          <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase">Designation</th>
                          <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {members.map((m) => (
                          <tr key={m.id}>
                            <td className="py-3 text-sm text-gray-900">{m.employee_id}</td>
                            <td className="py-3 font-medium text-gray-900">{m.first_name} {m.last_name}</td>
                            <td className="py-3 text-sm text-gray-600">{m.designation || '-'}</td>
                            <td className="py-3 text-sm text-gray-600">{m.department || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Teams
