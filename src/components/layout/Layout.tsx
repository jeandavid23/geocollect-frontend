import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Toaster from './Toaster'

export default function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <Toaster />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {/* apparition en douceur à chaque changement de page */}
          <div key={pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
