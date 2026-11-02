import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import { RISK_COLOR, RISK_TEXT_COLOR, RISK_LABEL, type DDExplain, type Risk } from '../../api/dd'

const fmt = (v: number | boolean) => (typeof v === 'boolean' ? (v ? 'activée' : 'désactivée') : v.toLocaleString('fr-FR'))

/** « Comprendre l'analyse » : les 5 étapes, le sens de chaque risque, les seuils utilisés et les limites (textes du moteur commun). */
export default function ExplainPanel({ explain, thresholds }: { explain?: DDExplain; thresholds?: Record<string, number | boolean> }) {
  const [open, setOpen] = useState(false)
  if (!explain) return null
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/50">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-blue-900">
        <HelpCircle className="h-4 w-4" /> Comprendre l'analyse : comment chaque parcelle est classée
        {open ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-5 px-5 pb-5 text-sm text-gray-700">
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {explain.method.map((m) => (
              <li key={m.title} className="rounded-xl border border-blue-100 bg-white p-3">
                <p className="font-semibold text-gray-900">{m.title}</p><p className="mt-1 text-[13px] leading-relaxed">{m.text}</p>
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(Object.keys(explain.risk) as Risk[]).map((k) => (
              <div key={k} className="rounded-xl border bg-white p-3" style={{ borderColor: RISK_COLOR[k] }}>
                <p className="font-semibold" style={{ color: RISK_TEXT_COLOR[k] }}>Risque {RISK_LABEL[k].toLowerCase()}</p>
                <p className="mt-1 text-[13px]">{explain.risk[k]}</p>
              </div>
            ))}
          </div>
          {thresholds && (
            <div>
              <p className="font-semibold text-gray-900">Seuils utilisés</p>
              <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] md:grid-cols-2">
                {Object.entries(thresholds).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-blue-100 py-0.5"><dt>{explain.thresholds[k] ?? k}</dt><dd className="font-semibold tabular-nums">{fmt(v)}</dd></div>
                ))}
              </dl>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">Limites</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">{explain.limits.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        </div>
      )}
    </section>
  )
}
