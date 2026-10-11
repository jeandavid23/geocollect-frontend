import { useNavigate } from 'react-router-dom'
import Button from './Button'

export interface EmptyAction { label: string; icon?: React.ReactNode; to?: string; onClick?: () => void; primary?: boolean }

/** Page ou liste vide : ce qu'il faut faire ensuite, avec les boutons pour le faire (au lieu de « Aucun résultat »). */
export default function EmptyState({ icon, title, text, actions = [], steps }: {
  icon?: React.ReactNode; title: string; text?: React.ReactNode; actions?: EmptyAction[]; steps?: string[]
}) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">{icon}</div>}
      <p className="text-base font-semibold text-gray-900">{title}</p>
      {text && <p className="mt-1 max-w-lg text-sm text-gray-500">{text}</p>}
      {steps && (
        <ol className="mt-4 max-w-md space-y-1.5 text-left text-sm text-gray-600">
          {steps.map((s, i) => <li key={s} className="flex gap-2"><span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-semibold text-primary-800">{i + 1}</span>{s}</li>)}
        </ol>
      )}
      {actions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actions.map((a, i) => (
            <Button key={a.label} variant={a.primary ?? i === 0 ? 'primary' : 'secondary'} icon={a.icon}
              onClick={() => (a.to ? navigate(a.to) : a.onClick?.())}>{a.label}</Button>
          ))}
        </div>
      )}
    </div>
  )
}
