// Textes et logo animés de l'accueil (classes .mo-* dans index.css, coupées si moins de mouvement demandé).

interface SplitProps {
  text: string
  by?: 'word' | 'char'
  delay?: number          // ms avant le premier élément
  step?: number           // ms entre deux éléments
  variant?: 'rise' | 'blur' | 'soft'
  highlight?: string[]    // mots mis en valeur (doré + soulignement dessiné)
  className?: string
}

/** Texte découpé en mots ou en lettres, qui apparaissent l'un après l'autre. Lisible tel quel par les lecteurs d'écran. */
export function SplitText({ text, by = 'word', delay = 0, step = 60, variant = 'rise', highlight = [], className }: SplitProps) {
  const parts = by === 'word' ? text.split(' ') : Array.from(text)
  const clean = (w: string) => w.replace(/[.,;:!?]$/, '').toLowerCase()
  return (
    <span className={className} aria-label={text}>
      {parts.map((p, i) => {
        const d = delay + i * step
        const hl = by === 'word' && highlight.includes(clean(p))
        const inner = (
          <span className={`mo-${variant} inline-block`} style={{ animationDelay: `${d}ms` }}>
            {hl ? (
              <>
                <span className="relative text-[#e9c98b]">
                  {p.replace(/[.,;:!?]$/, '')}
                  <span className="mo-underline absolute bottom-[0.04em] left-0 h-[2px] w-full rounded bg-[#e9c98b]" style={{ animationDelay: `${d + 650}ms` }} />
                </span>
                {p.match(/[.,;:!?]$/)?.[0] ?? ''}
              </>
            ) : p === ' ' ? ' ' : p}
          </span>
        )
        return (
          <span key={i} aria-hidden="true">
            <span className={variant === 'rise' ? 'mo-mask' : 'inline-block'}>{inner}</span>
            {by === 'word' && i < parts.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </span>
  )
}

/** Logo animé : carré qui apparaît, feuille dessinée puis remplie, nom écrit lettre par lettre. */
export function AnimatedLogo({ delay = 0 }: { delay?: number }) {
  return (
    <div className="group flex items-center gap-2.5" aria-label="GeoCollect EUDR">
      <span className="mo-logo-box flex h-9 w-9 items-center justify-center rounded-md bg-white" style={{ animationDelay: `${delay}ms` }}>
        <svg viewBox="0 0 24 24" className="mo-leaf h-5 w-5 text-primary-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" fill="currentColor" stroke="none"
            className="mo-leaf-fill" style={{ animationDelay: `${delay + 1250}ms` }} />
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" pathLength={1}
            className="mo-draw" style={{ animationDelay: `${delay + 250}ms`, animationDuration: '1.1s' }} />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" pathLength={1}
            className="mo-draw" style={{ animationDelay: `${delay + 1000}ms`, animationDuration: '.6s' }} />
        </svg>
      </span>
      <span className="text-[15px] tracking-wide" aria-hidden="true">
        <SplitText text="GeoCollect" by="char" delay={delay + 300} step={45} variant="soft" className="font-semibold" />
        {' '}
        <span className="mo-soft inline-block font-normal text-white/70" style={{ animationDelay: `${delay + 900}ms` }}>EUDR</span>
      </span>
    </div>
  )
}
