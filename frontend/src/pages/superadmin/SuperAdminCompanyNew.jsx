import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import useToastStore from '../../store/toastStore'

const SuperAdminCompanyNew = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const [form, setForm] = useState({
    name: '',
    domain: '',
    admin_contact_email: '',
    admin_contact_name: '',
    admin_contact_phone: '',
    onboarding_date: '',
  })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/superadmin/companies', body),
    onSuccess: (res) => {
      const data = res.data?.data
      queryClient.invalidateQueries(['superadmin-companies'])
      queryClient.invalidateQueries(['superadmin-stats'])
      addToast?.('Company created successfully', 'success')
      navigate(data?.id ? `/superadmin/companies/${data.id}` : '/superadmin/companies')
    },
    onError: (err) => {
      const d = err.response?.data?.detail
      const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x?.msg ?? x).join(', ') : d ? JSON.stringify(d) : err.message || 'Failed to create company'
      setError(msg)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Company name is required')
      return
    }
    const body = { ...form }
    if (body.onboarding_date === '') delete body.onboarding_date
    if (body.admin_contact_phone === '') delete body.admin_contact_phone
    if (body.domain === '') delete body.domain
    createMutation.mutate(body)
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Company</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email domain for employees</label>
          <input
            type="text"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. timesquarellc.com (or leave empty to use admin email domain)"
          />
          <p className="text-xs text-gray-500 mt-0.5">Employee emails must end with @this domain</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Admin contact email</label>
          <input
            type="email"
            value={form.admin_contact_email}
            onChange={(e) => setForm({ ...form, admin_contact_email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="admin@acme.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Admin contact name</label>
          <input
            type="text"
            value={form.admin_contact_name}
            onChange={(e) => setForm({ ...form, admin_contact_name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Admin contact phone</label>
          <input
            type="tel"
            value={form.admin_contact_phone}
            onChange={(e) => setForm({ ...form, admin_contact_phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="+1 234 567 8900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Onboarding / start date</label>
          <input
            type="date"
            value={form.onboarding_date}
            onChange={(e) => setForm({ ...form, onboarding_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Company'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/superadmin/companies')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default SuperAdminCompanyNew
