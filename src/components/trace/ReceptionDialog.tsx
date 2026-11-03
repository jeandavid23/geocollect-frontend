import { useState } from 'react'
import { CheckCircle2, PackageCheck, ShieldAlert, X, XCircle } from 'lucide-react'
import Button from '../ui/Button'
import { DECISIONS, QUALITY_FIELDS, traceApi, type Decision, type QualityField, type TransportSlip } from '../../api/trace'
import { fr } from '../../utils/lotSheet'
import { apiErrorMessage, withRetry } from '../../utils/retry'

/** Grades de l'épreuve à la coupe (moisies, ardoisées, mitées + germées) : même règle que le serveur. */
const GRADES: [string, number, number, number][] = [['Grade I', 3, 3, 3], ['Grade II', 4, 8, 6]]
const DECISION_STYLE: Record<Decision, { icon: React.ReactNode; on: string }> = {
  accepte: { icon: <CheckCircle2 className="h-5 w-5" />, on: 'border-success-solid bg-success-bg text-success-text' },
  reserve: { icon: <ShieldAlert className="h-5 w-5" />, on: 'border-warning-solid bg-warning-bg text-warning-text' },
  refuse: { icon: <XCircle className="h-5 w-5" />, on: 'border-danger-solid bg-danger-bg text-danger-text' },
}
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

export function gradeOf(q: Partial<Record<QualityField, number | null>>): string | null {
  if (q.mouldy_pct == null || q.slaty_pct == null) return null
  const defects = (q.insect_pct ?? 0) + (q.germinated_pct ?? 0)
  return GRADES.find(([, m, s, d]) => q.mouldy_pct! <= m && q.slaty_pct! <= s && defects <= d)?.[0] ?? 'Hors standard'
}

interface Props { slip: TransportSlip; onClose: () => void; onSaved: (s: TransportSlip) => void }

/**
 * Réception d'un camion à l'usine, pensée pour une tablette au pont-bascule : poids à l'arrivée, contrôle qualité
 * (épreuve à la coupe), décision. Envoi répété automatiquement si le réseau est instable.
 */
export default function ReceptionDialog({ slip, onClose, onSaved }: Props) {
  const [weight, setWeight] = useState(String(slip.gross_weight_kg))
  const [q, setQ] = useState<Record<string, string>>({})
  const [decision, setDecision] = useState<Decision>('accepte')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const values = Object.fromEntries(QUALITY_FIELDS.map(({ key }) => [key, num(q[key] ?? '')])) as Record<QualityField, number | null>
  const received = num(weight)
  const gross = Number(slip.gross_weight_kg)
  const gapPct = received != null && gross ? (100 * (received - gross)) / gross : null
  const grade = gradeOf(values)
  const outOfNorm = QUALITY_FIELDS.filter(({ key, limit }) => values[key] != null && values[key]! > limit)
  const missing = decision !== 'refuse' && (received == null || !(received > 0)) ? "Indiquez le poids pesé à l'arrivée"
    : decision !== 'accepte' && !reason.trim() ? 'Indiquez le motif des réserves ou du refus' : undefined

  const save = async () => {
    setBusy(true); setError('')
    try {
      const { data } = await withRetry(() => traceApi.receiveSlip(slip.id, {
        ...values, received_weight_kg: received, decision, decision_reason: reason.trim(), reception_notes: notes.trim() }))
      onSaved(data)
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }

  const big = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-lg tabular-nums focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600'
  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="reception-title" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[95dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="reception-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900"><PackageCheck className="h-5 w-5 text-primary-700" />Réception de {slip.number}</p>
            <p className="text-sm text-gray-500">{slip.cooperative_name} · lot {slip.lot_code} · camion {slip.vehicle_plate} · {slip.driver_name}{slip.seals ? ` · plombs ${slip.seals}` : ''}</p>
          </div>
          <Button size="icon" variant="ghost" label="Fermer" icon={<X className="h-5 w-5" />} onClick={onClose} />
        </div>

        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Poids au départ</p>
            <p className="text-2xl font-semibold tabular-nums text-gray-900">{fr(gross)} kg</p>
            <p className="text-xs text-gray-500">{slip.bags} sacs</p>
          </div>
          <label className="text-sm font-medium text-gray-700">Poids pesé à l'arrivée (kg)
            <input autoFocus inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={big} />
            {gapPct != null && <span className={`mt-1 block text-sm ${Math.abs(gapPct) > 1 ? 'font-semibold text-danger-text' : 'text-gray-500'}`}>
              Écart {fr(received! - gross)} kg ({gapPct > 0 ? '+' : ''}{fr(gapPct, 2)} %)</span>}
          </label>
        </section>

        <section className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">Contrôle qualité <span className="font-normal text-gray-500">(épreuve à la coupe sur 300 fèves, facultatif)</span></p>
            {grade && <span className={`rounded-full px-3 py-1 text-sm font-semibold ${grade === 'Hors standard' ? 'bg-danger-bg text-danger-text' : 'bg-success-bg text-success-text'}`}>{grade}</span>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUALITY_FIELDS.map(({ key, label, unit, limit }) => {
              const over = values[key] != null && values[key]! > limit
              return (
                <label key={key} className="text-xs text-gray-600">{label} <span className="text-gray-400">({unit})</span>
                  <input inputMode="decimal" value={q[key] ?? ''} onChange={(e) => setQ({ ...q, [key]: e.target.value })}
                    className={`${big} ${over ? 'border-danger-solid text-danger-text' : ''}`} aria-invalid={over} />
                  <span className={`text-[11px] ${over ? 'font-semibold text-danger-text' : 'text-gray-400'}`}>max. {limit}</span>
                </label>
              )
            })}
          </div>
          {outOfNorm.length > 0 && <p className="mt-2 text-sm text-danger-text">Hors norme : {outOfNorm.map((f) => f.label.toLowerCase()).join(', ')}.</p>}
        </section>

        <section className="mt-5">
          <p className="text-sm font-semibold text-gray-900">Décision</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Décision">
            {(Object.keys(DECISIONS) as Decision[]).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={decision === d} onClick={() => setDecision(d)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition ${decision === d ? DECISION_STYLE[d].on : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                {DECISION_STYLE[d].icon}{DECISIONS[d]}
              </button>
            ))}
          </div>
          {decision !== 'accepte' && (
            <label className="mt-3 block text-sm text-gray-700">Motif {decision === 'refuse' ? 'du refus' : 'des réserves'} (envoyé à la coopérative)
              <input value={reason} onChange={(e) => setReason(e.target.value)} className={big} placeholder="Ex. humidité 9 %, fèves moisies" />
            </label>
          )}
          {decision === 'refuse' && <p className="mt-2 text-sm text-gray-600">Le lot retourne à la coopérative, qui pourra le réexpédier. Il ne pourra pas entrer en usinage.</p>}
          <label className="mt-3 block text-sm text-gray-700">Observations
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </section>

        {error && <p role="alert" className="mt-3 text-sm text-danger-text">{error}</p>}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button size="lg" loading={busy} disabledReason={missing} onClick={save}
            variant={decision === 'refuse' ? 'danger' : 'primary'}>Enregistrer la réception</Button>
        </div>
      </div>
    </div>
  )
}
