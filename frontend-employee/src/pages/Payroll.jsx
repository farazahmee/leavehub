import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { Download, Eye } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const Payroll = () => {
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())

  const { data: payrolls = [] } = useQuery({
    queryKey: ['payrolls', yearFilter],
    queryFn: async () => {
      const params = yearFilter ? { year: parseInt(yearFilter, 10) } : {}
      const res = await api.get('/payroll', { params })
      return res.data.data
    },
  })

  const [error, setError] = useState('')

  const handleDownload = async (p) => {
    try {
      const res = await api.get(`/payroll/${p.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `salary_slip_${p.month}_${p.year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (_) {
      setError('Download failed - file may not exist')
    }
  }

  const handleView = async (p) => {
    try {
      setError('')
      const res = await api.get(`/payroll/${p.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (_) {
      setError('View failed - file may not exist')
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Salary Slip</h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Year</label>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-xl"
        >
          {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {payrolls.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No salary slips yet</td></tr>
            ) : (
              payrolls.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 font-medium text-gray-900">{MONTHS[p.month - 1]}</td>
                  <td className="px-6 py-4 text-gray-900">{p.year}</td>
                  <td className="px-6 py-4 text-gray-900">₹{p.net_salary?.toLocaleString() ?? '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleView(p)}
                        className="text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 text-sm"
                      >
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <button
                        onClick={() => handleDownload(p)}
                        className="text-gray-600 hover:text-gray-800 inline-flex items-center gap-1 text-sm"
                      >
                        <Download className="w-4 h-4" /> Download
                      </button>
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

export default Payroll
