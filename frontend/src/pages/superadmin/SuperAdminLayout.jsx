import { Outlet, Link, useLocation } from 'react-router-dom'
import { Building2, FileText } from 'lucide-react'

const tabs = [
  { name: 'Companies', path: '/superadmin/companies', icon: Building2 },
  { name: 'Invoices', path: '/superadmin/invoices', icon: FileText },
]

const SuperAdminLayout = () => {
  const location = useLocation()
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Tenants</h1>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                isActive(tab.path)
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </Link>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}

export default SuperAdminLayout
