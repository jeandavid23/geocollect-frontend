import { Suspense } from 'react'
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
            {/* la barre latérale reste affichée pendant le chargement d'une page */}
            <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" /></div>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
