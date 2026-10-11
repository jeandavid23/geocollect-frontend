import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertOctagon, ListTodo, Info, CheckCircle2, ArrowRight, RefreshCw, Loader2, Check } from 'lucide-react'
import { coopActionsApi, type CoopActionsResponse } from '../../api/dashboard'
import { useAuthStore } from '../../store/authStore'
import type { ModuleId } from '../../types'

const LEVEL = {
  urgent: { icon: AlertOctagon, ring: 'border-red-200 bg-red-50/60', text: 'text-red-700' },
  todo: { icon: ListTodo, ring: 'border-amber-200 bg-amber-50/50', text: 'text-amber-800' },
  info: { icon: Info, ring: 'border-gray-200 bg-gray-50', text: 'text-gray-700' },
} as const

// actions sans nombre à afficher (« aucun agent », « analyse à refaire »)
const NO_COUNT = new Set(['no_agent', 'deforestation'])
const n = (v: number) => v.toLocaleString('fr-FR')

/** Avancement vers l'export (4 étapes) et liste des prochaines actions, chacune menant à la page où la faire. */
export default function NextActions() {
  const modules = useAuthStore((s) => s.user?.modules ?? null)
  const [data, setData] = useState<CoopActionsResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async (refresh = false) => {
    setBusy(true); setFailed(false)
    try { setData((await coopActionsApi.get(refresh)).data) } catch { setFailed(true) } finally { setBusy(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (!data) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-500">
        {failed ? <span>Prochaines actions indisponibles. <button onClick={() => load()} className="underline">Réessayer</button></span>
          : <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Analyse de vos données…</span>}
      </section>
    )
  }

  const actions = data.actions.filter((a) => !a.module || modules === null || modules.includes(a.module as ModuleId))
  const doneSteps = data.steps.filter((s) => s.done).length
  const current = data.steps.findIndex((s) => !s.done)

  return (
    <section className="space-y-4">
      {/* Avancement vers l'export */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">Avancement vers l'export EUDR</p>
            <p className="text-xs text-gray-500">{doneSteps}/4 étapes terminées</p>
          </div>
          <button onClick={() => load(true)} disabled={busy} title="Relancer les contrôles"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Actualiser
          </button>
        </div>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {data.steps.map((s, i) => (
            <li key={s.key}>
              <Link to={s.to} className={`group block h-full rounded-xl border p-3 transition hover:shadow-sm ${
                s.done ? 'border-green-200 bg-green-50/60' : i === current ? 'border-primary-300 bg-primary-50/40 ring-1 ring-primary-200' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    s.done ? 'bg-green-600 text-white' : i === current ? 'bg-primary-700 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{s.label}</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">{s.detail}</p>
                {s.progress != null && !s.done && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${Math.max(2, s.progress)}%` }} />
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {/* Prochaines actions */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="font-semibold text-gray-900">Prochaines actions</p>
          <p className="text-[11px] text-gray-400">Contrôles du {new Date(data.spatial_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
        </div>
        {actions.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" />Rien à signaler : vos données sont prêtes.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {actions.map((a) => {
              const L = LEVEL[a.level]
              const Icon = L.icon
              return (
                <li key={a.key}>
                  <Link to={a.to} className={`group flex h-full items-start gap-3 rounded-xl border p-3 transition hover:shadow-sm ${L.ring}`}>
                    <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${L.text}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">
                        {!NO_COUNT.has(a.key) && <b className="tabular-nums">{n(a.count)} </b>}
                        {NO_COUNT.has(a.key) ? a.title.charAt(0).toUpperCase() + a.title.slice(1) : a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{a.detail}</p>
                    </div>
                    <span className={`flex flex-shrink-0 items-center gap-1 self-center whitespace-nowrap text-xs font-medium ${L.text}`}>
                      {a.cta} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
