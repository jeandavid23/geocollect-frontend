import { useState, useRef, useEffect } from 'react'
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Palette, PaintBucket,
  Table2, Eraser, Grid3x3, ChevronDown, Hash,
} from 'lucide-react'
import {
  type CellFormat, type NumberFormatId, NUMBER_FORMATS, TEXT_COLORS, FILL_COLORS,
} from '../../utils/spreadsheet/format'

interface Props {
  active: CellFormat
  onApply: (patch: Partial<CellFormat>) => void
  onClear: () => void
  onTable: () => void
}

function Dropdown({ icon, title, children }: { icon: React.ReactNode; title: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((v) => !v)} title={title}
        className="flex items-center gap-0.5 px-1.5 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100">
        {icon}<ChevronDown className="w-3 h-3" />
      </button>
      {open && <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-2">{children(() => setOpen(false))}</div>}
    </div>
  )
}

export default function FormatToolbar({ active, onApply, onClear, onTable }: Props) {
  const tBtn = (on: boolean) => `p-1.5 rounded-lg hover:bg-gray-100 ${on ? 'bg-primary-100 text-primary-700' : 'text-gray-700'}`

  return (
    <div className="mx-6 mt-2 flex flex-wrap items-center gap-0.5 bg-white border border-gray-200 rounded-xl px-2 py-1" onMouseDown={(e) => e.preventDefault()}>
      <button onClick={() => onApply({ b: !active.b })} className={tBtn(!!active.b)} title="Gras (Ctrl+B)"><Bold className="w-4 h-4" /></button>
      <button onClick={() => onApply({ i: !active.i })} className={tBtn(!!active.i)} title="Italique (Ctrl+I)"><Italic className="w-4 h-4" /></button>
      <button onClick={() => onApply({ u: !active.u })} className={tBtn(!!active.u)} title="Souligné (Ctrl+U)"><Underline className="w-4 h-4" /></button>
      <span className="w-px h-5 bg-gray-200 mx-1" />

      <Dropdown icon={<Palette className="w-4 h-4" />} title="Couleur du texte">
        {(close) => (
          <div className="grid grid-cols-5 gap-1 w-40">
            {TEXT_COLORS.map((col) => (
              <button key={col} onClick={() => { onApply({ c: col }); close() }} className="w-6 h-6 rounded border border-gray-200" style={{ background: col }} title={col} />
            ))}
            <button onClick={() => { onApply({ c: '' }); close() }} className="col-span-5 text-xs text-gray-500 hover:bg-gray-50 rounded py-1 mt-1">Couleur par défaut</button>
          </div>
        )}
      </Dropdown>
      <Dropdown icon={<PaintBucket className="w-4 h-4" />} title="Couleur de fond">
        {(close) => (
          <div className="grid grid-cols-5 gap-1 w-40">
            {FILL_COLORS.map((col) => (
              <button key={col || 'none'} onClick={() => { onApply({ bg: col }); close() }}
                className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center" style={{ background: col || 'white' }} title={col || 'Aucun'}>
                {!col && <span className="text-[9px] text-gray-400">∅</span>}
              </button>
            ))}
          </div>
        )}
      </Dropdown>
      <span className="w-px h-5 bg-gray-200 mx-1" />

      <button onClick={() => onApply({ a: 'left' })} className={tBtn(active.a === 'left')} title="Aligner à gauche"><AlignLeft className="w-4 h-4" /></button>
      <button onClick={() => onApply({ a: 'center' })} className={tBtn(active.a === 'center')} title="Centrer"><AlignCenter className="w-4 h-4" /></button>
      <button onClick={() => onApply({ a: 'right' })} className={tBtn(active.a === 'right')} title="Aligner à droite"><AlignRight className="w-4 h-4" /></button>
      <span className="w-px h-5 bg-gray-200 mx-1" />

      <Dropdown icon={<Hash className="w-4 h-4" />} title="Format des nombres">
        {(close) => (
          <div className="w-52">
            {NUMBER_FORMATS.map((f) => (
              <button key={f.id} onClick={() => { onApply({ nf: f.id as NumberFormatId }); close() }}
                className={`w-full flex justify-between gap-3 px-2 py-1.5 rounded-lg text-sm hover:bg-gray-50 ${active.nf === f.id ? 'bg-primary-50 text-primary-800' : 'text-gray-700'}`}>
                <span>{f.label}</span><span className="text-gray-400 text-xs">{f.example}</span>
              </button>
            ))}
          </div>
        )}
      </Dropdown>
      <Dropdown icon={<Grid3x3 className="w-4 h-4" />} title="Bordures">
        {(close) => (
          <div className="grid grid-cols-2 gap-1 w-44 text-xs">
            {[['tblr', 'Toutes'], ['', 'Aucune'], ['b', 'Bas'], ['t', 'Haut'], ['l', 'Gauche'], ['r', 'Droite']].map(([bd, label]) => (
              <button key={label} onClick={() => { onApply({ bd }); close() }} className="px-2 py-1.5 rounded-lg hover:bg-gray-100 text-gray-700">{label}</button>
            ))}
          </div>
        )}
      </Dropdown>
      <span className="w-px h-5 bg-gray-200 mx-1" />

      <button onClick={onTable} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-700 hover:bg-primary-50" title="Mettre la sélection sous forme de tableau">
        <Table2 className="w-4 h-4" /> Tableau
      </button>
      <button onClick={onClear} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100" title="Effacer la mise en forme de la sélection">
        <Eraser className="w-4 h-4" /> Effacer format
      </button>
    </div>
  )
}
