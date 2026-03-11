import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { User, Mail, Phone, Calendar, Briefcase, MapPin, CreditCard, Pencil, X } from 'lucide-react'

const PersonalInfo = () => {
  const [editOpen, setEditOpen] = useState(false)
  const [formData, setFormData] = useState({
    phone: '',
    address: '',
    cnic: '',
    personal_email: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['employee-me'],
    queryFn: async () => {
      const res = await api.get('/employees/me')
      return res.data.data
    },
  })

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await api.get('/teams')
      return res.data.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put('/employees/me', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['employee-me'])
      setEditOpen(false)
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Update failed'),
  })

  const openEdit = () => {
    setFormData({
      phone: profile.phone || '',
      address: profile.address || '',
      cnic: profile.cnic || '',
      personal_email: profile.personal_email || '',
      emergency_contact_name: profile.emergency_contact_name || '',
      emergency_contact_phone: profile.emergency_contact_phone || '',
    })
    setError('')
    setEditOpen(true)
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    setError('')
    updateMutation.mutate(formData)
  }

  const team = profile?.team_id ? teams.find((t) => t.id === profile.team_id) : null

  const profileFields = [
    profile?.phone,
    profile?.address,
    profile?.cnic,
    profile?.personal_email,
    profile?.emergency_contact_name,
    profile?.emergency_contact_phone,
  ]
  const filledCount = profileFields.filter((v) => v != null && String(v).trim() !== '').length
  const completeness = Math.round((filledCount / 6) * 100)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-gray-500">Profile not found</div>
    )
  }

  const fields = [
    { label: 'Employee ID', value: profile.employee_id, icon: User },
    { label: 'Name', value: `${profile.first_name} ${profile.last_name}`, icon: User },
    { label: 'Designation', value: profile.designation, icon: Briefcase },
    { label: 'Department', value: profile.department, icon: Briefcase },
    { label: 'Team', value: team?.name, icon: Briefcase },
    { label: 'Date of Joining', value: profile.date_of_joining, icon: Calendar },
    { label: 'Date of Birth', value: profile.date_of_birth, icon: Calendar },
    { label: 'Phone', value: profile.phone, icon: Phone },
    { label: 'Address', value: profile.address, icon: MapPin },
    { label: 'National CNIC', value: profile.cnic, icon: CreditCard },
    { label: 'Personal Email', value: profile.personal_email, icon: Mail },
    { label: 'Emergency Contact', value: profile.emergency_contact_name ? `${profile.emergency_contact_name} (${profile.emergency_contact_phone})` : null, icon: Phone },
  ].filter((f) => f.value != null && f.value !== '')

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Personal Information</h1>
        <button
          onClick={openEdit}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
        >
          <Pencil className="w-4 h-4" /> Edit My Info
        </button>
      </div>
      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Profile completeness</span>
          <span className="text-sm font-semibold text-indigo-600">{completeness}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all"
            style={{ width: `${completeness}%` }}
          />
        </div>
        {completeness < 100 && (
          <p className="mt-1 text-xs text-gray-500">Add phone, address, emergency contact and more to complete your profile.</p>
        )}
      </div>

      {editOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Edit Personal Info</h2>
              <button onClick={() => { setEditOpen(false); setError(''); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">National CNIC</label>
                <input
                  type="text"
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="e.g. 12345-1234567-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
                <input
                  type="email"
                  value={formData.personal_email}
                  onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                  placeholder="personal@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditOpen(false); setError(''); }}
                  className="py-2 px-4 border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="text-indigo-100">{profile.designation || profile.employee_id}</p>
            </div>
          </div>
        </div>
        <div className="p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {fields.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.label} className="flex gap-4 p-4 rounded-xl bg-slate-50">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 h-fit">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{f.label}</p>
                    <p className="font-medium text-gray-900">{f.value}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PersonalInfo
