import { Suspense, useEffect, useState } from 'react'
import { Menu, Leaf, Search } from 'lucide-react'
import CommandPalette from './CommandPalette'
import { UndoHost } from '../ui/undo'
import { openCommandPalette } from '../../utils/search'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Toaster from './Toaster'
import { useIdleLogout } from '../../hooks/useIdleLogout'

export default function Layout() {
  const { pathname, search } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useIdleLogout()
  useEffect(() => { setMenuOpen(false) }, [pathname])
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* fond sombre derrière le tiroir du menu (téléphone) */}
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden />}
      <Toaster />
      <CommandPalette />
      <UndoHost />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* barre du haut sur téléphone : bouton du menu */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5 md:hidden">
          <button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-100"><Menu className="h-6 w-6" /></button>
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Leaf className="h-4 w-4 text-primary-700" /> GeoCollect</span>
          <button onClick={openCommandPalette} aria-label="Rechercher" className="ml-auto rounded-lg p-1.5 text-gray-700 hover:bg-gray-100"><Search className="h-5 w-5" /></button>
        </div>
        <main className="flex-1 overflow-y-auto">
          {/* apparition en douceur à chaque changement de page */}
          <div key={pathname + search} className="animate-page-in">
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
