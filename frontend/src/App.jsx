import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import EmployeePortal from './pages/EmployeePortal'
import SetPassword from './pages/SetPassword'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Teams from './pages/Teams'
import Attendance from './pages/Attendance'
import Leave from './pages/Leave'
import Documents from './pages/Documents'
import Letters from './pages/Letters'
import Payroll from './pages/Payroll'
import Reports from './pages/Reports'
import Announcements from './pages/Announcements'
import EmployeeProfile from './pages/EmployeeProfile'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SuperAdminGuard from './components/SuperAdminGuard'
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import SuperAdminCompanies from './pages/superadmin/SuperAdminCompanies'
import SuperAdminCompanyNew from './pages/superadmin/SuperAdminCompanyNew'
import SuperAdminCompanyDetail from './pages/superadmin/SuperAdminCompanyDetail'
import SuperAdminPermissions from './pages/superadmin/SuperAdminPermissions'
import SuperAdminInvoices from './pages/superadmin/SuperAdminInvoices'
import Toast from './components/Toast'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router>
      <Toast />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/employee" element={isAuthenticated ? <Navigate to="/dashboard" /> : <EmployeePortal />} />
        <Route path="/employee/set-password" element={<SetPassword />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="teams" element={<Teams />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="leave" element={<Leave />} />
          <Route path="documents" element={<Documents />} />
          <Route path="letters" element={<Letters />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="reports" element={<Reports />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="employees/:id" element={<EmployeeProfile />} />
          <Route
            path="superadmin"
            element={
              <SuperAdminGuard>
                <SuperAdminLayout />
              </SuperAdminGuard>
            }
          >
            <Route index element={<SuperAdminCompanies />} />
            <Route path="companies" element={<SuperAdminCompanies />} />
            <Route path="companies/new" element={<SuperAdminCompanyNew />} />
            <Route path="companies/:id" element={<SuperAdminCompanyDetail />} />
            <Route path="invoices" element={<SuperAdminInvoices />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  )
}

export default App
