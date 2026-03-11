import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { Upload, Download, FileText, Mail } from 'lucide-react'

const Documents = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [resignationModalOpen, setResignationModalOpen] = useState(false)
  const [resignationContent, setResignationContent] = useState('')
  const [file, setFile] = useState(null)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const { data: docs = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await api.get('/documents')
      return res.data.data
    },
  })

  const { data: letterRequests = [] } = useQuery({
    queryKey: ['letter-requests'],
    queryFn: async () => {
      const res = await api.get('/letters/my-requests')
      return res.data.data || []
    },
  })

  const requestLetterMutation = useMutation({
    mutationFn: async (letterType) => {
      const res = await api.post(`/letters/request?letter_type=${letterType}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['letter-requests'])
      queryClient.invalidateQueries(['letter-requests-count'])
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Request failed'),
  })

  const submitResignationMutation = useMutation({
    mutationFn: async (content) => {
      const res = await api.post('/letters/submit-resignation', { content })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['letter-requests'])
      queryClient.invalidateQueries(['letter-requests-count'])
      setResignationModalOpen(false)
      setResignationContent('')
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Submit failed'),
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('file', file)
      if (description) fd.append('description', description)
      const res = await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['documents'])
      setModalOpen(false)
      setFile(null)
      setDescription('')
      setError('')
    },
    onError: (err) => setError(err.response?.data?.detail || 'Upload failed'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!file) { setError('Please select a file'); return }
    uploadMutation.mutate()
  }

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = doc.name || 'document'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.message || 'Download failed')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Documents</h1>
        <p className="mt-1 text-gray-600">Upload files and request or submit letters</p>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6 p-4 bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Request letter:</span>
          <button
            onClick={() => requestLetterMutation.mutate('experience')}
            disabled={requestLetterMutation.isPending}
            className="px-4 py-2 text-sm bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 disabled:opacity-50 font-medium transition-colors"
          >
            Experience
          </button>
          <button
            onClick={() => requestLetterMutation.mutate('recommendation')}
            disabled={requestLetterMutation.isPending}
            className="px-4 py-2 text-sm bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 disabled:opacity-50 font-medium transition-colors"
          >
            Recommendation
          </button>
          <button
            onClick={() => requestLetterMutation.mutate('appreciation')}
            disabled={requestLetterMutation.isPending}
            className="px-4 py-2 text-sm bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 disabled:opacity-50 font-medium transition-colors"
          >
            Appreciation
          </button>
          <button
            onClick={() => { setResignationModalOpen(true); setResignationContent(''); setError(''); }}
            className="px-4 py-2 text-sm bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 disabled:opacity-50 font-medium transition-colors"
          >
            Submit Resignation Letter
          </button>
        </div>
        <button
          onClick={() => { setModalOpen(true); setError(''); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-md transition-colors"
        >
          <Upload className="w-4 h-4" /> Upload
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {letterRequests.length > 0 && (
        <div className="mb-6 p-5 bg-white rounded-2xl shadow-md border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">My Letter Requests</h3>
          <div className="space-y-2">
            {letterRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-900 capitalize">{r.letter_type} letter</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                  r.status === 'completed' ? 'bg-green-100 text-green-800' :
                  r.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {docs.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No documents yet</td></tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id}>
                  <td className="px-6 py-4 font-medium text-gray-900">{d.name || 'Document'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${d.is_company_policy ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                      {d.is_company_policy ? 'Company Policy' : 'Personal'}
                    </span>
                    <span className="ml-2 text-gray-500">{d.file_type || 'file'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDownload(d)}
                      className="text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 text-sm"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {resignationModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Submit Resignation Letter</h2>
              <p className="text-sm text-gray-600 mt-1">Write your resignation letter. Admin will review it.</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!resignationContent?.trim()) { setError('Please enter your resignation letter'); return }
                submitResignationMutation.mutate(resignationContent.trim())
              }}
              className="p-6 space-y-4"
            >
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resignation Letter *</label>
                <textarea
                  required
                  rows={10}
                  value={resignationContent}
                  onChange={(e) => setResignationContent(e.target.value)}
                  placeholder="Dear [Manager name],&#10;&#10;Please accept this letter as formal notice of my resignation..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitResignationMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitResignationMutation.isPending ? 'Submitting...' : 'Submit to Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => { setResignationModalOpen(false); setResignationContent(''); setError(''); }}
                  className="py-2 px-4 border border-gray-300 rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Upload Document</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setError(''); setFile(null); setDescription(''); }}
                  className="py-2 px-4 border border-gray-300 rounded-xl hover:bg-gray-50"
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

export default Documents
