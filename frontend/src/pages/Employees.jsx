import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { isAdminUser, canAddUser as canAddUserHelper } from '../utils/authHelpers'
import { X, Pencil, Trash2 } from 'lucide-react'

const Employees = () => {
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [teamId, setTeamId] = useState('')
  const [designation, setDesignation] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '', 'active', 'inactive'
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    company_name: '',
    designation: '',
    department: '',
    phone: '',
    date_of_joining: new Date().toISOString().slice(0, 10),
    probation_months: 0,
  })
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    designation: '',
    department: '',
    phone: '',
    team_id: null,
    date_of_joining: '',
    probation_months: 0,
  })
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)
  const canAddUser = canAddUserHelper(user)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, teamId, designation, statusFilter],
    queryFn: async () => {
      const params = { page, page_size: 20 }
      if (search) params.search = search
      if (teamId) params.team_id = teamId
      if (designation) params.designation = designation
      if (statusFilter) params.status = statusFilter
      const response = await api.get('/employees', { params })
      return response.data.data
    },
  })

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await api.get('/teams')
      return res.data.data
    },
  })
  const teams = teamsData || []

  const createUserMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/admin/users', payload)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['employees'])
      queryClient.invalidateQueries(['dashboard-summary'])
      setModalOpen(false)
      setFormData({ email: '', first_name: '', last_name: '', company_name: '', designation: '', department: '', phone: '', date_of_joining: new Date().toISOString().slice(0, 10), probation_months: 0 })
      setError('')
      setSuccessMsg(data?.message || 'User created')
      setTimeout(() => setSuccessMsg(''), 5000)
    },
    onError: (err) => {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to create user')
    },
  })

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.put(`/employees/${id}`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['employees'])
      queryClient.invalidateQueries(['dashboard-summary'])
      setEditModalOpen(false)
      setEditingEmployee(null)
    },
    onError: (err) => {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to update employee')
    },
  })

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/employees/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['employees'])
      queryClient.invalidateQueries(['dashboard-summary'])
    },
  })

  const openEdit = (employee) => {
    setEditingEmployee(employee)
    const doj = employee.date_of_joining ? String(employee.date_of_joining).slice(0, 10) : new Date().toISOString().slice(0, 10)
    setEditFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      designation: employee.designation || '',
      department: employee.department || '',
      phone: employee.phone || '',
      team_id: employee.team_id ?? null,
      date_of_joining: doj,
      probation_months: employee.probation_months ?? 0,
    })
    setError('')
    setEditModalOpen(true)
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    setError('')
    const payload = {
      ...editFormData,
      team_id: editFormData.team_id || null,
      date_of_joining: editFormData.date_of_joining || null,
      probation_months: parseInt(editFormData.probation_months, 10) || 0,
    }
    updateEmployeeMutation.mutate({ id: editingEmployee.id, payload })
  }

  const handleDelete = (employee) => {
    if (window.confirm(`Deactivate ${employee.first_name} ${employee.last_name}? They will no longer appear as active.`)) {
      deleteEmployeeMutation.mutate(employee.id)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!formData.email || !formData.first_name || !formData.last_name || !formData.company_name) {
      setError('Email, First name, Last name, and Company are required')
      return
    }
    createUserMutation.mutate({
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      company_name: formData.company_name,
      designation: formData.designation || null,
      department: formData.department || null,
      phone: formData.phone || null,
      date_of_joining: formData.date_of_joining || null,
      probation_months: parseInt(formData.probation_months, 10) || 0,
    })
  }

  if (isLoading) {
    return <div>Loading employees...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          {successMsg && <p className="mt-2 text-sm text-green-600">{successMsg}</p>}
        </div>
        {canAddUser && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add User
          </button>
        )}
      </div>

      {modalOpen && canAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Add New User</h2>
              <button onClick={() => { setModalOpen(false); setError(''); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Username and password will be generated and sent to the user&apos;s email.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="user@company.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Software Engineer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Engineering"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of joining *</label>
                <input
                  type="date"
                  required
                  value={formData.date_of_joining}
                  onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Probation period (months)</label>
                <select
                  value={formData.probation_months}
                  onChange={(e) => setFormData({ ...formData, probation_months: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>None</option>
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={9}>9 months</option>
                  <option value={12}>12 months</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Alert when probation is about to end</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create & Send Credentials'}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setError(''); }}
                  className="py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModalOpen && editingEmployee && canAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit Employee</h2>
              <button onClick={() => { setEditModalOpen(false); setEditingEmployee(null); setError(''); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.first_name}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.last_name}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={editFormData.designation}
                  onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={editFormData.department}
                  onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
                <select
                  value={editFormData.team_id ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, team_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of joining</label>
                <input
                  type="date"
                  value={editFormData.date_of_joining}
                  onChange={(e) => setEditFormData({ ...editFormData, date_of_joining: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Probation period (months)</label>
                <select
                  value={editFormData.probation_months}
                  onChange={(e) => setEditFormData({ ...editFormData, probation_months: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>None</option>
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={9}>9 months</option>
                  <option value={12}>12 months</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updateEmployeeMutation.isPending}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateEmployeeMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditModalOpen(false); setEditingEmployee(null); setError(''); }}
                  className="py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Filters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Search by name</label>
            <input
              type="text"
              placeholder="Name or ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Team</label>
            <select
              value={teamId}
              onChange={(e) => { setTeamId(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Designation</label>
            <input
              type="text"
              placeholder="e.g. Engineer..."
              value={designation}
              onChange={(e) => { setDesignation(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearch(''); setTeamId(''); setDesignation(''); setStatusFilter(''); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                Employee ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                Designation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                Status
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data?.data?.map((employee) => (
              <tr key={employee.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {employee.employee_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link to={`/employees/${employee.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                    {employee.first_name} {employee.last_name}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {employee.designation || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {employee.department || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      employee.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {employee.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => openEdit(employee)}
                      className="text-blue-600 hover:text-blue-900 mr-4 inline-flex items-center gap-1"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    {employee.is_active && canAddUser && (
                      <button
                        onClick={() => handleDelete(employee)}
                        className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Employees
