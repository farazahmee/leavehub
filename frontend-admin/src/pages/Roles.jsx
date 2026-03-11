import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useToastStore from '../store/toastStore'

const Roles = () => {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permission_ids: [],
  })
  const [assigningUser, setAssigningUser] = useState(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState([])

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['ca-roles'],
    queryFn: async () => {
      const res = await api.get('/roles')
      return res.data?.data || []
    },
  })

  const { data: allPermissions = [], isLoading: permsLoading } = useQuery({
    queryKey: ['ca-permissions'],
    queryFn: async () => {
      const res = await api.get('/roles/permissions')
      return res.data?.data || []
    },
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['ca-role-users'],
    queryFn: async () => {
      const res = await api.get('/roles/users')
      return res.data?.data || []
    },
  })

  const createRoleMutation = useMutation({
    mutationFn: (body) => api.post('/roles', body),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-roles'])
      setShowRoleForm(false)
      setEditingRole(null)
      setRoleForm({ name: '', description: '', permission_ids: [] })
      addToast('Role created', 'success')
    },
    onError: (err) =>
      addToast(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to create role',
        'error',
      ),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, body }) => api.put(`/roles/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-roles'])
      setShowRoleForm(false)
      setEditingRole(null)
      setRoleForm({ name: '', description: '', permission_ids: [] })
      addToast('Role updated', 'success')
    },
    onError: (err) =>
      addToast(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to update role',
        'error',
      ),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (id) => api.delete(`/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-roles'])
      addToast('Role deleted', 'success')
    },
    onError: (err) =>
      addToast(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to delete role',
        'error',
      ),
  })

  const assignRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }) =>
      api.put(`/roles/users/${userId}/roles`, { role_ids: roleIds }),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-role-users'])
      setAssigningUser(null)
      setSelectedRoleIds([])
      addToast('Roles updated', 'success')
    },
    onError: (err) =>
      addToast(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to update user roles',
        'error',
      ),
  })

  const deactivateUserMutation = useMutation({
    mutationFn: (employeeId) => api.delete(`/employees/${employeeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-role-users'])
      addToast('User deactivated', 'success')
    },
    onError: (err) =>
      addToast(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to deactivate',
        'error',
      ),
  })

  const resetRoleForm = () => {
    setEditingRole(null)
    setRoleForm({ name: '', description: '', permission_ids: [] })
    setShowRoleForm(false)
  }

  const startEditRole = (role) => {
    setEditingRole(role)
    setRoleForm({
      name: role.name,
      description: role.description || '',
      permission_ids: (role.permissions || []).map((p) => p.id),
    })
    setShowRoleForm(true)
  }

  const togglePermission = (permId) => {
    setRoleForm((prev) => {
      const exists = prev.permission_ids.includes(permId)
      return {
        ...prev,
        permission_ids: exists
          ? prev.permission_ids.filter((id) => id !== permId)
          : [...prev.permission_ids, permId],
      }
    })
  }

  const handleRoleSubmit = (e) => {
    e.preventDefault()
    if (!roleForm.name.trim()) {
      addToast('Role name is required', 'error')
      return
    }
    const body = {
      name: roleForm.name.trim(),
      description: roleForm.description.trim() || null,
      permission_ids: roleForm.permission_ids,
    }
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, body })
    } else {
      createRoleMutation.mutate(body)
    }
  }

  const startAssignRoles = (user) => {
    setAssigningUser(user)
    const currentIds = roles
      .filter((r) => (user.tenant_roles || []).includes(r.name))
      .map((r) => r.id)
    setSelectedRoleIds(currentIds)
  }

  const toggleSelectedRole = (roleId) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    )
  }

  const submitAssignRoles = (e) => {
    e.preventDefault()
    if (!assigningUser) return
    assignRolesMutation.mutate({
      userId: assigningUser.id,
      roleIds: selectedRoleIds,
    })
  }

  const isBusy =
    createRoleMutation.isPending ||
    updateRoleMutation.isPending ||
    deleteRoleMutation.isPending

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Roles & permissions</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Roles panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Roles ({roles.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingRole(null)
                setRoleForm({ name: '', description: '', permission_ids: [] })
                setShowRoleForm(true)
              }}
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Add role
            </button>
          </div>

          {(rolesLoading || permsLoading) && (
            <div className="text-sm text-gray-600 mb-3">
              Loading roles and permissions...
            </div>
          )}

          {showRoleForm && (
            <form onSubmit={handleRoleSubmit} className="mb-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Role name
                  </label>
                  <input
                    type="text"
                    value={roleForm.name}
                    onChange={(e) =>
                      setRoleForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. HR Manager"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={roleForm.description}
                    onChange={(e) =>
                      setRoleForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Short description"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Permissions
                </label>
                <div className="max-h-40 overflow-auto border border-gray-200 rounded-md p-2 space-y-1">
                  {allPermissions.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-xs text-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={roleForm.permission_ids.includes(p.id)}
                        onChange={() => togglePermission(p.id)}
                        className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                      />
                      <span>
                        <code className="px-1 py-0.5 bg-gray-100 rounded mr-1">
                          {p.codename}
                        </code>
                        {p.description}
                      </span>
                    </label>
                  ))}
                  {(!allPermissions || allPermissions.length === 0) && (
                    <p className="text-xs text-gray-500">
                      No permissions configured.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingRole ? 'Save changes' : 'Create role'}
                </button>
                <button
                  type="button"
                  onClick={resetRoleForm}
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {roles.map((r) => (
              <div
                key={r.id}
                className="py-3 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">
                      {r.name}
                    </span>
                    {r.is_system_default && (
                      <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-700 uppercase">
                        Default
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {r.description}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(r.permissions || []).map((p) => (
                      <span
                        key={p.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-800"
                      >
                        {p.codename}
                      </span>
                    ))}
                    {(!r.permissions || r.permissions.length === 0) && (
                      <span className="text-[11px] text-gray-400">
                        No permissions
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => startEditRole(r)}
                    className="px-2 py-1 text-[11px] rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  {!r.is_system_default && (
                    <button
                      type="button"
                      onClick={() =>
                        window.confirm('Delete this role?') &&
                        deleteRoleMutation.mutate(r.id)
                      }
                      className="px-2 py-1 text-[11px] rounded border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(!roles || roles.length === 0) && (
              <div className="py-4 text-sm text-gray-500 text-center">
                No roles defined for this company yet.
              </div>
            )}
          </div>
        </div>

        {/* Users panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Users & role assignments
          </h2>
          {usersLoading ? (
            <div className="text-sm text-gray-600">Loading users...</div>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg max-h-80 overflow-auto">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {(u.first_name && u.last_name) ? `${u.first_name} ${u.last_name}` : u.username}
                    </p>
                    <p className="text-xs text-gray-600">{u.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(u.tenant_roles || []).map((rName) => (
                        <span
                          key={rName}
                          className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-[10px] text-blue-800"
                        >
                          {rName}
                        </span>
                      ))}
                      {(!u.tenant_roles || u.tenant_roles.length === 0) && (
                        <span className="text-[11px] text-gray-400">
                          No roles
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => startAssignRoles(u)}
                      className="px-2 py-1 text-[11px] rounded border border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                    >
                      Manage roles
                    </button>
                    {u.employee_id != null && (
                      <>
                        <Link
                          to={`/employees/${u.employee_id}`}
                          className="px-2 py-1 text-[11px] rounded border border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            window.confirm('Deactivate this user? They will no longer be able to log in.') &&
                            deactivateUserMutation.mutate(u.employee_id)
                          }
                          disabled={deactivateUserMutation.isPending}
                          className="px-2 py-1 text-[11px] rounded border border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap"
                        >
                          Deactivate
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
              {(!users || users.length === 0) && (
                <li className="px-4 py-4 text-sm text-gray-500 text-center">
                  No users found for this company.
                </li>
              )}
            </ul>
          )}

          {assigningUser && (
            <form
              onSubmit={submitAssignRoles}
              className="mt-4 border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Assign roles to {assigningUser.username}
                  </p>
                  <p className="text-xs text-gray-600">{assigningUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAssigningUser(null)
                    setSelectedRoleIds([])
                  }}
                  className="px-2 py-1 text-[11px] rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              <div className="max-h-40 overflow-auto border border-gray-200 rounded-md p-2 space-y-1">
                {roles.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 text-xs text-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(r.id)}
                      onChange={() => toggleSelectedRole(r.id)}
                      className="h-3 w-3 text-blue-600 border-gray-300 rounded"
                    />
                    <span>{r.name}</span>
                  </label>
                ))}
                {(!roles || roles.length === 0) && (
                  <p className="text-xs text-gray-500">
                    No roles defined. Create a role first.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={assignRolesMutation.isPending}
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {assignRolesMutation.isPending ? 'Saving...' : 'Save roles'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default Roles

