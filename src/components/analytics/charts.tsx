import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART } from '../../theme/tokens'
import { fr } from '../../utils/lotSheet'

/**
 * Graphiques des tableaux de bord. Règles : une seule échelle par graphique, légende dès deux séries, textes en
 * encre (jamais dans la couleur de la série), info-bulle sur chaque barre, couleurs de série dans un ordre fixe.
 */

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`
export const tonnes = (kg: number) => (kg >= 10000 ? `${fr(kg / 1000, 1)} t` : `${fr(kg, 0)} kg`)

export function Panel({ title, subtitle, children, action, className = '' }:
  { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="font-semibold text-gray-900">{title}</h2>{subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** Chiffre clé : valeur, unité, contexte, et tendance éventuelle (texte, jamais la couleur seule). */
export function Kpi({ label, value, hint, trend, tone }:
  { label: string; value: string; hint?: string; trend?: number | null; tone?: 'danger' | 'warning' }) {
  const toneClass = tone === 'danger' ? 'text-danger-text' : tone === 'warning' ? 'text-warning-text' : 'text-gray-900'
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[13px] text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {trend != null && <p className="text-xs font-medium text-gray-600">{trend >= 0 ? '▲ +' : '▼ '}{fr(trend, 1)} % <span className="font-normal text-gray-400">vs campagne précédente</span></p>}
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

export interface Series<T> { key: keyof T & string; label: string; color: string }

/** Barres par période (une ou deux séries côte à côte, même unité) : par mois par défaut, ou par semaine. */
export function MonthlyBars<T extends object>({ data, series, unit = 'kg', height = 240, xKey = 'month', xFormat = monthLabel, period = 'mois', stacked = false }:
  { data: T[]; series: Series<T>[]; unit?: string; height?: number; xKey?: string; xFormat?: (v: string) => string; period?: string; stacked?: boolean }) {
  const fmt = (v: number) => (unit === 'kg' ? tonnes(v) : `${fr(v, 0)} ${unit}`)
  const axis = (v: number) => (unit === 'kg' ? `${fr(v / 1000, v < 10000 ? 1 : 0)} t` : fr(v, 0))
  return (
    <div role="img" aria-label={`${series.map((s) => s.label).join(' et ')} par ${period}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey={xKey} tickFormatter={(v) => xFormat(String(v))} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => axis(Number(v))} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
          <Tooltip cursor={{ fill: CHART.track }} labelFormatter={(m) => xFormat(String(m))}
            formatter={(v, name) => [fmt(Number(v)), String(name)]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
          {series.length > 1 && <Legend iconType="circle" itemSorter={null} wrapperStyle={{ fontSize: 12, color: CHART.axis }} />}
          {series.map((s, i) => <Bar key={s.key} dataKey={s.key as string} name={s.label} fill={s.color} maxBarSize={28}
            stackId={stacked ? 'a' : undefined} stroke={stacked ? '#ffffff' : undefined} strokeWidth={stacked ? 1 : 0}
            radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export const weekLabel = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** Classement en barres horizontales (une seule série) : libellé, valeur, part du maximum. */
export function RankBars({ rows, format = tonnes, color = CHART.series1, empty = 'Aucune donnée' }:
  { rows: { label: string; detail?: string; value: number }[]; format?: (v: number) => string; color?: string; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-gray-500">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ol className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label} : ${format(r.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-gray-800">{r.label}{r.detail && <span className="ml-1.5 text-xs text-gray-400">{r.detail}</span>}</span>
            <span className="shrink-0 tabular-nums text-gray-900">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded" style={{ background: CHART.track }}>
            <div className="h-2 rounded" style={{ width: `${(100 * r.value) / max}%`, background: color }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Composition d'un total (deux ou trois parts) : barre empilée + légende chiffrée. */
export function ShareBar({ parts, format = (v: number) => fr(v, 0) }:
  { parts: { label: string; value: number; color: string }[]; format?: (v: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded" role="img"
        aria-label={parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')}>
        {total === 0 ? <div className="h-3 w-full rounded" style={{ background: CHART.track }} />
          : parts.filter((p) => p.value > 0).map((p) => <div key={p.label} title={`${p.label} : ${format(p.value)}`} style={{ width: `${(100 * p.value) / total}%`, background: p.color }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5 text-gray-700">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.label} <span className="tabular-nums text-gray-900">{format(p.value)}</span>
            {total > 0 && <span className="text-xs text-gray-400">({fr((100 * p.value) / total, 0)} %)</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Chaîne de transformation (de la pesée à l'usine) : chaque étape rapportée à la première. */
export function Pipeline({ steps }: { steps: { label: string; kg: number }[] }) {
  const first = steps[0]?.kg || 0
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {steps.map((s, i) => (
        <li key={s.label} className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500">{i + 1}. {s.label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{tonnes(s.kg)}</p>
          <div className="mt-2 h-1.5 rounded" style={{ background: CHART.track }}>
            <div className="h-1.5 rounded" style={{ width: `${first ? Math.min(100, (100 * s.kg) / first) : 0}%`, background: CHART.series1 }} />
          </div>
          <p className="mt-1 text-[11px] text-gray-400">{first ? `${fr((100 * s.kg) / first, 0)} % des pesées` : '—'}</p>
        </li>
      ))}
    </ol>
  )
}
