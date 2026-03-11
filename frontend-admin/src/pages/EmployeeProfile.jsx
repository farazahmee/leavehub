import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import {
  ArrowLeft,
  User,
  Clock,
  Calendar,
  FileText,
  DollarSign,
  Mail,
  Phone,
  CreditCard,
} from 'lucide-react'

const EmployeeProfile = () => {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [leaveQuota, setLeaveQuota] = useState({ annual_leave: '', sick_leave: '', casual_leave: '' })
  const [leaveQuotaMsg, setLeaveQuotaMsg] = useState(null)

  const { data: employee, isLoading } = useQuery({
    queryKey: ['ca-employee', id],
    queryFn: async () => {
      const res = await api.get(`/employees/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: attendance } = useQuery({
    queryKey: ['ca-attendance-employee', id],
    queryFn: async () => {
      const res = await api.get('/attendance/all', { params: { employee_id: id } })
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: letters } = useQuery({
    queryKey: ['ca-letters-employee', id],
    queryFn: async () => {
      const res = await api.get('/letters')
      const list = res.data.data || []
      return list.filter((l) => l.employee_id === parseInt(id, 10))
    },
    enabled: !!id,
  })

  const { data: payrolls } = useQuery({
    queryKey: ['ca-payroll-employee', id],
    queryFn: async () => {
      const res = await api.get('/payroll', { params: { employee_id: id } })
      return res.data.data
    },
    enabled: !!id,
  })

  const { data: leaveBalance } = useQuery({
    queryKey: ['ca-leave-balance-employee', id],
    queryFn: async () => {
      const res = await api.get(`/leave/balance/${id}`)
      return res.data.data
    },
    enabled: !!id,
  })

  const setLeaveBalanceMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.put(`/leave/balance/${id}`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ca-leave-balance-employee', id])
      setLeaveQuota({ annual_leave: '', sick_leave: '', casual_leave: '' })
      setLeaveQuotaMsg('Leave quota updated.')
      setTimeout(() => setLeaveQuotaMsg(null), 4000)
    },
    onError: (err) => {
      setLeaveQuotaMsg(err.response?.data?.detail || 'Failed to update leave quota')
    },
  })

  const handleSetLeaveQuota = (e) => {
    e.preventDefault()
    setLeaveQuotaMsg(null)
    const payload = {}
    if (leaveQuota.annual_leave !== '' && !isNaN(Number(leaveQuota.annual_leave))) payload.annual_leave = parseInt(leaveQuota.annual_leave, 10)
    if (leaveQuota.sick_leave !== '' && !isNaN(Number(leaveQuota.sick_leave))) payload.sick_leave = parseInt(leaveQuota.sick_leave, 10)
    if (leaveQuota.casual_leave !== '' && !isNaN(Number(leaveQuota.casual_leave))) payload.casual_leave = parseInt(leaveQuota.casual_leave, 10)
    if (Object.keys(payload).length === 0) {
      setLeaveQuotaMsg('Enter at least one quota value.')
      return
    }
    setLeaveBalanceMutation.mutate(payload)
  }

  if (isLoading || !employee) {
    return <div className="text-gray-900">Loading...</div>
  }

  return (
    <div>
      <Link
        to="/employees"
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Employees
      </Link>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-gray-700">ID: {employee.employee_id}</p>
            <p className="text-gray-700">
              {employee.designation || 'No designation'}
            </p>
            <p className="text-gray-700">
              {employee.department || 'No department'}
            </p>
            {(employee.cnic ||
              employee.personal_email ||
              employee.emergency_contact_name) && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-1 text-sm">
                {employee.cnic && (
                  <p className="text-gray-700">
                    <CreditCard className="w-4 h-4 inline mr-2" /> CNIC:{' '}
                    {employee.cnic}
                  </p>
                )}
                {employee.personal_email && (
                  <p className="text-gray-700">
                    <Mail className="w-4 h-4 inline mr-2" /> Personal:{' '}
                    {employee.personal_email}
                  </p>
                )}
                {employee.emergency_contact_name && (
                  <p className="text-gray-700">
                    <Phone className="w-4 h-4 inline mr-2" /> Emergency:{' '}
                    {employee.emergency_contact_name}{' '}
                    {employee.emergency_contact_phone || ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {(leaveBalance != null || id) && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Leave Balance
          </h2>
          {leaveBalance && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-gray-600">Annual</p>
                <p className="text-xl font-bold text-indigo-700">
                  {leaveBalance.annual ?? 0}{' '}
                  <span className="text-sm font-normal text-gray-500">
                    of {leaveBalance.annual_leave ?? 0}
                  </span>
                </p>
                <p className="text-xs text-gray-500">remaining</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-sm text-gray-600">Sick</p>
                <p className="text-xl font-bold text-emerald-700">
                  {leaveBalance.sick ?? 0}{' '}
                  <span className="text-sm font-normal text-gray-500">
                    of {leaveBalance.sick_leave ?? 0}
                  </span>
                </p>
                <p className="text-xs text-gray-500">remaining</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-gray-600">Casual</p>
                <p className="text-xl font-bold text-amber-700">
                  {leaveBalance.casual ?? 0}{' '}
                  <span className="text-sm font-normal text-gray-500">
                    of {leaveBalance.casual_leave ?? 0}
                  </span>
                </p>
                <p className="text-xs text-gray-500">remaining</p>
              </div>
            </div>
          )}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Update leave quota (current year)</p>
            {leaveQuotaMsg && (
              <p className={`text-sm mb-2 ${leaveQuotaMsg.startsWith('Leave quota updated') ? 'text-green-600' : 'text-red-600'}`}>
                {leaveQuotaMsg}
              </p>
            )}
            <form onSubmit={handleSetLeaveQuota} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Annual</label>
                <input
                  type="number"
                  min={0}
                  value={leaveQuota.annual_leave}
                  onChange={(e) => setLeaveQuota({ ...leaveQuota, annual_leave: e.target.value })}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder={leaveBalance?.annual_leave ?? '15'}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Sick</label>
                <input
                  type="number"
                  min={0}
                  value={leaveQuota.sick_leave}
                  onChange={(e) => setLeaveQuota({ ...leaveQuota, sick_leave: e.target.value })}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder={leaveBalance?.sick_leave ?? '6'}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Casual</label>
                <input
                  type="number"
                  min={0}
                  value={leaveQuota.casual_leave}
                  onChange={(e) => setLeaveQuota({ ...leaveQuota, casual_leave: e.target.value })}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder={leaveBalance?.casual_leave ?? '5'}
                />
              </div>
              <button
                type="submit"
                disabled={setLeaveBalanceMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {setLeaveBalanceMutation.isPending ? 'Saving...' : 'Save quota'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Recent Attendance
          </h2>
          <ul className="space-y-2 text-sm text-gray-900">
            {(attendance || []).slice(0, 5).map((a) => (
              <li key={a.id}>
                {a.date} –{' '}
                {a.check_in_time
                  ? new Date(a.check_in_time).toLocaleTimeString()
                  : '-'}{' '}
                –{' '}
                {a.check_out_time
                  ? new Date(a.check_out_time).toLocaleTimeString()
                  : 'Active'}
              </li>
            ))}
            {(!attendance || attendance.length === 0) && (
              <li className="text-gray-500">No records</li>
            )}
          </ul>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Letters
          </h2>
          <ul className="space-y-2 text-sm text-gray-900">
            {(letters || []).slice(0, 5).map((l) => (
              <li key={l.id}>
                {l.title} ({l.letter_type})
              </li>
            ))}
            {(!letters || letters.length === 0) && (
              <li className="text-gray-500">No letters</li>
            )}
          </ul>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Payroll
          </h2>
          <ul className="space-y-2 text-sm text-gray-900">
            {(payrolls || []).slice(0, 5).map((p) => (
              <li key={p.id}>
                {p.month}/{p.year} – Net:{' '}
                {p.net_salary != null
                  ? Number(p.net_salary).toLocaleString()
                  : '-'}
              </li>
            ))}
            {(!payrolls || payrolls.length === 0) && (
              <li className="text-gray-500">No payroll records</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default EmployeeProfile

