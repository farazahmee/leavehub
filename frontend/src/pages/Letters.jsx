import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import useAuthStore from '../store/authStore'
import { isAdminUser } from '../utils/authHelpers'
import { X, Plus, FileText, Pencil, Trash2, Upload } from 'lucide-react'
import useToastStore from '../store/toastStore'

const BASIC_TO_GROSS_RATIO = 0.4

const LETTER_TEMPLATES = {
  appreciation: `To Whom It May Concern,

This is to certify that {{employee_name}} has demonstrated exceptional dedication and outstanding performance. We appreciate their contributions to our organization.

We extend our heartfelt appreciation for their commitment and wish them continued success.

Best regards,
HR Department`,

  increment: `To Whom It May Concern,

This letter confirms the salary increment for {{employee_name}}.

Increment Amount: {{increment_amount}}
Current Basic Salary: {{current_basic}}
New Basic Salary: {{new_basic}}
New Gross Salary: {{new_gross}}

The revised salary will be effective from the next pay cycle.

Best regards,
HR Department`,

  recommendation: `To Whom It May Concern,

This is to certify that {{employee_name}} has been an integral part of our organization. Based on our experience working together, we recommend them highly for their professionalism, dedication, and expertise.

We wish them success in their future endeavors.

Best regards,
HR Department`,

  experience: `To Whom It May Concern,

This is to certify that {{employee_name}} has been employed with our organization. During their tenure, they have performed their duties with diligence and professionalism.

This experience letter is issued at their request for their future use.

Best regards,
HR Department`,

  resignation: `To Whom It May Concern,

This is to confirm that {{employee_name}} has tendered their resignation from our organization. Their last working day will be as per the notice period agreed upon.

We thank them for their service and wish them success in their future endeavors.

Best regards,
HR Department`,
}

const Letters = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    employee_id: '',
    letter_type: 'experience',
    title: '',
    content: '',
    increment_amount: '',
    current_basic: '',
    current_gross: '',
  })
  const [error, setError] = useState('')
  const [viewLetter, setViewLetter] = useState(null)
  const [editLetter, setEditLetter] = useState(null)
  const [fulfillingRequestId, setFulfillingRequestId] = useState(null)
  const [extractingPdf, setExtractingPdf] = useState(false)
  const pdfInputRef = useRef(null)
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = isAdminUser(user)

  const { data: lettersData } = useQuery({
    queryKey: ['letters'],
    queryFn: async () => {
      const res = await api.get('/letters')
      return res.data.data
    },
  })

  const { data: letterRequestsData } = useQuery({
    queryKey: ['letter-requests'],
    queryFn: async () => {
      const res = await api.get('/letters/requests', { params: { status_filter: 'pending' } })
      return res.data.data || []
    },
    enabled: isAdmin,
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-all-letters'],
    queryFn: async () => {
      const res = await api.get('/dashboard/card/employees')
      const list = res.data?.data
      return Array.isArray(list) ? list : []
    },
    enabled: modalOpen || !!editLetter,
  })

  const letters = lettersData || []
  const employees = employeesData || []
  const pendingRequests = letterRequestsData || []

  const incrementCalc = useMemo(() => {
    const amt = parseFloat(formData.increment_amount)
    const basic = parseFloat(formData.current_basic)
    const gross = parseFloat(formData.current_gross)
    if (!amt || amt <= 0) return null
    let currentBasic = basic
    if (!currentBasic && gross > 0) currentBasic = gross * BASIC_TO_GROSS_RATIO
    if (!currentBasic) return null
    const newBasic = currentBasic + amt
    const newGross = newBasic / BASIC_TO_GROSS_RATIO
    return { currentBasic, newBasic, newGross }
  }, [formData.increment_amount, formData.current_basic, formData.current_gross])

  const updateMutation = useMutation({
    mutationFn: async ({ id, employee_id, title, content }) => {
      const body = { title, content }
      if (employee_id != null) body.employee_id = employee_id
      const res = await api.put(`/letters/${id}`, body)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['letters'])
      setEditLetter(null)
      setViewLetter(null)
      setError('')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : msg?.[0]?.msg || 'Update failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/letters/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['letters'])
      setEditLetter(null)
      setViewLetter(null)
      setError('')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : msg?.[0]?.msg || 'Delete failed')
    },
  })

  const acceptResignationMutation = useMutation({
    mutationFn: async (requestId) => {
      const res = await api.put(`/letters/requests/${requestId}/accept`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['letters'])
      queryClient.invalidateQueries(['letter-requests'])
      queryClient.invalidateQueries(['letter-requests-count'])
      setError('')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : msg?.[0]?.msg || 'Accept failed')
    },
  })

  const rejectResignationMutation = useMutation({
    mutationFn: async (requestId) => {
      const res = await api.put(`/letters/requests/${requestId}/reject`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['letter-requests'])
      queryClient.invalidateQueries(['letter-requests-count'])
      setError('')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : msg?.[0]?.msg || 'Reject failed')
    },
  })

  const addToast = useToastStore((s) => s.addToast)
  const createMutation = useMutation({
    mutationFn: async ({ payload, requestId }) => {
      const res = await api.post('/letters/generate', payload)
      if (requestId) {
        await api.put(`/letters/requests/${requestId}/complete`)
      }
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['letters'])
      queryClient.invalidateQueries(['letter-requests'])
      queryClient.invalidateQueries(['letter-requests-count'])
      setModalOpen(false)
      setFulfillingRequestId(null)
      setFormData({ employee_id: '', letter_type: 'experience', title: '', content: '', increment_amount: '', current_basic: '', current_gross: '' })
      setError('')
      addToast('Letter created and sent')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail
      const detail = typeof msg === 'string' ? msg : (Array.isArray(msg) ? msg[0]?.msg : null) || err.response?.data?.message || 'Failed to create letter'
      setError(detail)
      addToast(detail, 'error')
    },
  })

  const applyTemplate = () => {
    const tpl = LETTER_TEMPLATES[formData.letter_type] || ''
    const emp = employees.find((e) => e.id === parseInt(formData.employee_id, 10))
    let c = tpl.replace(/\{\{employee_name\}\}/g, emp ? `${emp.first_name} ${emp.last_name}` : '{{employee_name}}')
    if (formData.letter_type === 'increment' && incrementCalc) {
      c = c
        .replace(/\{\{increment_amount\}\}/g, formData.increment_amount)
        .replace(/\{\{current_basic\}\}/g, incrementCalc.currentBasic.toFixed(2))
        .replace(/\{\{new_basic\}\}/g, incrementCalc.newBasic.toFixed(2))
        .replace(/\{\{new_gross\}\}/g, incrementCalc.newGross.toFixed(2))
    }
    setFormData((f) => ({ ...f, content: c }))
  }

  const handleLetterTypeChange = (type) => {
    setFormData((f) => ({
      ...f,
      letter_type: type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Letter`,
      content: LETTER_TEMPLATES[type] || '',
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const empId = parseInt(formData.employee_id, 10)
    if (!empId) {
      setError('Please select an employee')
      return
    }
    if (!formData.title?.trim()) {
      setError('Title is required')
      return
    }
    if (!formData.content?.trim()) {
      setError('Content is required')
      return
    }
    const payload = {
      employee_id: empId,
      letter_type: formData.letter_type,
      title: formData.title.trim(),
      content: formData.content.trim(),
    }
    if (formData.letter_type === 'increment') {
      const amt = parseFloat(formData.increment_amount)
      const basic = parseFloat(formData.current_basic)
      const gross = parseFloat(formData.current_gross)
      if (!amt || amt <= 0) {
        setError('Increment amount is required')
        return
      }
      payload.increment_amount = amt
      if (basic > 0) payload.current_basic = basic
      else if (gross > 0) payload.current_gross = gross
      else {
        setError('Enter current basic or gross salary')
        return
      }
    }
    createMutation.mutate({ payload, requestId: fulfillingRequestId || undefined })
  }

  const letterTypes = [
    { value: 'appreciation', label: 'Appreciation Letter' },
    { value: 'increment', label: 'Increment Letter' },
    { value: 'recommendation', label: 'Letter of Recommendation' },
    { value: 'experience', label: 'Experience Letter' },
    { value: 'resignation', label: 'Resignation Letter' },
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Letters</h1>
        {isAdmin && pendingRequests.length > 0 && (
          <div className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg flex items-center gap-2">
            <span className="font-medium">{pendingRequests.length} letter request{pendingRequests.length !== 1 ? 's' : ''} pending</span>
          </div>
        )}
        {isAdmin && (
          <button
            onClick={() => {
              setFulfillingRequestId(null)
              setModalOpen(true)
              setError('')
              setFormData({
                employee_id: '',
                letter_type: 'experience',
                title: 'Experience Letter',
                content: LETTER_TEMPLATES.experience,
                increment_amount: '',
                current_basic: '',
                current_gross: '',
              })
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Create Letter
          </button>
        )}
      </div>

      {isAdmin && pendingRequests.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="text-sm font-semibold text-amber-900 mb-3">Pending Letter Requests</h3>
          <div className="space-y-2">
            {pendingRequests.map((r) => {
              const isResignation = r.letter_type === 'resignation'
              return (
                <div key={r.id} className="py-2 border-b border-amber-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900"><strong>{r.employee_name}</strong> requested <strong>{r.letter_type}</strong> letter</span>
                    {isResignation ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => rejectResignationMutation.mutate(r.id)}
                          disabled={rejectResignationMutation.isPending}
                          className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => acceptResignationMutation.mutate(r.id)}
                          disabled={acceptResignationMutation.isPending}
                          className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                        >
                          Accept
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setFulfillingRequestId(r.id)
                          setModalOpen(true)
                          const content = LETTER_TEMPLATES[r.letter_type] || LETTER_TEMPLATES.experience
                          setFormData({
                            employee_id: String(r.employee_id),
                            letter_type: r.letter_type,
                            title: `${r.letter_type.charAt(0).toUpperCase() + r.letter_type.slice(1)} Letter`,
                            content,
                            increment_amount: '',
                            current_basic: '',
                            current_gross: '',
                          })
                          setError('')
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Create &amp; Send
                      </button>
                    )}
                  </div>
                  {r.letter_type === 'resignation' && r.content && (
                    <div className="mt-2 p-3 bg-white rounded border border-amber-200 text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {r.content}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {modalOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Create Letter</h2>
              <button onClick={() => { setModalOpen(false); setError(''); }} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-6 py-2 text-sm text-gray-700">
              The letter will be created and sent to the employee&apos;s email automatically.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 py-4 space-y-4 overflow-auto flex-1">
                {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Employee *</label>
                  <select
                    required
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="">Select employee</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Letter Type *</label>
                  <select
                    value={formData.letter_type}
                    onChange={(e) => handleLetterTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    {letterTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="e.g. Experience Letter"
                  />
                </div>

                {formData.letter_type === 'increment' && (
                  <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <h3 className="text-sm font-medium text-gray-900">Salary Details (auto-calculated)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Increment Amount *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.increment_amount}
                          onChange={(e) => setFormData({ ...formData, increment_amount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                          placeholder="e.g. 5000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Current Basic Salary</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.current_basic}
                          onChange={(e) => setFormData({ ...formData, current_basic: e.target.value, current_gross: '' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                          placeholder="e.g. 20000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Or Current Gross Salary</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.current_gross}
                          onChange={(e) => setFormData({ ...formData, current_gross: e.target.value, current_basic: '' })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900"
                          placeholder="e.g. 50000"
                        />
                      </div>
                    </div>
                    {incrementCalc && (
                      <div className="text-sm text-gray-900 space-y-1 pt-2 border-t border-gray-200">
                        <p><strong>Calculated:</strong> New Basic = {incrementCalc.newBasic.toFixed(2)}</p>
                        <p><strong>Calculated:</strong> New Gross = {incrementCalc.newGross.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Content *</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      type="button"
                      onClick={applyTemplate}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Use template
                    </button>
                    {['experience', 'recommendation', 'appreciation'].includes(formData.letter_type) && (
                      <>
                        <input
                          ref={(el) => { pdfInputRef.current = el }}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target?.files?.[0]
                            if (!file) return
                            setExtractingPdf(true)
                            setError('')
                            try {
                              const fd = new FormData()
                              fd.append('file', file)
                              const res = await api.post('/letters/extract-pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                              const data = res.data?.data || {}
                              const content = data.content || ''
                              const letterType = data.letter_type || formData.letter_type
                              const title = data.title || formData.title
                              setFormData((f) => ({
                                ...f,
                                letter_type: letterType,
                                title,
                                content: content || f.content,
                              }))
                            } catch (err) {
                              setError(err.response?.data?.detail || 'Failed to extract PDF')
                            } finally {
                              setExtractingPdf(false)
                              e.target.value = ''
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          disabled={extractingPdf}
                          className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" />
                          {extractingPdf ? 'Extracting...' : 'Upload sample PDF'}
                        </button>
                      </>
                    )}
                  </div>
                  <textarea
                    required
                    rows={10}
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono text-sm"
                    placeholder="Letter content..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t flex gap-3">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating & Sending...' : 'Create & Send to Email'}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setError(''); }}
                  className="py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewLetter && !editLetter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">{viewLetter.title}</h2>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setEditLetter(viewLetter)}
                      className="p-2 text-amber-600 hover:bg-amber-50 rounded"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this letter?')) deleteMutation.mutate(viewLetter.id)
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button onClick={() => setViewLetter(null)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-auto flex-1">
              <pre className="whitespace-pre-wrap font-sans text-gray-900 text-sm">{viewLetter.content}</pre>
            </div>
          </div>
        </div>
      )}

      {editLetter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Edit Letter</h2>
              <button
                onClick={() => { setEditLetter(null); setError(''); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!editLetter.employee_id) {
                  setError('Please select an employee')
                  return
                }
                updateMutation.mutate({
                  id: editLetter.id,
                  employee_id: parseInt(editLetter.employee_id, 10),
                  title: editLetter.title,
                  content: editLetter.content,
                })
              }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="px-6 py-4 space-y-4 overflow-auto flex-1">
                {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Employee *</label>
                  <select
                    value={editLetter.employee_id ?? ''}
                    onChange={(e) => setEditLetter({ ...editLetter, employee_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="">Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Title</label>
                  <input
                    type="text"
                    value={editLetter.title}
                    onChange={(e) => setEditLetter({ ...editLetter, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Content</label>
                  <textarea
                    rows={10}
                    value={editLetter.content}
                    onChange={(e) => setEditLetter({ ...editLetter, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono text-sm"
                  />
                </div>
              </div>
              <p className="px-6 text-sm text-gray-600">Saving will also send the updated letter to the employee&apos;s email.</p>
              <div className="px-6 py-4 border-t flex gap-3">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving & Sending...' : 'Save & Send to Email'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditLetter(null); setError(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Employee</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {letters.length === 0 ? (
              <tr><td colSpan={isAdmin ? 5 : 4} className="px-6 py-8 text-center text-gray-900">No letters yet</td></tr>
            ) : (
              letters.map((l) => (
                <tr key={l.id}>
                  {isAdmin && <td className="px-6 py-4 text-gray-900">{l.employee_name || '-'}</td>}
                  <td className="px-6 py-4 font-medium text-gray-900">{l.title}</td>
                  <td className="px-6 py-4 text-gray-900 capitalize">{l.letter_type?.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-gray-900">{l.created_at ? new Date(l.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setViewLetter(l); setEditLetter(null); setError(''); }}
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-sm"
                      >
                        <FileText className="w-4 h-4" /> View
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => { setEditLetter(l); setViewLetter(null); setError(''); }}
                            className="text-amber-600 hover:text-amber-800 inline-flex items-center gap-1 text-sm"
                          >
                            <Pencil className="w-4 h-4" /> Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this letter?')) deleteMutation.mutate(l.id)
                            }}
                            disabled={deleteMutation.isPending}
                            className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 text-sm"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </>
                      )}
                    </div>
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

export default Letters
