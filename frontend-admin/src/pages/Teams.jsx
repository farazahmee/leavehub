import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { X, Plus, Pencil, Trash2, Users as UsersIcon } from 'lucide-react'

const Teams = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [membersModalOpen, setMembersModalOpen] = useState(false)
  const [viewMembersModalOpen, setViewMembersModalOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [editingTeam, setEditingTeam] = useState(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const { data: teamsData, isLoading } = useQuery({
    queryKey: ['ca-teams'],
    queryFn: async () => {
      const res = await api.get('/teams')
      return res.data.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/teams', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-teams'])
      setModalOpen(false)
      setFormData({ name: '', description: '' })
      setError('')
    },
    onError: (err) =>
      setError(err.response?.data?.detail || 'Failed to create team'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/teams/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-teams'])
      setEditingTeam(null)
      setFormData({ name: '', description: '' })
      setError('')
    },
    onError: (err) =>
      setError(err.response?.data?.detail || 'Failed to update team'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/teams/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['ca-teams']),
  })

  const updateEmployeeTeamMutation = useMutation({
    mutationFn: async ({ employeeId, teamId }) => {
      await api.put(`/employees/${employeeId}`, { team_id: teamId ?? null })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-teams'])
      queryClient.invalidateQueries(['ca-employees'])
      queryClient.invalidateQueries(['ca-employees-all'])
    },
  })

  const { data: allEmployees } = useQuery({
    queryKey: ['ca-employees-all'],
    queryFn: async () => {
      const res = await api.get('/employees', {
        params: { page: 1, page_size: 100 },
      })
      const payload = res.data?.data
      return Array.isArray(payload) ? payload : payload?.data || []
    },
    enabled: membersModalOpen,
  })

  const openMembersModal = (team) => {
    setSelectedTeam(team)
    setMembersModalOpen(true)
  }

  const openViewMembersModal = (team) => {
    setSelectedTeam(team)
    setViewMembersModalOpen(true)
  }

  const closeViewMembersModal = () => {
    setViewMembersModalOpen(false)
    setSelectedTeam(null)
  }

  const assignToTeam = (employee, teamId) => {
    updateEmployeeTeamMutation.mutate({
      employeeId: employee.id,
      teamId: teamId || null,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!formData.name?.trim()) {
      setError('Team name is required')
      return
    }
    if (editingTeam) {
      updateMutation.mutate({ id: editingTeam.id, payload: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const openEdit = (team) => {
    setEditingTeam(team)
    setFormData({ name: team.name, description: team.description || '' })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingTeam(null)
    setFormData({ name: '', description: '' })
    setError('')
  }

  const closeMembersModal = () => {
    setMembersModalOpen(false)
    setSelectedTeam(null)
  }

  if (isLoading) return <div>Loading teams...</div>

  const teams = teamsData || []

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['ca-team-members', selectedTeam?.id],
    queryFn: async () => {
      const res = await api.get(`/teams/${selectedTeam.id}/members`)
      return res.data.data || []
    },
    enabled: viewMembersModalOpen && !!selectedTeam,
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
        <button
          onClick={() => {
            closeModal()
            setModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Team
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingTeam ? 'Edit Team' : 'Add Team'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingTeam ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMembersModalOpen && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Members of {selectedTeam.name}
              </h2>
              <button
                onClick={closeViewMembersModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-auto flex-1">
              {!teamMembers?.length ? (
                <p className="text-gray-600">No members in this team.</p>
              ) : (
                <ul className="space-y-2">
                  {teamMembers.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {m.first_name} {m.last_name}
                      </span>
                      {m.designation && (
                        <span className="text-sm text-gray-600">
                          {m.designation}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {membersModalOpen && selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Add employees to {selectedTeam.name}
              </h2>
              <button
                onClick={closeMembersModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-auto flex-1 text-gray-900">
              <p className="text-sm text-gray-700 mb-4">
                Select an employee to assign them to this team.
              </p>
              {!allEmployees?.length ? (
                <p className="text-gray-900">No employees found.</p>
              ) : (
                <ul className="space-y-2">
                  {allEmployees.map((emp) => {
                    const isInTeam = emp.team_id === selectedTeam.id
                    return (
                      <li
                        key={emp.id}
                        className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                      >
                        <span className="text-sm text-gray-900">
                          {emp.first_name} {emp.last_name}
                          {emp.designation && (
                            <span className="text-gray-600 ml-2">
                              ({emp.designation})
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            assignToTeam(emp, isInTeam ? null : selectedTeam.id)
                          }
                          disabled={updateEmployeeTeamMutation.isPending}
                          className={`text-sm px-3 py-1 rounded ${
                            isInTeam
                              ? 'bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-800'
                              : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-800'
                          }`}
                        >
                          {isInTeam ? 'Remove' : 'Add to team'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {teams.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-8 text-center text-gray-900"
                >
                  No teams yet
                </td>
              </tr>
            ) : (
              teams.map((team) => (
                <tr key={team.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {team.name}
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {team.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openMembersModal(team)}
                      className="text-indigo-600 hover:text-indigo-800 mr-4 inline-flex items-center gap-1"
                      title="Add employees"
                    >
                      <UsersIcon className="w-4 h-4" /> Members
                    </button>
                    <button
                      onClick={() => openEdit(team)}
                      className="text-blue-600 hover:text-blue-800 mr-4"
                    >
                      <Pencil className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() =>
                        window.confirm('Delete this team?') &&
                        deleteMutation.mutate(team.id)
                      }
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4 inline" />
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

export default Teams

