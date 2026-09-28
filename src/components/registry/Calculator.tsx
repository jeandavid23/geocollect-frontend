import { useMemo, useState } from 'react'
import { X, Delete, CornerDownLeft } from 'lucide-react'
import { formatComputed, isError, type WorkbookEngine } from '../../utils/spreadsheet/engine'
import { normalizeFormulaInput } from '../../utils/spreadsheet/refs'

interface Props {
  engine: WorkbookEngine
  sheetName: string
  selectionRef: string // ex. « B2:B40 »
  onInsert: (value: string) => void // texte à placer dans la cellule active (valeur ou formule)
  onClose: () => void
}

// Expression de la calculatrice → formule du moteur (× ÷ −, virgule décimale, noms français)
function toFormula(expr: string): string {
  const e = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√\(/g, 'SQRT(')
  // « 12,5 + 3 » : virgule décimale entre deux chiffres, sauf si l'utilisateur sépare des arguments par « ; »
  return normalizeFormulaInput(`=${e.includes(';') ? e : e.replace(/(\d),(\d)/g, '$1.$2')}`)
}

const KEYS: (string | { label: string; insert: string; cls?: string })[][] = [
  ['C', '⌫', '(', ')', { label: '%', insert: '/100' }],
  ['7', '8', '9', '÷', { label: '√', insert: '√(' }],
  ['4', '5', '6', '×', { label: 'x²', insert: '^2' }],
  ['1', '2', '3', '−', { label: 'xʸ', insert: '^' }],
  ['0', ',', '.', '+', '='],
]

export default function Calculator({ engine, sheetName, selectionRef, onInsert, onClose }: Props) {
  const [expr, setExpr] = useState('')
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([])

  const result = useMemo(() => {
    if (!expr.trim()) return null
    return engine.evaluate(toFormula(expr), sheetName)
  }, [expr, engine, sheetName])
  const resultText = result === null ? '' : formatComputed(result, toFormula(expr))

  const press = (key: string) => {
    if (key === 'C') setExpr('')
    else if (key === '⌫') setExpr((e) => e.slice(0, -1))
    else if (key === '=') validate()
    else setExpr((e) => e + key)
  }

  const validate = () => {
    if (!expr.trim() || result === null || isError(result)) return
    setHistory((h) => [{ expr, result: resultText }, ...h].slice(0, 12))
    setExpr(typeof result === 'number' ? String(result).replace('.', ',') : resultText)
  }

  const quick = (fn: string, label: string) => (
    <button key={fn} onClick={() => setExpr((e) => `${e}${fn}(${selectionRef})`)}
      className="px-2 py-1.5 rounded-lg bg-primary-50 text-primary-800 text-xs font-medium hover:bg-primary-100">
      {label}
    </button>
  )

  return (
    <aside className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="font-semibold text-gray-900 text-sm">Calculatrice</p>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto">
        {/* Écran */}
        <div className="bg-gray-900 rounded-xl p-3 text-right">
          <input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); validate() } }}
            placeholder="ex. 12,5 × 4 ou SOMME(B2:B40)"
            className="w-full bg-transparent text-gray-300 text-sm text-right outline-none placeholder:text-gray-600 font-mono"
          />
          <p className={`text-2xl font-bold font-mono mt-1 min-h-[2rem] break-all ${result && isError(result) ? 'text-red-400' : 'text-white'}`}>
            {resultText || '0'}
          </p>
        </div>

        {/* Clavier */}
        <div className="grid grid-cols-5 gap-1.5">
          {KEYS.flat().map((k, i) => {
            const label = typeof k === 'string' ? k : k.label
            const insert = typeof k === 'string' ? k : k.insert
            const op = ['÷', '×', '−', '+', '='].includes(label)
            const ctl = ['C', '⌫'].includes(label)
            return (
              <button key={i} onClick={() => press(insert)}
                className={`h-11 rounded-xl text-base font-semibold transition active:scale-95 ${
                  label === '=' ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : op ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                  : ctl ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                {label === '⌫' ? <Delete className="w-4 h-4 mx-auto" /> : label}
              </button>
            )
          })}
        </div>

        {/* Sur la sélection */}
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Sur la sélection <span className="font-mono text-gray-700">{selectionRef}</span></p>
          <div className="flex flex-wrap gap-1.5">
            {quick('SOMME', 'Somme')}{quick('MOYENNE', 'Moyenne')}{quick('NB', 'Nombre')}
            {quick('MAX', 'Max')}{quick('MIN', 'Min')}{quick('MEDIANE', 'Médiane')}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            L'écran accepte aussi les formules et références : <span className="font-mono">B2*1,5</span>,{' '}
            <span className="font-mono">NB.SI(C2:C500;"Femme")</span>, <span className="font-mono">Livraisons!D2</span>…
          </p>
        </div>

        {/* Insertion dans la cellule active */}
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={result === null || isError(result)}
            onClick={() => onInsert(typeof result === 'number' ? String(result).replace('.', ',') : resultText)}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold disabled:bg-gray-300">
            <CornerDownLeft className="w-3.5 h-3.5" /> Insérer le résultat
          </button>
          <button
            disabled={!expr.trim()}
            onClick={() => onInsert(toFormula(expr))}
            className="py-2 rounded-xl border border-primary-600 text-primary-700 text-xs font-semibold disabled:border-gray-300 disabled:text-gray-400">
            Insérer la formule
          </button>
        </div>

        {history.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Historique</p>
            <div className="space-y-1">
              {history.map((h, i) => (
                <button key={i} onClick={() => setExpr(h.expr)}
                  className="w-full text-right px-2 py-1 rounded-lg hover:bg-gray-50 text-xs font-mono">
                  <span className="text-gray-400">{h.expr} =</span> <span className="font-semibold text-gray-800">{h.result}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
