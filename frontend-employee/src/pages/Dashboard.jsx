import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import {
  UserCog,
  Calendar,
  FileText,
  DollarSign,
  User,
  LogIn,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Award,
  UserCheck,
} from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
} from 'date-fns'

const Dashboard = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [todayOverride, setTodayOverride] = useState(null)
  const [forceCheckedIn, setForceCheckedIn] = useState(false)
  const queryClient = useQueryClient()

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get('/dashboard/summary')
      return res.data.data
    },
  })

  const { data: alerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const res = await api.get('/dashboard/alerts')
      return res.data.data
    },
  })

  const { data: historyRaw, refetch: refetchHistory } = useQuery({
    queryKey: ['attendance-history'],
    queryFn: async () => {
      const res = await api.get('/attendance/history')
      const raw = res.data?.data
      return Array.isArray(raw) ? raw : raw?.data ?? []
    },
  })
  const history = historyRaw ?? []

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-in', { is_late: false }),
    onSuccess: (res) => {
      setForceCheckedIn(true)
      const body = res?.data
      const newRecord = body?.data ?? (body && (body.id != null || body.check_in_time != null) ? body : null)
      const now = new Date()
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const systemTime = now.toISOString()
      const recordToStore = newRecord
        ? { ...newRecord, check_out_time: null, check_in_time: systemTime }
        : { check_in_time: systemTime, check_out_time: null, date: todayLocal }
      setTodayOverride(recordToStore)
      if (newRecord?.id != null) {
        queryClient.setQueryData(['attendance-history'], (prev) => {
          const list = Array.isArray(prev) ? prev : []
          return [recordToStore, ...list.filter((h) => h.id !== newRecord.id)]
        })
      }
      refetchHistory()
      queryClient.invalidateQueries(['dashboard-summary'])
    },
  })

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-out', {}),
    onSuccess: (res) => {
      setForceCheckedIn(false)
      const payload = res?.data
      const updated = payload?.data ?? payload
      if (updated?.id) {
        setTodayOverride(updated)
        queryClient.setQueryData(['attendance-history'], (prev) => {
          const list = Array.isArray(prev) ? prev : []
          return list.map((h) => (h.id === updated.id ? { ...h, ...updated } : h))
        })
      }
      refetchHistory()
      queryClient.invalidateQueries(['dashboard-summary'])
    },
    onError: (err) => {
      const detail = err.response?.data?.detail ?? ''
      if (typeof detail === 'string' && (detail.toLowerCase().includes('no active check-in') || detail.toLowerCase().includes('check in first'))) {
        setForceCheckedIn(false)
        refetchHistory()
        queryClient.invalidateQueries(['dashboard-summary'])
      }
    },
  })

  const now = new Date()
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayRecordFromHistory =
    history.find((h) => (h.date || '').toString().slice(0, 10) === todayLocal) ||
    history.find((h) => !h.check_out_time)
  const todayRecord = todayOverride ?? todayRecordFromHistory
  const checkedIn = forceCheckedIn || Boolean(todayRecord && !todayRecord.check_out_time)
  const today = todayLocal

  const cards = [
    { name: 'Teams', href: '/teams', icon: UserCog, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700' },
    { name: 'Leave Requests', href: '/leave', icon: Calendar, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { name: 'Documents', href: '/documents', icon: FileText, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700' },
    { name: 'Salary Slip', href: '/payroll', icon: DollarSign, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-700' },
    { name: 'Personal Information', href: '/personal', icon: User, color: 'from-rose-500 to-pink-600', bg: 'bg-rose-50', text: 'text-rose-700' },
  ]

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const getAttendanceForDate = (d) => {
    const dateStr = format(d, 'yyyy-MM-dd')
    return history.find((h) => (h.date || '').slice(0, 10) === dateStr)
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Welcome back{summary?.employee_name ? `, ${summary.employee_name.split(' ')[0]}` : ''}!
        </h1>
        <p className="mt-1 text-gray-600">Manage your work and access your information</p>
      </div>

      {alerts && (alerts.probation_ending_soon?.length > 0 || alerts.work_anniversaries?.length > 0) && (
        <div className="space-y-3">
          {alerts.probation_ending_soon?.map((p) => (
            <div key={p.employee_id} className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <UserCheck className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-900">Probation ending soon</p>
                <p className="text-sm text-amber-800">Your {p.probation_months}-month probation ends on {p.probation_end_date}</p>
              </div>
            </div>
          ))}
          {alerts.work_anniversaries?.map((a) => (
            <div key={a.employee_id} className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <Award className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-900">Work anniversary</p>
                <p className="text-sm text-emerald-800">Congratulations! {a.years} year{a.years !== 1 ? 's' : ''} with us on {a.anniversary_date}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map((c) => {
              const Icon = c.icon
              return (
                <Link
                  key={c.name}
                  to={c.href}
                  className={`${c.bg} rounded-2xl p-6 flex items-center gap-4 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border border-white/50 group`}
                >
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${c.color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className={`font-semibold ${c.text}`}>{c.name}</h3>
                    <p className="text-sm text-gray-500">View details</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Attendance</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={() => checkInMutation.mutate()}
                  disabled={checkedIn || checkInMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md"
                >
                  <LogIn className="w-5 h-5" /> Check In
                </button>
                <button
                  onClick={() => checkOutMutation.mutate()}
                  disabled={!checkedIn || checkOutMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md"
                >
                  <LogOut className="w-5 h-5" /> Check Out
                </button>
              </div>
              {todayRecord && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm font-medium text-gray-700">Today&apos;s status</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    In: {todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString() : '--'}
                    {todayRecord.check_out_time && (
                      <> • Out: {new Date(todayRecord.check_out_time).toLocaleTimeString()}</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-gray-900">Google Calendar</h2>
              <a
                href="https://calendar.google.com/calendar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Open in Google Calendar
              </a>
            </div>
            <div className="p-4">
              {summary?.google_calendar_id ? (
                <div className="rounded-lg overflow-hidden border border-gray-200" style={{ minHeight: 320 }}>
                  <iframe
                    src={`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(summary.google_calendar_id)}&ctz=UTC&mode=WEEK`}
                    style={{ border: 0, width: '100%', height: 360 }}
                    title="Google Calendar"
                  />
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                  <p className="text-gray-600 mb-3">View and book meetings in Google Calendar</p>
                  <a
                    href="https://calendar.google.com/calendar"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                  >
                    <Calendar className="w-5 h-5" />
                    Open Google Calendar
                  </a>
                  <p className="mt-3 text-xs text-gray-500">Admin can configure a shared calendar in settings</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-gray-900">Attendance</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 rounded-lg hover:bg-slate-100 text-gray-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 rounded-lg hover:bg-slate-100 text-gray-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-center font-medium text-gray-700 mb-4">
                {format(currentMonth, 'MMMM yyyy')}
              </p>
              <div className="grid grid-cols-7 gap-1 text-xs font-medium text-gray-500 mb-2">
                {weekDays.map((d) => (
                  <div key={d} className="text-center py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const att = getAttendanceForDate(d)
                  const isCurrentMonth = isSameMonth(d, currentMonth)
                  const isToday = isSameDay(d, new Date())
                  return (
                    <div
                      key={d.toString()}
                      className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm
                        ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                        ${isToday ? 'bg-indigo-100 font-bold text-indigo-700 ring-2 ring-indigo-400' : ''}
                        ${att && isCurrentMonth && !isToday ? 'bg-emerald-50 text-emerald-700' : ''}
                      `}
                    >
                      {format(d, 'd')}
                      {att && isCurrentMonth && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5" />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" /> Today
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
