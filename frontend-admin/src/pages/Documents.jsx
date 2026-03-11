import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const Documents = () => {
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['ca-documents'],
    queryFn: async () => {
      const res = await api.get('/documents', { params: { is_company_policy: true } })
      return res.data.data || []
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('is_company_policy', 'true')
      return api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-documents'])
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
  }

  const handleDownload = (id) => {
    window.open(`/api/v1/documents/${id}/download`, '_blank', 'noopener')
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company documents</h1>
          <p className="text-sm text-gray-600 mt-1">
            Upload and manage company policy documents visible to all employees.
          </p>
        </div>
        <div>
          <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm cursor-pointer hover:bg-blue-700">
            {uploadMutation.isPending ? 'Uploading...' : 'Upload document'}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
            />
          </label>
        </div>
      </div>

      {isLoading ? (
        <div>Loading documents...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Name
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Type
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Size
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Uploaded
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-900 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2">{d.name}</td>
                  <td className="px-4 py-2">{d.file_type}</td>
                  <td className="px-4 py-2">
                    {d.file_size != null
                      ? `${(d.file_size / (1024 * 1024)).toFixed(2)} MB`
                      : '-'}
                  </td>
                  <td className="px-4 py-2">
                    {d.created_at ? d.created_at.slice(0, 10) : ''}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(d.id)}
                      className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
              {(!documents || documents.length === 0) && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No documents
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Documents

