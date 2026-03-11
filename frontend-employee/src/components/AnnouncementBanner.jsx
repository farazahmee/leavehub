import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { X, Megaphone } from 'lucide-react'

const DISMISSED_KEY = 'workforcehub-emp-announcements-dismissed'

const AnnouncementBanner = () => {
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const s = localStorage.getItem(DISMISSED_KEY)
      return s ? JSON.parse(s) : []
    } catch {
      return []
    }
  })

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await api.get('/announcements')
      return res.data?.data || []
    },
  })

  const visible = announcements.filter((a) => !dismissedIds.includes(a.id))
  if (visible.length === 0) return null

  const handleDismiss = (id) => {
    const next = [...dismissedIds, id]
    setDismissedIds(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  }

  return (
    <div className="mb-6 space-y-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start justify-between gap-4"
        >
          <div className="flex gap-3 min-w-0">
            <Megaphone className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-indigo-900">{a.title}</p>
              <p className="text-sm text-indigo-800 mt-0.5 whitespace-pre-wrap">{a.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(a.id)}
            className="text-indigo-600 hover:text-indigo-800 shrink-0 p-1"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export default AnnouncementBanner
