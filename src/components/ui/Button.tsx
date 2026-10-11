import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Bouton unique de GeoCollect.
 *   variant : primary (action principale) · secondary · danger · ghost · subtle
 *   size    : sm · md · lg · icon (bouton carré, `label` obligatoire pour l'accessibilité)
 *   loading : roue de chargement, bouton inactif
 *   disabledReason : bouton inactif ET explication affichée au survol (« Sélectionnez au moins une parcelle »)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'subtle'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface Props extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  disabledReason?: string
  /** texte de l'info-bulle (et nom accessible des boutons-icônes) */
  label?: string
  fullWidth?: boolean
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary-700 text-white shadow-sm hover:bg-primary-800 focus-visible:ring-primary-600/40',
  secondary: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus-visible:ring-gray-400/40',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500/40',
  ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-400/40',
  subtle: 'bg-primary-50 text-primary-800 hover:bg-primary-100 focus-visible:ring-primary-600/30',
}
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-base',
  icon: 'h-9 w-9 justify-center rounded-lg',
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, disabledReason, label, fullWidth, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  const off = disabled || loading || !!disabledReason
  return (
    // l'info-bulle reste visible sur un bouton inactif grâce à l'enveloppe
    <span title={disabledReason ?? label} className={`${fullWidth ? 'flex w-full' : 'inline-flex'} ${off ? 'cursor-not-allowed' : ''}`}>
      <button ref={ref} type={type} disabled={off} aria-label={size === 'icon' ? label : undefined} aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center font-medium whitespace-nowrap transition active:scale-[.98] focus:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50
          ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...rest}>
        {loading ? <Loader2 className={size === 'sm' ? 'h-3.5 w-3.5 animate-spin' : 'h-4 w-4 animate-spin'} /> : icon}
        {size !== 'icon' && children}
      </button>
    </span>
  )
})

export default Button
