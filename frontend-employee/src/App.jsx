import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Login from './pages/Login'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Teams from './pages/Teams'
import Leave from './pages/Leave'
import Documents from './pages/Documents'
import Payroll from './pages/Payroll'
import PersonalInfo from './pages/PersonalInfo'
import Toast from './components/Toast'
import SetPassword from './pages/SetPassword'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Router>
      <Toast />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="teams" element={<Teams />} />
          <Route path="leave" element={<Leave />} />
          <Route path="documents" element={<Documents />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="personal" element={<PersonalInfo />} />
        </Route>
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
