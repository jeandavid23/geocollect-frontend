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

/** Diaporama plein cadre : fondu enchaîné + lent zoom (Ken Burns), barres de progression, pause au survol. */
export default function HeroSlideshow({ children, headline }: { children?: React.ReactNode; headline?: React.ReactNode }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [cycle, setCycle] = useState(0)   // relance l'animation de la barre quand on change de photo à la main
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  const go = useCallback((i: number) => { setIndex((i + SLIDES.length) % SLIDES.length); setCycle((c) => c + 1) }, [])

  useEffect(() => {
    if (paused || reduced.current) return
    const t = setTimeout(() => go(index + 1), DURATION)
    return () => clearTimeout(t)
  }, [index, paused, cycle, go])

  // photos montées au fil du défilement : la photo affichée + la suivante (réseau mobile : pas 1,3 Mo d'un coup)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))
  useEffect(() => {
    const t = setTimeout(() => setSeen((s) => new Set([...s, index, (index + 1) % SLIDES.length])), index === 0 ? 2500 : 0)
    setSeen((s) => (s.has(index) ? s : new Set([...s, index])))
    return () => clearTimeout(t)
  }, [index])

  const s = SLIDES[index]
  return (
    <div className="absolute inset-0" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {SLIDES.map((sl, i) => !seen.has(i) ? null : (
        <picture key={sl.img}>
          <source srcSet={`/images/${sl.img}.webp`} type="image/webp" />
          <img src={`/images/${sl.img}.jpg`} alt={i === index ? `${sl.step} — ${sl.place}` : ''} aria-hidden={i !== index}
            fetchPriority={i === 0 ? 'high' : 'low'}
            style={{ objectPosition: sl.pos }}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-out
              ${i === index ? 'opacity-100' : 'opacity-0'}
              ${i === index && !reduced.current ? 'animate-kenburns' : ''}`} />
        </picture>
      ))}

      {/* ombrages : texte lisible sans éteindre la photo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/45" />
      <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-black/55 via-black/10 to-transparent" />

      {/* scène animée de l'étape (grands écrans) */}
      <div key={`scene-${index}-${cycle}`} className="absolute right-8 top-10 z-10 hidden xl:block 2xl:right-14 2xl:top-14">
        <SlideMotion index={index} />
      </div>

      <div className="relative z-10 flex h-full flex-col p-6 sm:p-10 lg:p-14 text-white">
        {children}

        {/* Étape en cours */}
        <div className="hidden lg:block mt-auto max-w-xl [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
          {headline}
          <div key={`${index}-${cycle}`} className="mt-8 min-h-[92px] border-l-2 border-[#e9c98b]/70 pl-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e9c98b]">
              <span className="mo-mask"><span className="mo-tick">{String(index + 1).padStart(2, '0')}</span></span> / {String(SLIDES.length).padStart(2, '0')} ·{' '}
              <SplitText text={`${s.step} · ${s.place}`} by="char" delay={150} step={18} variant="soft" />
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/85">
              <SplitText text={s.text} delay={450} step={35} variant="blur" />
            </p>
          </div>
        </div>

        <div className="mt-auto lg:mt-8">
          <p key={`m-${index}`} className="lg:hidden mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e9c98b] animate-fade-up">
            {s.step} · {s.place}
          </p>
          {/* barres de progression (cliquables) */}
          <div className="flex gap-1.5" role="tablist" aria-label="Photos">
            {SLIDES.map((sl, i) => (
              <button key={sl.img} role="tab" aria-selected={i === index} aria-label={sl.step} onClick={() => go(i)}
                className="group relative h-6 flex-1 cursor-pointer">
                <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/25 group-hover:bg-white/40" />
                <span key={i === index ? `${cycle}` : 'x'}
                  className={`absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white
                    ${i < index ? 'w-full' : i === index ? (reduced.current ? 'w-full' : 'w-0 animate-progress') : 'w-0'}`}
                  style={i === index ? { animationDuration: `${DURATION}ms`, animationPlayState: paused ? 'paused' : 'running' } : undefined} />
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/55">
            Photo : {s.author}, <a href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(s.file)}`} target="_blank" rel="noreferrer" className="underline hover:text-white">Wikimedia Commons</a>, CC BY-SA 4.0
          </p>
        </div>
      </div>
    </div>
  )
}
