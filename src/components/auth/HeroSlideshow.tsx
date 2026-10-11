import { useCallback, useEffect, useRef, useState } from 'react'
import SlideMotion from './SlideMotion'
import { SplitText } from './MotionText'

// Le parcours du cacao en Côte d'Ivoire, de la plantation au sac prêt pour l'export.
// Photos réelles (Wikimedia Commons, CC BY-SA 4.0) : l'auteur doit rester cité.
export const SLIDES = [
  {
    img: 'plantation-cacao', step: 'La plantation', place: 'Est de la Côte d\'Ivoire',
    text: 'Chaque parcelle est relevée au GPS par les agents de terrain, puis contrôlée avant d\'entrer dans le registre.',
    author: 'Hanay', file: 'Cacao_fruit_in_Côte_d\'Ivoire_(14).JPG', pos: '50% 60%',
  },
  {
    img: 'cabosses-arbre-tiassale', step: 'Les cabosses', place: 'Tiassalé',
    text: 'Le producteur, sa parcelle et sa production sont reliés dans un même dossier.',
    author: 'Durand ndri', file: 'Tiassalé_-Environnement_et_Biodiversité_24.jpg', pos: '45% 40%',
  },
  {
    img: 'cabosses-soubre', step: 'La récolte', place: 'Soubré',
    text: 'L\'analyse de déforestation vérifie qu\'aucune parcelle n\'a perdu de forêt après le 31 décembre 2020.',
    author: 'Milequem Diarassouba', file: 'Cocoa_pods_in_Soubré.jpg', pos: '50% 55%',
  },
  {
    img: 'producteur-cacao', step: 'Le séchage', place: 'Côte d\'Ivoire',
    text: 'Les coopératives suivent leurs agents, leurs producteurs et leurs volumes en temps réel.',
    author: 'KokoDZ', file: 'Cultivateur_de_cacao_01.jpg', pos: '35% 50%',
  },
  {
    img: 'sacs-cacao-soubre', step: 'La mise en sacs', place: 'Région de Soubré',
    text: 'L\'exportateur reçoit des données vérifiées pour sa déclaration de diligence raisonnable.',
    author: 'Abdallahbigboy', file: 'Emballage_de_Cacao.jpg', pos: '50% 45%',
  },
]

const DURATION = 7000

/**
 * Diaporama plein écran : transition en rideau, lent zoom (Ken Burns), profondeur au mouvement de la souris,
 * flèches du clavier, barres de progression cliquables, pause au survol de la photo.
 * `reserveRight` : place laissée en bas à droite (grands écrans) pour la carte de connexion ou son bouton réduit.
 */
export default function HeroSlideshow({ children, headline, footer, reserveRight = 'none' }: {
  children?: React.ReactNode; headline?: React.ReactNode; footer?: React.ReactNode; reserveRight?: 'none' | 'card' | 'pill'
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [cycle, setCycle] = useState(0)   // relance l'animation de la barre quand on change de photo à la main
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const layer = useRef<HTMLDivElement>(null)
  const frame = useRef(0)

  // instant d'arrivée de chaque photo : son zoom continue pendant qu'elle s'efface sous la suivante
  const starts = useRef<Record<number, number>>({ 0: 0 })
  const current = useRef(0)
  const previous = useRef(-1)
  const go = useCallback((i: number) => {
    const n = (i + SLIDES.length) % SLIDES.length
    if (n === current.current) return
    previous.current = current.current
    current.current = n
    starts.current[n] = Date.now()
    setIndex(n); setCycle((c) => c + 1)
  }, [])

  useEffect(() => {
    if (paused || reduced.current) return
    const t = setTimeout(() => go(index + 1), DURATION)
    return () => clearTimeout(t)
  }, [index, paused, cycle, go])

  // flèches gauche / droite (hors saisie dans le formulaire)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, go])

  // profondeur : la photo suit légèrement la souris (sans re-rendu React)
  const onMove = (e: React.MouseEvent) => {
    if (reduced.current || !layer.current) return
    const x = e.clientX / window.innerWidth - 0.5
    const y = e.clientY / window.innerHeight - 0.5
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      if (layer.current) layer.current.style.transform = `translate3d(${(-x * 18).toFixed(1)}px, ${(-y * 12).toFixed(1)}px, 0) scale(1.05)`
    })
  }

  // photos montées au fil du défilement : la photo affichée + la suivante (réseau mobile : pas 1,3 Mo d'un coup)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))
  useEffect(() => {
    const t = setTimeout(() => setSeen((s) => new Set([...s, index, (index + 1) % SLIDES.length])), index === 0 ? 2500 : 0)
    setSeen((s) => (s.has(index) ? s : new Set([...s, index])))
    return () => clearTimeout(t)
  }, [index])

  const s = SLIDES[index]
  const prev = previous.current
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#2b2118]" onMouseMove={onMove}>
      <div ref={layer} className="absolute inset-0 transition-transform duration-700 ease-out will-change-transform" style={{ transform: 'scale(1.05)' }}>
        {SLIDES.map((sl, i) => !seen.has(i) ? null : (
          <div key={sl.img} aria-hidden={i !== index}
            className={`absolute inset-0 ${i === index ? `z-[2] ${cycle > 0 && !reduced.current ? 'login-wipe' : ''}` : i === prev ? 'z-[1]' : 'z-0 opacity-0'}`}>
            <picture>
              <source srcSet={`/images/${sl.img}.webp`} type="image/webp" />
              <img key={starts.current[i] ?? 'k'} src={`/images/${sl.img}.jpg`} alt={i === index ? `${sl.step} — ${sl.place}` : ''}
                fetchPriority={i === 0 ? 'high' : 'low'} style={{ objectPosition: sl.pos }}
                className={`h-full w-full object-cover ${(i === index || i === prev) && !reduced.current ? 'animate-kenburns' : ''}`} />
            </picture>
          </div>
        ))}
      </div>

      {/* ombrages : texte lisible sans éteindre la photo */}
      <div className="absolute inset-0 z-[3] bg-gradient-to-t from-black/85 via-black/15 to-black/50" />
      <div className="absolute inset-0 z-[3] hidden lg:block bg-gradient-to-r from-black/55 via-transparent to-black/25" />

      {/* scène animée de l'étape (grands écrans) */}
      <div key={`scene-${index}-${cycle}`} className={`login-scene absolute right-8 top-28 z-10 2xl:right-14 ${reserveRight === 'card' ? 'login-scene-tall' : ''}`}>
        <SlideMotion index={index} />
      </div>

      <div className="relative z-10 flex h-full flex-col p-6 sm:p-10 lg:p-14 text-white">
        {children}
        <div className={`flex flex-1 flex-col transition-[padding] duration-500 ${reserveRight === 'card' ? 'lg:pr-[440px]' : reserveRight === 'pill' ? 'lg:pr-[210px]' : ''}`}>

        {/* Étape en cours */}
        <div className="hidden lg:flex mt-auto items-end gap-8 [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]"
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="max-w-2xl">
            {headline}
            <div key={`${index}-${cycle}`} className="mt-8 min-h-[92px] border-l-2 border-[#e9c98b]/70 pl-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e9c98b]">
                <SplitText text={`${s.step} · ${s.place}`} by="char" delay={150} step={18} variant="soft" />
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-white/85">
                <SplitText text={s.text} delay={450} step={35} variant="blur" />
              </p>
            </div>
          </div>
          {/* grand numéro de l'étape */}
          <div className="hidden 2xl:block overflow-hidden font-serif text-[7rem] font-semibold leading-none text-white/15 select-none">
            <span key={`n-${index}-${cycle}`} className="block login-count">{String(index + 1).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="mt-auto lg:mt-8">
          <p key={`m-${index}`} className="lg:hidden mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e9c98b] animate-fade-up">
            {s.step} · {s.place}
          </p>
          {/* barres de progression (cliquables) */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs tabular-nums text-white/70">
              <span className="mo-mask"><span key={`t-${index}-${cycle}`} className="mo-tick">{String(index + 1).padStart(2, '0')}</span></span> / {String(SLIDES.length).padStart(2, '0')}
            </span>
            <div className="flex flex-1 gap-1.5" role="tablist" aria-label="Photos">
              {SLIDES.map((sl, i) => (
                <button key={sl.img} role="tab" aria-selected={i === index} aria-label={sl.step} onClick={() => go(i)}
                  className="group relative h-6 flex-1 cursor-pointer">
                  <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/25 group-hover:bg-white/40" />
                  <span key={i === index ? `${cycle}` : 'x'}
                    className={`absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white
                      ${i < index ? 'w-full' : i === index ? (reduced.current ? 'w-full' : 'w-0 animate-progress') : 'w-0'}`}
                    style={i === index ? { animationDuration: `${DURATION}ms`, animationPlayState: paused ? 'paused' : 'running' } : undefined} />
                  <span className="pointer-events-none absolute bottom-full left-0 mb-1 hidden whitespace-nowrap rounded bg-black/60 px-2 py-0.5 text-[11px] group-hover:block">{sl.step}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-white/55">
            <p>
              Photo : {s.author}, <a href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(s.file)}`} target="_blank" rel="noreferrer" className="underline hover:text-white">Wikimedia Commons</a>, CC BY-SA 4.0
            </p>
            {footer}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
