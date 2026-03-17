import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Toast from './components/Toast'
import SetPassword from './pages/SetPassword'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import EmployeeProfile from './pages/EmployeeProfile'
import Teams from './pages/Teams'
import Attendance from './pages/Attendance'
import Leave from './pages/Leave'
import Documents from './pages/Documents'
import Letters from './pages/Letters'
import Payroll from './pages/Payroll'
import Reports from './pages/Reports'
import Announcements from './pages/Announcements'
import Roles from './pages/Roles'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router basename="/admin">
      <Toast />
      <Routes>
        <Route
          path="/set-password"
          element={<SetPassword />}
        />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/:id" element={<EmployeeProfile />} />
          <Route path="teams" element={<Teams />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="leave" element={<Leave />} />
          <Route path="documents" element={<Documents />} />
          <Route path="letters" element={<Letters />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="reports" element={<Reports />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="roles" element={<Roles />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App

