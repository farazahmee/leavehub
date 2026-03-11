import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import {
  Users,
  Clock,
  Calendar,
  AlertCircle,
  UserCog,
  FileText,
} from 'lucide-react'

const cardEndpoints = {
  'Total Employees': '/dashboard/card/employees',
  'Present Today': '/dashboard/card/present-today',
  'On Leave Today': '/dashboard/card/on-leave-today',
  'Pending Leave Requests': '/dashboard/card/pending-leaves',
  'Total Teams': '/dashboard/card/teams',
  'Documents Uploaded': '/dashboard/card/documents',
}

const DetailModal = ({ title, onClose, endpoint }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['ca-dashboard-card', endpoint],
    queryFn: async () => {
      const res = await api.get(endpoint)
      return res.data.data
    },
    enabled: !!endpoint,
  })

  const isEmployees =
    endpoint?.includes('employees') ||
    endpoint?.includes('present') ||
    endpoint?.includes('on-leave')
  const isPendingLeaves = endpoint?.includes('pending-leaves')
  const isTeams = endpoint?.includes('teams')
  const isDocuments = endpoint?.includes('documents')

  const renderRows = () => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan={4} className="px-4 py-8 text-center text-gray-900">
            Loading...
          </td>
        </tr>
      )
    }
    if (!data?.length) {
      return (
        <tr>
          <td colSpan={4} className="px-4 py-8 text-center text-gray-900">
            No data
          </td>
        </tr>
      )
    }
    if (isPendingLeaves) {
      return data.map((r) => (
        <tr key={r.id} className="border-b border-gray-100">
          <td className="px-4 py-3 text-sm">{r.employee_id}</td>
          <td className="px-4 py-3 text-sm">{r.employee_name}</td>
          <td className="px-4 py-3 text-sm">
            {r.leave_type} ({r.days} day{r.days !== 1 ? 's' : ''})
          </td>
          <td className="px-4 py-3 text-sm">
            {r.start_date} – {r.end_date}
          </td>
        </tr>
      ))
    }
    if (isTeams) {
      return data.map((t) => (
        <tr key={t.id} className="border-b border-gray-100">
          <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
          <td className="px-4 py-3 text-sm text-gray-900 col-span-3">
            {t.description || '-'}
          </td>
        </tr>
      ))
    }
    if (isDocuments) {
      return data.map((d) => (
        <tr key={d.id} className="border-b border-gray-100">
          <td className="px-4 py-3 text-sm">{d.name}</td>
          <td className="px-4 py-3 text-sm">{d.employee_name}</td>
          <td className="px-4 py-3 text-sm">{d.file_type}</td>
          <td className="px-4 py-3 text-sm text-gray-900">
            {d.created_at?.slice(0, 10)}
          </td>
        </tr>
      ))
    }
    if (isEmployees) {
      return data.map((e) => (
        <tr key={e.id} className="border-b border-gray-100">
          <td className="px-4 py-3 text-sm">{e.employee_id}</td>
          <td className="px-4 py-3 text-sm font-medium">
            {e.first_name} {e.last_name}
          </td>
          <td className="px-4 py-3 text-sm">{e.designation || '-'}</td>
          <td className="px-4 py-3 text-sm">{e.department || '-'}</td>
        </tr>
      ))
    }
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-900 hover:text-gray-700 p-1"
          >
            ✕
          </button>
        </div>
        <div className="overflow-auto flex-1 text-gray-900">
          <table className="min-w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {isPendingLeaves && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      ID
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Employee
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Leave
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Period
                    </th>
                  </>
                )}
                {isTeams && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase col-span-3">
                      Description
                    </th>
                  </>
                )}
                {isDocuments && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Employee
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Date
                    </th>
                  </>
                )}
                {isEmployees && (
                  <>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      ID
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Designation
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-900 uppercase">
                      Department
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>{renderRows()}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const Dashboard = () => {
  const [detailCard, setDetailCard] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ca-dashboard-summary'],
    queryFn: async () => {
      const response = await api.get('/dashboard/summary')
      return response.data.data
    },
  })

  const adminStats = [
    {
      name: 'Total Employees',
      value: data?.total_employees ?? 0,
      icon: Users,
      color: 'bg-blue-500',
      clickable: true,
    },
    {
      name: 'Present Today',
      value: data?.present_today ?? 0,
      icon: Clock,
      color: 'bg-green-500',
      clickable: true,
    },
    {
      name: 'On Leave Today',
      value: data?.on_leave_today ?? 0,
      icon: Calendar,
      color: 'bg-yellow-500',
      clickable: true,
    },
    {
      name: 'Pending Leave Requests',
      value: data?.pending_leave_requests ?? 0,
      icon: AlertCircle,
      color: 'bg-orange-500',
      clickable: true,
    },
    {
      name: 'Total Teams',
      value: data?.total_teams ?? 0,
      icon: UserCog,
      color: 'bg-purple-500',
      clickable: true,
    },
    {
      name: 'Documents Uploaded',
      value: data?.documents_uploaded ?? 0,
      icon: FileText,
      color: 'bg-indigo-500',
      clickable: true,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-900">Loading dashboard...</div>
      </div>
    )
  }

  const companyName = data?.company_name || data?.tenant_name

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {companyName ? `${companyName} overview` : 'Company dashboard'}
      </h1>
      <p className="text-gray-900 mb-8">
        High-level stats for your company in WorkForceHub.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminStats.map((stat) => {
          const Icon = stat.icon
          const isClickable = stat.clickable && cardEndpoints[stat.name]
          return (
            <div
              key={stat.name}
              onClick={() =>
                isClickable &&
                setDetailCard({ name: stat.name, endpoint: cardEndpoints[stat.name] })
              }
              className={`bg-white rounded-lg shadow p-6 border border-gray-200 ${
                isClickable
                  ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-shadow'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {detailCard && (
        <DetailModal
          title={detailCard.name}
          endpoint={detailCard.endpoint}
          onClose={() => setDetailCard(null)}
        />
      )}
    </div>
  )
}

export default Dashboard

