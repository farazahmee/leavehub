import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useToastStore from '../store/toastStore'
import { Plus, X, Megaphone } from 'lucide-react'

const Announcements = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements-all'],
    queryFn: async () => {
      const res = await api.get('/announcements')
      return res.data?.data || []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/announcements', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements'])
      queryClient.invalidateQueries(['announcements-all'])
      setModalOpen(false)
      setTitle('')
      setMessage('')
      setError('')
      addToast('Announcement created. All employees will see it.')
    },
    onError: (err) => {
      setError(err.response?.data?.detail || 'Failed to create')
      addToast(err.response?.data?.detail || 'Failed', 'error')
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (id) => {
      await api.put(`/announcements/${id}/deactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['announcements'])
      queryClient.invalidateQueries(['announcements-all'])
      addToast('Announcement deactivated')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!title?.trim()) {
      setError('Title is required')
      return
    }
    if (!message?.trim()) {
      setError('Message is required')
      return
    }
    createMutation.mutate({ title: title.trim(), message: message.trim() })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
        <button
          onClick={() => { setModalOpen(true); setError(''); setTitle(''); setMessage(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Add Announcement
        </button>
      </div>

      <p className="text-gray-600 mb-6">
        Announcements are visible to all employees in the employee portal. Add news, policy updates, or important notices.
      </p>

      {announcements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center border border-gray-200">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No announcements yet.</p>
          <p className="text-sm text-gray-500 mt-1">Click &quot;Add Announcement&quot; to create one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{a.title}</h3>
                  <p className="text-gray-600 mt-1 whitespace-pre-wrap">{a.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Deactivate this announcement? Employees will no longer see it.')) {
                      deactivateMutation.mutate(a.id)
                    }
                  }}
                  disabled={deactivateMutation.isPending}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Add Announcement</h2>
              <button onClick={() => { setModalOpen(false); setError(''); }} className="text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder="e.g. Holiday schedule update"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Message *</label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                  placeholder="Enter your announcement..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Announcement'}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setError(''); }}
                  className="py-2 px-4 border rounded-md hover:bg-gray-50 text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Announcements
