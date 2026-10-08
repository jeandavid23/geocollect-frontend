import { useEffect, useState } from 'react'

// Motion design de l'accueil : une scène animée par photo, qui montre ce que fait GeoCollect à cette étape.
// Animations CSS (index.css, classes .mo-*) ; arrêtées si l'utilisateur demande moins de mouvement.

/** Compteur qui monte de 0 à `to` (après `delay` ms). */
function Count({ to, decimals = 0, delay = 0, duration = 1400, suffix = '' }: { to: number; decimals?: number; delay?: number; duration?: number; suffix?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(to); return }
    let raf = 0
    const t0 = performance.now() + delay
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / duration))
      setV(to * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, delay, duration])
  return <>{v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</>
}

const card = 'rounded-lg border border-white/25 bg-[#0f1f15]/70 backdrop-blur-md shadow-[0_20px_50px_-12px_rgba(0,0,0,.6)] text-white'
const gold = '#e9c98b'

/** 01 — tracé GPS d'une parcelle */
function TraceScene() {
  const pts: [number, number][] = [[40, 150], [92, 52], [196, 34], [252, 108], [214, 186], [110, 196]]
  const d = 'M' + pts.map((p) => p.join(',')).join(' L') + ' Z'
  return (
    <div className={`${card} w-[300px] p-4`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/70">
        <span className="flex items-center gap-1.5"><span className="mo-blink h-1.5 w-1.5 rounded-full bg-red-400" />Mapping GPS</span>
        <span>± 3 m</span>
      </div>
      <svg viewBox="0 0 290 230" className="mt-2 w-full">
        <defs><pattern id="g" width="29" height="23" patternUnits="userSpaceOnUse"><path d="M29 0H0V23" fill="none" stroke="rgba(255,255,255,.08)" /></pattern></defs>
        <rect width="290" height="230" fill="url(#g)" />
        <path d={d} fill={gold} className="mo-fill" style={{ animationDelay: '3.2s' }} />
        <path d={d} fill="none" stroke={gold} strokeWidth="2.2" strokeLinejoin="round" pathLength={1} className="mo-draw" style={{ animationDuration: '3s', animationDelay: '.3s' }} />
        {pts.map(([x, y], i) => (
          <g key={i} className="mo-pop" style={{ animationDelay: `${0.3 + i * 0.5}s`, transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r="9" fill="none" stroke="#fff" strokeOpacity=".5" className="mo-ping" style={{ animationDelay: `${0.3 + i * 0.5}s`, transformOrigin: `${x}px ${y}px` }} />
            <circle cx={x} cy={y} r="4.5" fill="#fff" stroke={gold} strokeWidth="2" />
          </g>
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-[11px]">
        <div><p className="text-white/55">Sommets</p><p className="mt-0.5 text-sm font-semibold tabular-nums"><Count to={6} duration={3000} delay={300} /></p></div>
        <div><p className="text-white/55">Surface</p><p className="mt-0.5 text-sm font-semibold tabular-nums"><Count to={2.41} decimals={2} delay={3200} suffix=" ha" /></p></div>
        <div><p className="text-white/55">Position</p><p className="mt-0.5 text-sm font-semibold tabular-nums">6,578° N</p></div>
      </div>
    </div>
  )
}

/** 02 — le dossier producteur se construit */
function DossierScene() {
  const rows = [['Producteur', 'Kouamé A.', 'CI-TIA-00418'], ['Parcelle', '2,41 ha', 'CI-TIA-00418-P1'], ['Production', '1 240 kg', 'Campagne 2026']]
  return (
    <div className={`${card} w-[300px] p-4`}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/70">Dossier producteur</p>
      <div className="relative mt-3 space-y-3">
        <span className="mo-grow-y absolute left-[13px] top-4 bottom-4 w-px bg-white/30" style={{ animationDelay: '.6s' }} />
        {rows.map(([k, v, id], i) => (
          <div key={k} className="mo-slide-in relative flex items-center gap-3" style={{ animationDelay: `${0.3 + i * 0.7}s` }}>
            <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/40 bg-[#183a25] text-[11px] font-semibold">{i + 1}</span>
            <div className="flex-1 rounded-md bg-white/10 px-3 py-2">
              <div className="flex justify-between text-xs"><span className="text-white/60">{k}</span><span className="font-semibold">{v}</span></div>
              <p className="mt-0.5 font-mono text-[10px] text-white/45">{id}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mo-fade mt-3 flex items-center gap-2 text-xs" style={{ animationDelay: '2.6s', color: gold }}>
        <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" pathLength={1} className="mo-draw" style={{ animationDelay: '2.7s', animationDuration: '.5s' }} /></svg>
        Producteur, parcelle et production reliés
      </p>
    </div>
  )
}

/** 03 — analyse satellite de déforestation */
function ScanScene() {
  return (
    <div className={`${card} w-[300px] p-4`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/70">
        <span>Analyse satellite</span><span>2001 → 2024</span>
      </div>
      <div className="relative mt-3 h-[170px] overflow-hidden rounded-md bg-[#1d452c]">
        {/* mosaïque de couvert forestier */}
        <div className="absolute inset-0 grid grid-cols-12 grid-rows-8">
          {Array.from({ length: 96 }, (_, i) => (
            <span key={i} style={{ background: `rgba(${40 + ((i * 37) % 30)},${95 + ((i * 53) % 45)},${55 + ((i * 29) % 25)},${0.55 + ((i * 17) % 40) / 100})` }} />
          ))}
        </div>
        <svg viewBox="0 0 280 170" className="absolute inset-0 h-full w-full">
          <path d="M60 120 L95 45 L190 35 L230 95 L195 150 L100 152 Z" fill="rgba(233,201,139,.12)" stroke={gold} strokeWidth="2" />
        </svg>
        <div className="mo-scan absolute inset-x-0 h-14 bg-gradient-to-b from-transparent via-white/25 to-transparent" />
        <div className="mo-scan-line absolute inset-x-0 h-px bg-white/80 shadow-[0_0_12px_2px_rgba(255,255,255,.6)]" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-white/10 px-3 py-2"><p className="text-white/55">Perte après 2020</p><p className="mt-0.5 text-sm font-semibold tabular-nums"><Count to={0} decimals={2} suffix=" ha" /></p></div>
        <div className="rounded-md bg-white/10 px-3 py-2"><p className="text-white/55">Couvert 2000</p><p className="mt-0.5 text-sm font-semibold tabular-nums"><Count to={18} delay={600} suffix=" %" /></p></div>
      </div>
      <p className="mo-stamp mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold" style={{ animationDelay: '3.1s', borderColor: gold, color: gold }}>
        Conforme EUDR
      </p>
    </div>
  )
}

/** 04 — tableau de bord de la coopérative en direct */
function LiveScene() {
  const bars = [38, 52, 46, 70, 64, 82, 76]
  return (
    <div className={`${card} w-[300px] p-4`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/70">
        <span>Coopérative · direct</span>
        <span className="flex items-center gap-1.5"><span className="mo-blink h-1.5 w-1.5 rounded-full bg-emerald-400" />en ligne</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[[1284, 'producteurs', 0], [2210, 'parcelles', 200], [24, 'agents', 400]].map(([n, l, d]) => (
          <div key={l as string} className="rounded-md bg-white/10 py-2">
            <p className="text-lg font-semibold tabular-nums"><Count to={n as number} delay={d as number} duration={1800} /></p>
            <p className="text-[10px] text-white/55">{l as string}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-24 items-end gap-2">
        {bars.map((h, i) => (
          <div key={i} className="flex h-full flex-1 items-end rounded-t bg-white/10">
            <div className="mo-grow-y-bar w-full rounded-t" style={{ height: `${h}%`, background: i === bars.length - 1 ? gold : 'rgba(255,255,255,.55)', animationDelay: `${0.5 + i * 0.12}s` }} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/50">Parcelles mappées par jour, 7 derniers jours</p>
    </div>
  )
}

/** 05 — lot exporté, dossier de diligence raisonnable */
function ExportScene() {
  const steps = ['Lot enregistré · 48 sacs', 'Parcelles d\'origine vérifiées', 'Analyse déforestation jointe', 'Dossier DDS prêt pour l\'exportateur']
  return (
    <div className={`${card} w-[300px] p-4`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/70">Lot export</p>
        <p className="font-mono text-[11px]" style={{ color: gold }}>CI-SBR-2026-0147</p>
      </div>
      <div className="mt-3 flex gap-3">
        {/* code du lot (motif type QR) */}
        <svg viewBox="0 0 70 70" className="h-[70px] w-[70px] flex-shrink-0 rounded bg-white p-1">
          {Array.from({ length: 49 }, (_, i) => {
            const x = i % 7, y = Math.floor(i / 7)
            const corner = (x < 2 && y < 2) || (x > 4 && y < 2) || (x < 2 && y > 4)
            const on = corner || (i * 7919) % 3 === 0
            return on ? <rect key={i} x={x * 10} y={y * 10} width="9" height="9" fill="#183a25" className="mo-pop" style={{ animationDelay: `${(i % 9) * 0.05}s`, transformOrigin: `${x * 10 + 4.5}px ${y * 10 + 4.5}px` }} /> : null
          })}
        </svg>
        <ul className="flex-1 space-y-1.5 text-[11.5px]">
          {steps.map((s, i) => (
            <li key={s} className="mo-slide-in flex items-start gap-2" style={{ animationDelay: `${0.5 + i * 0.6}s` }}>
              <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: i === steps.length - 1 ? gold : '#fff' }}>
                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeOpacity=".5" />
                <path d="M4.5 8.2l2.3 2.3 4.7-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" pathLength={1} className="mo-draw" style={{ animationDelay: `${0.7 + i * 0.6}s`, animationDuration: '.4s' }} />
              </svg>
              <span className={i === steps.length - 1 ? 'font-semibold' : 'text-white/85'}>{s}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="mo-progress-bar h-full rounded-full" style={{ background: gold }} /></div>
    </div>
  )
}

const SCENES = [TraceScene, DossierScene, ScanScene, LiveScene, ExportScene]

/** Scène animée de la photo `index` (remontée à chaque changement de photo pour rejouer l'animation). */
export default function SlideMotion({ index }: { index: number }) {
  const Scene = SCENES[index % SCENES.length]
  return (
    <div className="mo-scene pointer-events-none">
      <Scene />
    </div>
  )
}
