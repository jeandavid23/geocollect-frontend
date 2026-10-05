interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color?: string
  trend?: { value: number; label: string }
}

// `color` est conservé dans la signature (appels existants) mais n'est plus utilisé : une seule couleur d'accent
export default function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] text-gray-500">{title}</p>
          <p className="text-[28px] font-semibold text-gray-900 mt-1 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-2 font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className="text-gray-400 [&>svg]:w-5 [&>svg]:h-5">
          {icon}
        </div>
      </div>
    </div>
  )
}
