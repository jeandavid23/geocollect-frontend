import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Map, Users, MapPin, Building2, UserCog,
  FileBarChart, Leaf, LogOut, Bell, ChevronLeft, ChevronRight,
  Activity, Wifi, WifiOff, Satellite, KeyRound, UserCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import type { UserRole } from '../../types'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  // Super Admin
  { label: 'Tableau de bord', to: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['super_admin'] },
  { label: 'Coopératives', to: '/admin/cooperatives', icon: <Building2 className="w-5 h-5" />, roles: ['super_admin'] },
  { label: 'Agents Mappeurs', to: '/admin/agents', icon: <UserCog className="w-5 h-5" />, roles: ['super_admin'] },
  { label: 'Comptes & Accès', to: '/admin/accounts', icon: <KeyRound className="w-5 h-5" />, roles: ['super_admin'] },
  { label: 'Journaux', to: '/admin/logs', icon: <Activity className="w-5 h-5" />, roles: ['super_admin'] },
  // Cooperative
  { label: 'Tableau de bord', to: '/coop', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Producteurs', to: '/coop/producers', icon: <Users className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Parcelles', to: '/coop/parcels', icon: <MapPin className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Agents', to: '/coop/agents', icon: <UserCog className="w-5 h-5" />, roles: ['cooperative'] },
  { label: 'Rapports', to: '/coop/reports', icon: <FileBarChart className="w-5 h-5" />, roles: ['cooperative'] },
  // Agent
  { label: 'Tableau de bord', to: '/agent', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['agent'] },
  { label: 'Nouveau Mapping', to: '/agent/mapping', icon: <Satellite className="w-5 h-5" />, roles: ['agent'] },
  { label: 'Mes Parcelles', to: '/agent/parcels', icon: <MapPin className="w-5 h-5" />, roles: ['agent'] },
  // Shared
  { label: 'Carte Interactive', to: '/map', icon: <Map className="w-5 h-5" />, roles: ['super_admin', 'cooperative', 'agent'] },
  { label: 'Mon compte', to: '/account', icon: <UserCircle className="w-5 h-5" />, roles: ['super_admin', 'cooperative', 'agent'] },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const { isOnline, notifications } = useAppStore()
  const navigate = useNavigate()

  const role = user?.role ?? 'agent'
  const filtered = NAV_ITEMS.filter((item) => item.roles.includes(role))
  const unread = notifications.filter((n) => !n.read).length

  const handleLogout = () => {
    logout()
    navigate('/login')
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
            <p className="text-primary-300 text-xs">EUDR Platform</p>
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
              end={item.to === '/admin' || item.to === '/coop' || item.to === '/agent'}
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

        {/* Notifications */}
        <button className="relative flex items-center gap-3 w-full px-3 py-2 rounded-xl text-primary-200 hover:bg-primary-800 hover:text-white text-sm transition">
          <Bell className="w-5 h-5 flex-shrink-0" />
          {!collapsed && 'Notifications'}
          {unread > 0 && (
            <span className="absolute top-1 left-6 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-xs text-primary-400 capitalize">{
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
