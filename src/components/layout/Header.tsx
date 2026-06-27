import { RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface HeaderProps {
  title: string
  subtitle?: string
}

export default function Header({ title, subtitle }: HeaderProps) {
  const user = useAuthStore((s) => s.user)
  const { isOnline, isSyncing } = useAppStore()

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Date */}
        <span className="text-sm text-gray-500 hidden md:block">
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        </span>

        {/* Sync indicator */}
        {isSyncing && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Synchronisation...
          </div>
        )}

        {/* Online badge */}
        <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${
          isOnline
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} ${isOnline ? 'animate-pulse' : ''}`} />
          {isOnline ? 'En ligne' : 'Hors ligne'}
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
          <span className="text-primary-700 font-bold text-sm">
            {user?.fullName?.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  )
}
