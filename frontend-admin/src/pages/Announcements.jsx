import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const Announcements = () => {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['ca-announcements'],
    queryFn: async () => {
      const res = await api.get('/announcements')
      return res.data.data || []
    },
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/announcements', payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-announcements'])
      setTitle('')
      setMessage('')
      setError('')
    },
    onError: (err) =>
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to create announcement',
      ),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.put(`/announcements/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries(['ca-announcements']),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required')
      return
    }
    createMutation.mutate({ title: title.trim(), message: message.trim() })
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Announcements</h1>

      <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Create announcement
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-2 bg-red-50 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Announcement title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Short announcement message"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Publishing...' : 'Publish announcement'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Active announcements
          </h2>
        </div>
        {isLoading ? (
          <div className="px-4 py-4 text-sm text-gray-700">
            Loading announcements...
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {announcements.map((a) => (
              <li key={a.id} className="px-4 py-3 flex justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {a.title}
                  </h3>
                  <p className="text-sm text-gray-700">{a.message}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {a.created_at
                      ? a.created_at.slice(0, 19).replace('T', ' ')
                      : ''}
                  </p>
                </div>
                <div className="flex items-start">
                  <button
                    type="button"
                    onClick={() =>
                      window.confirm('Deactivate this announcement?') &&
                      deactivateMutation.mutate(a.id)
                    }
                    className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Deactivate
                  </button>
                </div>
              </li>
            ))}
            {(!announcements || announcements.length === 0) && (
              <li className="px-4 py-4 text-center text-gray-500 text-sm">
                No active announcements
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Announcements

