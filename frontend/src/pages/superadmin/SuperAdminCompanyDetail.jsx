import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import useToastStore from '../../store/toastStore'
import {
  ArrowLeft, Users, Shield, ToggleLeft, ToggleRight,
  Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight,
} from 'lucide-react'

const SuperAdminCompanyDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const [adminForm, setAdminForm] = useState({ email: '', username: '', first_name: '', last_name: '' })
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [showRoleForm, setShowRoleForm] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permission_ids: [] })
  const [expandedRole, setExpandedRole] = useState(null)
  const [assigningUser, setAssigningUser] = useState(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState([])
  const [createAdminError, setCreateAdminError] = useState(null)
  const [editingDomain, setEditingDomain] = useState(false)
  const [domainValue, setDomainValue] = useState('')

  const { data: company, isLoading } = useQuery({
    queryKey: ['superadmin-company', id],
    queryFn: async () => {
      const res = await api.get(`/superadmin/companies/${id}`)
      return res.data?.data
    },
    enabled: !!id,
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['superadmin-company-roles', id],
    queryFn: async () => {
      const res = await api.get(`/superadmin/companies/${id}/roles`)
      return res.data?.data || []
    },
    enabled: !!id,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['superadmin-company-users', id],
    queryFn: async () => {
      const res = await api.get(`/superadmin/companies/${id}/users`)
      return res.data?.data || []
    },
    enabled: !!id,
  })

  const { data: allPermissions = [] } = useQuery({
    queryKey: ['superadmin-permissions'],
    queryFn: async () => {
      const res = await api.get('/superadmin/permissions')
      return res.data?.data || []
    },
  })

  const patchMutation = useMutation({
    mutationFn: ({ is_active }) =>
      api.patch(`/superadmin/companies/${id}`, null, { params: { is_active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-company', id] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      addToast?.('Company updated', 'success')
    },
  })

  const putMutation = useMutation({
    mutationFn: (body) => api.put(`/superadmin/companies/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-company', id] })
      setEditingDomain(false)
      addToast?.('Company updated', 'success')
    },
    onError: (err) => addToast?.(err.response?.data?.detail || 'Update failed', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/superadmin/companies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      addToast?.('Company deleted', 'success')
      navigate('/superadmin/companies')
    },
    onError: (err) => {
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((e) => e?.msg || e).join(', ') : detail ? JSON.stringify(detail) : err.message || 'Failed to delete company'
      addToast?.(msg, 'error')
    },
  })

  const [setPasswordUrl, setSetPasswordUrl] = useState(null)

  const createAdminMutation = useMutation({
    mutationFn: (body) => api.post(`/superadmin/companies/${id}/admin`, body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-company-users', id] })
      setAdminForm({ email: '', username: '', first_name: '', last_name: '' })
      setShowAdminForm(false)
      setCreateAdminError(null)
      const data = res?.data?.data
      if (data?.set_password_url && !data?.email_sent) {
        setSetPasswordUrl(data.set_password_url)
      }
      addToast?.(res?.data?.message || 'Company admin created', 'success')
    },
    onError: (err) => {
      const d = err.response?.data?.detail
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x?.msg ?? x).join(', ') : d ? JSON.stringify(d) : err.message || 'Failed to create admin'
      addToast?.(msg, 'error')
      if (typeof msg === 'string' && msg.toLowerCase().includes('email already exists')) {
        setCreateAdminError('email_exists')
      }
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => api.delete(`/superadmin/companies/${id}/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-company-users', id] })
      addToast?.('User removed. You can create a new admin with that email.', 'success')
    },
    onError: (err) => {
      const d = err.response?.data?.detail
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x?.msg ?? x).join(', ') : d ? JSON.stringify(d) : err.message || 'Failed to remove user'
      addToast?.(msg, 'error')
    },
  })

  const deleteUserByEmailMutation = useMutation({
    mutationFn: (email) => api.delete('/superadmin/users/by-email', { params: { email } }),
    onSuccess: () => {
      setCreateAdminError(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-company-users', id] })
      addToast?.('User removed. You can create the admin now.', 'success')
    },
    onError: (err) => {
      const d = err.response?.data?.detail
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x?.msg ?? x).join(', ') : d ? JSON.stringify(d) : err.message || 'Failed to remove user'
      addToast?.(msg, 'error')
    },
  })

  const createRoleMutation = useMutation({
    mutationFn: (body) => api.post(`/superadmin/companies/${id}/roles`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-company-roles', id] })
      resetRoleForm()
      addToast?.('Role created', 'success')
    },
    onError: (err) => addToast?.(err.response?.data?.detail || 'Failed to create role', 'error'),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, body }) => api.put(`/superadmin/companies/${id}/roles/${roleId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-company-roles', id] })
      resetRoleForm()
      addToast?.('Role updated', 'success')
    },
    onError: (err) => addToast?.(err.response?.data?.detail || 'Failed to update role', 'error'),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId) => api.delete(`/superadmin/companies/${id}/roles/${roleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-company-roles', id] })
      addToast?.('Role deleted', 'success')
    },
    onError: (err) => addToast?.(err.response?.data?.detail || 'Failed to delete role', 'error'),
  })

  const assignRolesMutation = useMutation({
    mutationFn: ({ userId, role_ids }) =>
      api.put(`/superadmin/companies/${id}/users/${userId}/roles`, { role_ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-company-users', id] })
      setAssigningUser(null)
      addToast?.('User roles updated', 'success')
    },
    onError: (err) => addToast?.(err.response?.data?.detail || 'Failed to assign roles', 'error'),
  })

  const resetRoleForm = () => {
    setShowRoleForm(false)
    setEditingRole(null)
    setRoleForm({ name: '', description: '', permission_ids: [] })
  }

  const startEditRole = (role) => {
    setEditingRole(role.id)
    setRoleForm({
      name: role.name,
      description: role.description || '',
      permission_ids: role.permissions?.map((p) => p.id) || [],
    })
    setShowRoleForm(true)
  }

  const startAssignRoles = (user) => {
    setAssigningUser(user)
    const userRoleIds = roles.filter((r) => user.tenant_roles?.includes(r.name)).map((r) => r.id)
    setSelectedRoleIds(userRoleIds)
  }

  const togglePermission = (pid) => {
    setRoleForm((prev) => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(pid)
        ? prev.permission_ids.filter((x) => x !== pid)
        : [...prev.permission_ids, pid],
    }))
  }

  const toggleSelectedRole = (rid) => {
    setSelectedRoleIds((prev) =>
      prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]
    )
  }

  const handleRoleSubmit = (e) => {
    e.preventDefault()
    if (!roleForm.name.trim()) return addToast?.('Role name required', 'error')
    const body = { name: roleForm.name, description: roleForm.description, permission_ids: roleForm.permission_ids }
    if (editingRole) {
      updateRoleMutation.mutate({ roleId: editingRole, body })
    } else {
      createRoleMutation.mutate(body)
    }
  }

  const handleCreateAdmin = (e) => {
    e.preventDefault()
    if (!adminForm.email || !adminForm.first_name || !adminForm.last_name) {
      return addToast?.('Email, first name and last name are required', 'error')
    }
    const body = {
      email: adminForm.email.trim(),
      first_name: adminForm.first_name.trim(),
      last_name: adminForm.last_name.trim(),
    }
    if (adminForm.username?.trim()) body.username = adminForm.username.trim()
    createAdminMutation.mutate(body)
  }

  if (isLoading || !company) return <div className="text-gray-600">Loading...</div>

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/superadmin/companies')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{company.name}</h2>
          <p className="text-gray-600">
            Slug: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">{company.slug}</code>
            {' '}&middot; {company.is_active ? 'Active' : 'Inactive'}
            {company.domain && (
              <> &middot; Email domain: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">@{company.domain}</code></>
            )}
            {(company.onboarding_date || company.created_at) && (
              <> &middot; Joined: <span className="text-gray-700">{new Date(company.onboarding_date || company.created_at).toLocaleDateString()}</span></>
            )}
          </p>
          {!company.domain && (
            <p className="text-amber-600 text-sm mt-1">
              No email domain set. <button type="button" onClick={() => { setEditingDomain(true); setDomainValue('') }} className="underline">Set domain</button> so employee emails validate correctly.
            </p>
          )}
          {editingDomain && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={domainValue}
                onChange={(e) => setDomainValue(e.target.value)}
                placeholder="e.g. timesquarellc.com"
                className="px-2 py-1 border rounded text-sm w-48"
              />
              <button
                type="button"
                onClick={() => putMutation.mutate({ domain: domainValue.trim() || null })}
                disabled={putMutation.isPending}
                className="px-2 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              >
                Save
              </button>
              <button type="button" onClick={() => { setEditingDomain(false); setDomainValue(company.domain || '') }} className="px-2 py-1 border rounded text-sm">Cancel</button>
            </div>
          )}
          {company.domain && !editingDomain && (
            <button type="button" onClick={() => { setEditingDomain(true); setDomainValue(company.domain) }} className="text-xs text-blue-600 hover:underline mt-1">Edit domain</button>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <a
              href={`http://${company.slug}.localhost:5174`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Employee portal: {company.slug}.localhost:5174
            </a>
            <a
              href={`http://${company.slug}.localhost:5176`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Admin portal: {company.slug}.localhost:5176
            </a>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => patchMutation.mutate({ is_active: !company.is_active })}
            disabled={patchMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            {company.is_active
              ? <ToggleRight className="w-5 h-5 text-green-600" />
              : <ToggleLeft className="w-5 h-5 text-gray-400" />}
            {company.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() =>
              window.confirm(
                `Permanently delete "${company.name}"? All company data (users, employees, teams, leave, documents, etc.) will be removed. This cannot be undone.`
              ) && deleteMutation.mutate()
            }
            disabled={deleteMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-5 h-5" /> Delete company
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Roles & Permissions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Roles ({roles.length})
            </h3>
            <button
              onClick={() => { resetRoleForm(); setShowRoleForm(true) }}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add role
            </button>
          </div>

          {showRoleForm && (
            <form onSubmit={handleRoleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <h4 className="text-sm font-medium">{editingRole ? 'Edit Role' : 'New Role'}</h4>
              <input
                type="text"
                placeholder="Role name"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm"
                required
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm"
              />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Permissions</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {allPermissions.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={roleForm.permission_ids.includes(p.id)}
                        onChange={() => togglePermission(p.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="truncate">{p.codename.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                >
                  {editingRole ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={resetRoleForm} className="px-3 py-1.5 border rounded text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <ul className="space-y-1">
            {roles.map((r) => (
              <li key={r.id} className="border border-gray-100 rounded-lg">
                <div
                  className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedRole(expandedRole === r.id ? null : r.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedRole === r.id ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="font-medium text-sm">{r.name}</span>
                    {r.is_system_default && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">{r.permissions?.length ?? 0} perms</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditRole(r) }}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Edit role"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    {!r.is_system_default && (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete role "${r.name}"?`)) deleteRoleMutation.mutate(r.id) }}
                        className="p-1 hover:bg-red-100 rounded"
                        title="Delete role"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}
                  </div>
                </div>
                {expandedRole === r.id && (
                  <div className="px-4 pb-3">
                    {r.description && <p className="text-xs text-gray-500 mb-2">{r.description}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {(r.permissions || []).map((p) => (
                        <span key={p.id} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                          {p.codename.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {(!r.permissions || r.permissions.length === 0) && (
                        <span className="text-xs text-gray-400 italic">No permissions</span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Users */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Users ({users.length})
          </h3>
          {users.length === 0 ? (
            <p className="text-gray-500 text-sm">No users yet.</p>
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                  <div>
                    <span className="font-medium">{u.email}</span>
                    <div className="flex gap-1 mt-0.5">
                      {(u.tenant_roles || []).map((rn) => (
                        <span key={rn} className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{rn}</span>
                      ))}
                      {(!u.tenant_roles || u.tenant_roles.length === 0) && (
                        <span className="text-[10px] text-gray-400">{u.role || 'No roles'}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startAssignRoles(u)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Manage roles
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${u.email}? Their email can be used again for a new admin.`)) {
                          deleteUserMutation.mutate(u.id)
                        }
                      }}
                      disabled={deleteUserMutation.isPending}
                      className="p-1 hover:bg-red-50 rounded text-red-600 disabled:opacity-50"
                      title="Remove user"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Role assignment modal */}
          {assigningUser && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-3">
              <h4 className="text-sm font-medium">Assign roles to {assigningUser.email}</h4>
              <div className="space-y-1.5">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(r.id)}
                      onChange={() => toggleSelectedRole(r.id)}
                      className="rounded border-gray-300"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => assignRolesMutation.mutate({ userId: assigningUser.id, role_ids: selectedRoleIds })}
                  disabled={assignRolesMutation.isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={() => setAssigningUser(null)}
                  className="px-3 py-1.5 border rounded text-sm flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowAdminForm(!showAdminForm)}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            {showAdminForm ? 'Cancel' : '+ Create company admin'}
          </button>
          {showAdminForm && (
            <form onSubmit={handleCreateAdmin} className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
              {createAdminError === 'email_exists' && adminForm.email && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex flex-wrap items-center gap-2">
                  <span>This email is already in use.</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remove the user with this email so you can create a new admin?`)) {
                        deleteUserByEmailMutation.mutate(adminForm.email)
                      }
                    }}
                    disabled={deleteUserByEmailMutation.isPending}
                    className="px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
                  >
                    {deleteUserByEmailMutation.isPending ? 'Removing...' : 'Remove this email'}
                  </button>
                </div>
              )}
              <input
                type="email"
                placeholder="Email"
                value={adminForm.email}
                onChange={(e) => { setAdminForm({ ...adminForm, email: e.target.value }); setCreateAdminError(null) }}
                className="w-full px-3 py-2 border rounded text-sm"
                required
              />
              <input
                type="text"
                placeholder="Username (optional)"
                value={adminForm.username}
                onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="First name"
                  value={adminForm.first_name}
                  onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={adminForm.last_name}
                  onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={createAdminMutation.isPending}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
              >
                {createAdminMutation.isPending ? 'Creating...' : 'Create admin'}
              </button>
            </form>
          )}

          {setPasswordUrl && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800 mb-1">Set-password link (email may not have been sent):</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={setPasswordUrl}
                  className="flex-1 px-2 py-1.5 text-xs bg-white border rounded font-mono"
                  onClick={(e) => e.target.select()}
                />
                <button
                  onClick={() => { navigator.clipboard.writeText(setPasswordUrl); addToast?.('Link copied', 'success') }}
                  className="px-2 py-1.5 bg-amber-600 text-white rounded text-xs whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-amber-600 mt-1">Send this link to the admin so they can set their password.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SuperAdminCompanyDetail
