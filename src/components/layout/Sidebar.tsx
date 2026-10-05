import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, Users, MapPin, Building2, UserCog,
  FileBarChart, Leaf, LogOut, ChevronLeft, ChevronRight,
  Activity, Wifi, WifiOff, Satellite, KeyRound, UserCircle, TreePine, BookOpen, ShieldCheck, Crown, Globe2, Scissors, Link2,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import NotificationsBell from './NotificationsBell'
import type { ModuleId, UserRole } from '../../types'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  roles: UserRole[]
  module?: ModuleId // masqué si le module n'est pas dans la licence de l'organisation
}

const NAV_ITEMS: NavItem[] = [
  // Propriétaire de la plateforme (Super Super Admin)
  { label: 'Plateforme', to: '/owner', icon: <Globe2 className="w-5 h-5" />, roles: ['owner'] },
  { label: 'Super admins (clients)', to: '/owner/admins', icon: <Crown className="w-5 h-5" />, roles: ['owner'] },
  // Super Admin (et propriétaire, sur tous les clients)
  { label: 'Tableau de bord', to: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['super_admin', 'owner'] },
  { label: 'Coopératives', to: '/admin/cooperatives', icon: <Building2 className="w-5 h-5" />, roles: ['super_admin', 'owner'] },
  { label: 'Agents Mappeurs', to: '/admin/agents', icon: <UserCog className="w-5 h-5" />, roles: ['super_admin', 'owner'] },
  { label: 'Comptes & Accès', to: '/admin/accounts', icon: <KeyRound className="w-5 h-5" />, roles: ['super_admin', 'owner'] },
  { label: 'Rapports', to: '/admin/reports', icon: <FileBarChart className="w-5 h-5" />, roles: ['super_admin', 'owner'] },
  { label: 'Journaux', to: '/admin/logs', icon: <Activity className="w-5 h-5" />, roles: ['super_admin', 'owner'] },
  // Cooperative
  { label: 'Tableau de bord', to: '/coop', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Producteurs', to: '/coop/producers', icon: <Users className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Registre', to: '/coop/registry', icon: <BookOpen className="w-5 h-5" />, roles: ['cooperative'], module: 'registry' },
  { label: 'Parcelles', to: '/coop/parcels', icon: <MapPin className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Agents', to: '/coop/agents', icon: <UserCog className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Rapports', to: '/coop/reports', icon: <FileBarChart className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Analyse déforestation', to: '/coop/deforestation', icon: <TreePine className="w-5 h-5" />, roles: ['cooperative'], module: 'deforestation' },
  { label: 'Polygon Validator', to: '/coop/validator', icon: <ShieldCheck className="w-5 h-5" />, roles: ['cooperative'], module: 'validator' },
  { label: 'Self-intersection', to: '/coop/selfintersection', icon: <Scissors className="w-5 h-5" />, roles: ['cooperative'], module: 'selfintersection' },
  { label: 'Polygon & GMR', to: '/coop/gmr', icon: <Link2 className="w-5 h-5" />, roles: ['cooperative'], module: 'gmr' },
  // Agent
  { label: 'Tableau de bord', to: '/agent', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['agent'] },
  { label: 'Producteurs à mapper', to: '/agent/producers', icon: <Users className="w-5 h-5" />, roles: ['agent'] },
  { label: 'Nouveau Mapping', to: '/agent/mapping', icon: <Satellite className="w-5 h-5" />, roles: ['agent'] },
  { label: 'Mes Parcelles', to: '/agent/parcels', icon: <MapPin className="w-5 h-5" />, roles: ['agent'] },
  // Carte interactive : tous les rôles (l'agent y voit toutes les parcelles et anciens polygones de sa coopérative)
  { label: 'Carte Interactive', to: '/map', icon: <Map className="w-5 h-5" />, roles: ['owner', 'super_admin', 'cooperative', 'agent'] },
  // Mon compte : tous les rôles
  { label: 'Mon compte', to: '/account', icon: <UserCircle className="w-5 h-5" />, roles: ['owner', 'super_admin', 'cooperative', 'agent'] },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const { isOnline } = useAppStore()

  const role = user?.role ?? 'agent'
  const modules = user?.modules ?? null // null = tous
  const filtered = NAV_ITEMS.filter((item) =>
    item.roles.includes(role) && (!item.module || modules === null || modules.includes(item.module)))

  const handleLogout = async () => {
    useAppStore.getState().clearData()
    await logout()
    // rechargement complet : plus rien du compte précédent en mémoire pour le compte suivant
    window.location.replace('/login')
  }

  return (
    <aside
      className={`relative flex flex-col bg-primary-900 text-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      } min-h-screen flex-shrink-0`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-primary-700">
        <div className="flex-shrink-0 w-9 h-9 bg-white rounded-xl flex items-center justify-center">
          <Leaf className="w-5 h-5 text-primary-600" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight">GeoCollect</p>
            <p className="text-primary-300 text-xs">Traçabilité cacao · EUDR</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-0.5 px-2">
          {filtered.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin' || item.to === '/coop' || item.to === '/agent' || item.to === '/owner'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow'
                    : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                }`
              }
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-primary-700 p-3 space-y-2">
        {/* Online status */}
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
          isOnline ? 'text-green-300' : 'text-red-300'
        }`}>
          {isOnline ? <Wifi className="w-4 h-4 flex-shrink-0" /> : <WifiOff className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && (isOnline ? 'En ligne' : 'Hors ligne')}
        </div>

        {/* Notifications (connectées au backend) */}
        <NotificationsBell collapsed={collapsed} />

        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-xs text-primary-400 capitalize">{
              role === 'owner' ? 'Super Super Admin' :
              role === 'super_admin' ? 'Super Administrateur' :
              role === 'cooperative' ? 'Coopérative' : 'Agent Mappeur'
            }</p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-red-300 hover:bg-red-900/30 hover:text-red-200 text-sm transition"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && 'Déconnexion'}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-primary-700 rounded-full flex items-center justify-center text-white hover:bg-primary-600 transition shadow-md z-10"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  )
}
