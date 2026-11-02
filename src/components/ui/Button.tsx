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
  primary: 'bg-primary-700 text-white shadow-sm hover:bg-primary-800 disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none',
  secondary: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-400 disabled:text-gray-500',
  danger: 'bg-danger-solid text-white shadow-sm hover:bg-[#912018] disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none',
  ghost: 'text-primary-700 hover:bg-primary-50 disabled:text-gray-500',
  subtle: 'bg-primary-50 text-primary-800 hover:bg-primary-100 disabled:text-gray-500',
}
// 3 tailles (32, 40, 48 px) ; « lg » pour les écrans de terrain (agent, usine), utilisés au pouce
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-md px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-md px-4 text-sm',
  lg: 'h-12 gap-2 rounded-md px-5 text-base',
  icon: 'h-9 w-9 justify-center rounded-md',
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
        className={`inline-flex items-center justify-center font-semibold whitespace-nowrap transition active:scale-[.98] disabled:pointer-events-none
          ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...rest}>
        {loading ? <Loader2 className={size === 'sm' ? 'h-3.5 w-3.5 animate-spin' : 'h-4 w-4 animate-spin'} /> : icon}
        {size !== 'icon' && children}
      </button>
    </span>
  )
})

export default Button
