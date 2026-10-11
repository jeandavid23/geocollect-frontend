import { useT, LangSwitch } from '../../i18n'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Map, Users, MapPin, Building2, UserCog,
  FileBarChart, Leaf, LogOut, ChevronLeft, ChevronRight,
  Activity, Wifi, WifiOff, Satellite, KeyRound, UserCircle, TreePine, BookOpen, ShieldCheck, Crown, Globe2, Scissors, Link2, Package, Layers, FileCheck2, Route, Trash, Search, Bell, Inbox,
} from 'lucide-react'
import { useState } from 'react'
import { openCommandPalette } from '../../utils/search'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import NotificationsBell from './NotificationsBell'
import type { ModuleId, UserRole } from '../../types'

export interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  roles: UserRole[]
  module?: ModuleId // masqué si le module n'est pas dans la licence de l'organisation
  group?: string    // rubrique du menu (titre affiché au-dessus du premier lien de la rubrique)
}

export const NAV_ITEMS: NavItem[] = [
  // Propriétaire de la plateforme (Super Super Admin)
  { label: 'Plateforme', to: '/owner', icon: <Globe2 className="w-5 h-5" />, roles: ['owner'], group: 'Propriétaire' },
  { label: 'Clients (super admins)', to: '/owner/admins', icon: <Crown className="w-5 h-5" />, roles: ['owner'], group: 'Propriétaire' },
  { label: 'Prospects', to: '/owner/prospects', icon: <Inbox className="w-5 h-5" />, roles: ['owner'], group: 'Propriétaire' },
  { label: 'Corbeille', to: '/owner/trash', icon: <Trash className="w-5 h-5" />, roles: ['owner'], group: 'Propriétaire' },
  // Super Admin (et propriétaire, sur tous les clients)
  { label: 'Tableau de bord', to: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['super_admin', 'owner'], group: 'Pilotage' },
  { label: 'Carte interactive', to: '/map', icon: <Map className="w-5 h-5" />, roles: ['super_admin', 'owner'], group: 'Pilotage' },
  { label: 'Coopératives', to: '/admin/cooperatives', icon: <Building2 className="w-5 h-5" />, roles: ['super_admin', 'owner'], group: 'Organisation' },
  { label: 'Agents mappeurs', to: '/admin/agents', icon: <UserCog className="w-5 h-5" />, roles: ['super_admin', 'owner'], group: 'Organisation' },
  { label: 'Comptes & accès', to: '/admin/accounts', icon: <KeyRound className="w-5 h-5" />, roles: ['super_admin', 'owner'], group: 'Organisation' },
  { label: 'Rapports', to: '/admin/reports', icon: <FileBarChart className="w-5 h-5" />, roles: ['super_admin', 'owner'], group: 'Suivi' },
  { label: 'Journaux', to: '/admin/logs', icon: <Activity className="w-5 h-5" />, roles: ['super_admin', 'owner'], group: 'Suivi' },
  // Coopérative : dans l'ordre du travail (base → parcelles et contrôles → export)
  { label: 'Tableau de bord', to: '/coop', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['cooperative'], group: 'Pilotage' },
  { label: 'Carte interactive', to: '/map', icon: <Map className="w-5 h-5" />, roles: ['cooperative'], group: 'Pilotage' },
  { label: 'Registre', to: '/coop/registry', icon: <BookOpen className="w-5 h-5" />, roles: ['cooperative'], module: 'registry', group: 'Base' },
  { label: 'Producteurs', to: '/coop/producers', icon: <Users className="w-5 h-5" />, roles: ['cooperative'], group: 'Base' },
  { label: 'Agents', to: '/coop/agents', icon: <UserCog className="w-5 h-5" />, roles: ['cooperative'], group: 'Base' },
  { label: 'Parcelles', to: '/coop/parcels', icon: <MapPin className="w-5 h-5" />, roles: ['cooperative'], group: 'Parcelles & conformité' },
  { label: 'Contrôle spatial', to: '/coop/spatial', icon: <Layers className="w-5 h-5" />, roles: ['cooperative'], group: 'Parcelles & conformité' },
  { label: 'Analyse déforestation', to: '/coop/deforestation', icon: <TreePine className="w-5 h-5" />, roles: ['cooperative'], module: 'deforestation', group: 'Parcelles & conformité' },
  { label: 'Polygon Validator', to: '/coop/validator', icon: <ShieldCheck className="w-5 h-5" />, roles: ['cooperative'], module: 'validator', group: 'Parcelles & conformité' },
  { label: 'Self-intersection', to: '/coop/selfintersection', icon: <Scissors className="w-5 h-5" />, roles: ['cooperative'], module: 'selfintersection', group: 'Parcelles & conformité' },
  { label: 'Polygon & GMR', to: '/coop/gmr', icon: <Link2 className="w-5 h-5" />, roles: ['cooperative'], module: 'gmr', group: 'Parcelles & conformité' },
  { label: 'Fiches de lot', to: '/coop/lots', icon: <Package className="w-5 h-5" />, roles: ['cooperative'], module: 'lots', group: 'Export' },
  { label: 'Export TRACES', to: '/coop/reports#traces', icon: <FileCheck2 className="w-5 h-5" />, roles: ['cooperative'], group: 'Export' },
  { label: 'Rapports', to: '/coop/reports', icon: <FileBarChart className="w-5 h-5" />, roles: ['cooperative'], group: 'Export' },
  // Agent : la tournée d'abord
  { label: 'Ma tournée', to: '/agent/producers', icon: <Route className="w-5 h-5" />, roles: ['agent'], group: 'Terrain' },
  { label: 'Nouveau mapping', to: '/agent/mapping', icon: <Satellite className="w-5 h-5" />, roles: ['agent'], group: 'Terrain' },
  { label: 'Carte', to: '/map', icon: <Map className="w-5 h-5" />, roles: ['agent'], group: 'Terrain' },
  { label: 'Mon activité', to: '/agent', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['agent'], group: 'Activité' },
  { label: 'Mes parcelles', to: '/agent/parcels', icon: <MapPin className="w-5 h-5" />, roles: ['agent'], group: 'Activité' },
  // Mon compte : tous les rôles
  { label: 'Notifications', to: '/notifications', icon: <Bell className="w-5 h-5" />, roles: ['owner', 'super_admin', 'cooperative', 'agent'], group: 'Compte' },
  { label: 'Mon compte', to: '/account', icon: <UserCircle className="w-5 h-5" />, roles: ['owner', 'super_admin', 'cooperative', 'agent'], group: 'Compte' },
]

/** Menu latéral ; sur téléphone (< 768 px) c'est un tiroir ouvert par le bouton ☰ de la barre du haut. */
// Libellés anglais du menu (le français reste la source)
export const EN: Record<string, string> = {
  'Propriétaire': 'Owner', 'Pilotage': 'Overview', 'Organisation': 'Organisation', 'Suivi': 'Monitoring', 'Base': 'Records',
  'Parcelles & conformité': 'Plots & compliance', 'Export': 'Export', 'Terrain': 'Field', 'Activité': 'Activity', 'Compte': 'Account',
  'Plateforme': 'Platform', 'Clients (super admins)': 'Clients (super admins)', 'Prospects': 'Leads', 'Corbeille': 'Recycle bin',
  'Tableau de bord': 'Dashboard', 'Carte interactive': 'Interactive map', 'Coopératives': 'Cooperatives', 'Agents mappeurs': 'Field agents',
  'Comptes & accès': 'Accounts & access', 'Rapports': 'Reports', 'Journaux': 'Logs', 'Registre': 'Register', 'Producteurs': 'Farmers',
  'Agents': 'Agents', 'Parcelles': 'Plots', 'Contrôle spatial': 'Spatial checks', 'Analyse déforestation': 'Deforestation analysis',
  'Fiches de lot': 'Lot sheets', 'Export TRACES': 'TRACES export', 'Ma tournée': 'My round', 'Nouveau mapping': 'New mapping', 'Carte': 'Map',
  'Mon activité': 'My activity', 'Mes parcelles': 'My plots', 'Notifications': 'Notifications', 'Mon compte': 'My account',
}

export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const [collapsedPref, setCollapsed] = useState(false)
  const collapsed = collapsedPref && !mobileOpen
  const { user, logout } = useAuthStore()
  const { isOnline } = useAppStore()
  const location = useLocation()
  const t = useT()

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
      className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-primary-900 text-white transition-all duration-300 md:relative md:z-auto md:translate-x-0 ${
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      } ${collapsed ? 'w-16' : 'w-64'} min-h-screen flex-shrink-0`}
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

      {/* Recherche globale (Ctrl+K) */}
      <div className="px-2 pt-3">
        <button onClick={() => { onClose?.(); openCommandPalette() }} title="Recherche globale (Ctrl+K)"
          className={`flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-primary-200 transition hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}>
          <Search className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <><span className="flex-1 text-left">{t('Rechercher…', 'Search…')}</span><kbd className="rounded border border-white/20 px-1.5 text-[10px] text-primary-300">Ctrl K</kbd></>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-0.5 px-2">
          {filtered.map((item, i) => {
            const [path, hash] = item.to.split('#')
            const heading = item.group && item.group !== filtered[i - 1]?.group
            // un lien vers une ancre (#traces) n'est actif que sur cette ancre ; la page sans ancre ne l'est plus
            const active = (base: boolean) => hash ? location.pathname === path && location.hash === `#${hash}`
              : base && !(filtered.some((o) => o.to.startsWith(`${item.to}#`) && location.hash === `#${o.to.split('#')[1]}`))
            return (
              <div key={item.to + item.label}>
                {heading && (collapsed
                  ? <div className={`mx-3 ${i ? 'my-2' : 'mb-2'} border-t border-white/10`} />
                  : <p className={`px-3 pb-1 ${i ? 'pt-4' : 'pt-0'} text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300/70`}>{t(item.group!, EN[item.group!])}</p>)}
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  end={item.to === '/admin' || item.to === '/coop' || item.to === '/agent' || item.to === '/owner'}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-200 ${
                      active(isActive)
                        ? 'bg-white/10 text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-[#e9c98b]'
                        : 'text-primary-200 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{t(item.label, EN[item.label])}</span>}
                </NavLink>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-primary-700 p-3 space-y-2">
        {/* Online status */}
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${
          isOnline ? 'text-green-300' : 'text-red-300'
        }`}>
          {isOnline ? <Wifi className="w-4 h-4 flex-shrink-0" /> : <WifiOff className="w-4 h-4 flex-shrink-0" />}
          {!collapsed && (isOnline ? t('En ligne', 'Online') : t('Hors ligne', 'Offline'))}
          {!collapsed && <LangSwitch dark className="ml-auto" />}
        </div>

        {/* Notifications (connectées au backend) */}
        <NotificationsBell collapsed={collapsed} />

        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-xs text-primary-400 capitalize">{
              role === 'owner' ? t('Super Super Admin', 'Platform owner') :
              role === 'super_admin' ? t('Super Administrateur', 'Super administrator') :
              role === 'cooperative' ? t('Coopérative', 'Cooperative') : t('Agent Mappeur', 'Field agent')
            }</p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-red-300 hover:bg-red-900/30 hover:text-red-200 text-sm transition"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && t('Déconnexion', 'Sign out')}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsedPref)}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-primary-700 rounded-full flex items-center justify-center text-white hover:bg-primary-600 transition shadow-md z-10"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  )
}
