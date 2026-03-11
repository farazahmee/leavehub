import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const Letters = () => {
  const [showRequests, setShowRequests] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [letterType, setLetterType] = useState('experience')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [hasPdf, setHasPdf] = useState(false)
  const [formError, setFormError] = useState('')
  const [createFromRequestId, setCreateFromRequestId] = useState(null)
  const fileInputRef = useRef(null)
  const queryClient = useQueryClient()

  const { data: letters = [], isLoading: lettersLoading } = useQuery({
    queryKey: ['ca-letters'],
    queryFn: async () => {
      const res = await api.get('/letters')
      return res.data.data || []
    },
  })

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['ca-letter-requests'],
    queryFn: async () => {
      const res = await api.get('/letters/requests')
      return res.data.data || []
    },
  })

  const { data: employees = [], refetch: refetchEmployees } = useQuery({
    queryKey: ['ca-employees-all'],
    queryFn: async () => {
      const res = await api.get('/employees', {
        params: { page: 1, page_size: 100 },
      })
      const payload = res.data?.data
      return Array.isArray(payload) ? payload : payload?.data || []
    },
    enabled: showCreateModal,
  })

  const extractMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/letters/extract-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
    onSuccess: (data) => {
      if (data?.content) setContent(data.content)
      if (data?.letter_type) setLetterType(data.letter_type)
      if (data?.title) setTitle(data.title)
      setFormError('')
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Could not read PDF. Please try a different file.',
      )
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_id: Number(selectedEmployeeId),
        letter_type: letterType,
        title: title || `${letterType.charAt(0).toUpperCase()}${letterType.slice(1)} letter`,
        content,
      }
      const res = await api.post('/letters/generate', payload)
      return res.data
    },
    onSuccess: async () => {
      queryClient.invalidateQueries(['ca-letters'])
      const requestId = createFromRequestId
      setShowCreateModal(false)
      setSelectedEmployeeId('')
      setLetterType('experience')
      setTitle('')
      setContent('')
      setFormError('')
      setCreateFromRequestId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (requestId) {
        try {
          await api.put(`/letters/requests/${requestId}/complete`)
          queryClient.invalidateQueries(['ca-letter-requests'])
        } catch (_) {}
      }
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          'Failed to generate letter',
      )
    },
  })

  const acceptResignationMutation = useMutation({
    mutationFn: async (requestId) => {
      const res = await api.put(`/letters/requests/${requestId}/accept`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-letter-requests'])
      queryClient.invalidateQueries(['ca-letters'])
    },
  })

  const rejectResignationMutation = useMutation({
    mutationFn: async (requestId) => {
      const res = await api.put(`/letters/requests/${requestId}/reject`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-letter-requests'])
    },
  })

  const openCreateFromRequest = (r) => {
    setCreateFromRequestId(r.id)
    setSelectedEmployeeId(String(r.employee_id))
    setLetterType(r.letter_type || 'experience')
    setTitle('')
    setContent(r.content || '')
    setFormError('')
    refetchEmployees()
    setShowCreateModal(true)
  }

  const handlePdfChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setHasPdf(false)
      return
    }
    setHasPdf(true)
    setFormError('')
    extractMutation.mutate(file)
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (!selectedEmployeeId) {
      setFormError('Please select an employee.')
      return
    }
    if (!content.trim()) {
      setFormError('Letter content is required. Upload a PDF or type the content.')
      return
    }
    generateMutation.mutate()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Letters</h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowRequests((v) => !v)}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
          >
            {showRequests ? 'Hide' : 'Show'} pending requests
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateFromRequestId(null)
              refetchEmployees()
              setShowCreateModal(true)
              setFormError('')
            }}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Create letter
          </button>
        </div>
      </div>

      {showRequests && (
        <div className="mb-6 bg-white rounded-lg shadow border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending requests
            </h2>
          </div>
          {requestsLoading ? (
            <div className="px-4 py-4 text-sm text-gray-700">
              Loading requests...
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                    Employee
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                    Requested at
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      {r.employee_name || r.employee_id}
                    </td>
                    <td className="px-4 py-2 capitalize">{r.letter_type}</td>
                    <td className="px-4 py-2 capitalize">{r.status}</td>
                    <td className="px-4 py-2">
                      {r.created_at ? r.created_at.slice(0, 19).replace('T', ' ') : ''}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.status === 'pending' && r.letter_type === 'resignation' && (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => acceptResignationMutation.mutate(r.id)}
                            disabled={acceptResignationMutation.isPending}
                            className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectResignationMutation.mutate(r.id)}
                            disabled={rejectResignationMutation.isPending}
                            className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </span>
                      )}
                      {r.status === 'pending' && r.letter_type !== 'resignation' && (
                        <button
                          type="button"
                          onClick={() => openCreateFromRequest(r)}
                          className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Create & send
                        </button>
                      )}
                      {r.status !== 'pending' && <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
                {(!requests || requests.length === 0) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-4 text-center text-gray-500"
                    >
                      No requests
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Generated letters
          </h2>
        </div>
        {lettersLoading ? (
          <div className="px-4 py-4 text-sm text-gray-700">
            Loading letters...
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Employee
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Date
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Letter type
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Designation
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Team
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Title
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {letters.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2">
                    <span className="font-medium text-gray-900">
                      {l.employee_name || `Employee #${l.employee_id}`}
                    </span>
                    {l.employee_code && (
                      <span className="ml-1 text-gray-500 text-xs">({l.employee_code})</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {l.created_at ? l.created_at.slice(0, 19).replace('T', ' ') : '—'}
                  </td>
                  <td className="px-4 py-2 capitalize">{l.letter_type}</td>
                  <td className="px-4 py-2 text-gray-700">{l.designation || '—'}</td>
                  <td className="px-4 py-2 text-gray-700">{l.team_name || '—'}</td>
                  <td className="px-4 py-2">{l.title}</td>
                </tr>
              ))}
              {(!letters || letters.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-4 text-center text-gray-500"
                  >
                    No letters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Create letter</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  setFormError('')
                }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSend} className="space-y-4">
              {formError && (
                <div className="p-3 rounded bg-red-50 text-red-700 text-sm">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee
                  </label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Letter type
                  </label>
                  <select
                    value={letterType}
                    onChange={(e) => setLetterType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="experience">Experience</option>
                    <option value="appreciation">Appreciation</option>
                    <option value="recommendation">Recommendation</option>
                    <option value="increment">Increment</option>
                    <option value="appointment">Appointment</option>
                    <option value="termination">Termination</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload letter PDF (optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfChange}
                  className="block w-full text-sm text-gray-700"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We will extract text from the PDF and use it as the letter. You don&apos;t have to type the body manually.
                </p>
                {extractMutation.isPending && (
                  <p className="text-xs text-gray-600 mt-1">Reading PDF...</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Experience Letter"
                />
              </div>

              <div>
                {!hasPdf ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Letter content
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Paste or type the letter content here. You can use {{employee_name}} as a placeholder."
                    />
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    Letter body will be taken from the uploaded PDF. No need to type an email body.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setFormError('')
                  }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {generateMutation.isPending ? 'Sending...' : 'Send letter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Letters

