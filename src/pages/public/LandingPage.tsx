import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPinned, ShieldCheck, Satellite, FileCheck2, BookOpen, Layers, Users, Building2, Ship, Check, ArrowRight, Menu, X,
  Smartphone, WifiOff, Bell, Lock, Loader2, CheckCircle2,
} from 'lucide-react'
import api from '../../api/client'
import { AnimatedLogo, SplitText } from '../../components/auth/MotionText'
import SlideMotion from '../../components/auth/SlideMotion'

/** Apparition au défilement (une seule fois). */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${on ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 motion-reduce:opacity-100 motion-reduce:translate-y-0'} ${className}`}>
      {children}
    </div>
  )
}

const STEPS = [
  { icon: BookOpen, title: 'Recenser', text: 'Le registre des producteurs est importé depuis Excel : noms, villages, sections, codes producteurs.' },
  { icon: MapPinned, title: 'Cartographier', text: 'Les agents relèvent chaque parcelle au GPS sur téléphone, même sans réseau en brousse.' },
  { icon: Satellite, title: 'Contrôler', text: 'Chevauchements, auto-intersections et perte de forêt après le 31 décembre 2020 sont vérifiés automatiquement.' },
  { icon: Ship, title: 'Exporter', text: 'Fichier TRACES, fiches de lot et rapports PDF pour la déclaration de diligence raisonnable de l\'exportateur.' },
]

const FEATURES = [
  { icon: Smartphone, t: 'Mapping GPS mobile', d: 'Application pour les agents de terrain, tracé des parcelles et rattachement au producteur.' },
  { icon: WifiOff, t: 'Hors ligne', d: 'Les parcelles sont gardées sur le téléphone et envoyées au retour du réseau.' },
  { icon: Satellite, t: 'Analyse déforestation', d: 'Données satellitaires Hansen, normes EUDR et Rainforest Alliance, matrice des forêts classées.' },
  { icon: ShieldCheck, t: 'Polygon Validator', d: 'Plus de 10 000 polygones contrôlés en une fois : superpositions, doublons, géométries.' },
  { icon: FileCheck2, t: 'Export TRACES', d: 'GeoJSON conforme au système d\'information de l\'UE, contrôlé avant téléchargement.' },
  { icon: Layers, t: 'Outils SIG', d: 'Table attributaire, édition des sommets, mesures : l\'essentiel de QGIS dans le navigateur.' },
  { icon: Bell, t: 'Suivi en temps réel', d: 'Tableaux de bord, notifications et messagerie entre exportateur, coopératives et agents.' },
  { icon: Lock, t: 'Données cloisonnées', d: 'Chaque coopérative ne voit que ses propres données ; plateforme supervisée en continu.' },
]

const PLANS = [
  { name: 'Essentiel', price: '2 000 000', month: '166 667', for: 'Une coopérative qui démarre sa cartographie EUDR',
    limits: ['1 coopérative', '2 000 parcelles', '5 agents'],
    items: ['Mapping GPS mobile', 'Polygon Validator', 'Registre des producteurs, import Excel', 'Rapports PDF, Excel et SIG', 'Support par e-mail'] },
  { name: 'Pro', price: '4 000 000', month: '333 333', for: 'Une ou deux coopératives qui préparent leurs dossiers de conformité', hot: true,
    limits: ['2 coopératives', '10 000 parcelles', '10 agents'],
    items: ['Tout Essentiel', 'Analyse déforestation et matrice RDUE', 'Self-intersection, Polygon & GMR', 'Outils SIG d\'édition', 'Export TRACES', 'Formation des agents', 'Support WhatsApp prioritaire'] },
  { name: 'Exportateur', price: '8 500 000', month: '708 333', for: 'Un exportateur et ses coopératives partenaires',
    limits: ['Jusqu\'à 10 coopératives', 'Parcelles illimitées', 'Agents illimités'],
    items: ['Tout Pro, pour chaque coopérative', 'Espace multi-coopératives', 'Carte et tableaux consolidés', 'Journal d\'activité complet', 'Formation sur site', 'Accompagnement dédié'] },
]

function DemoForm() {
  const [f, setF] = useState({ full_name: '', organization: '', profile: 'cooperative', phone: '', email: '', producers: '', plan: '', message: '', website: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setState('sending'); setError('')
    try {
      await api.post('/contact/demo/', { ...f, producers: f.producers ? Number(f.producers) : null })
      setState('done')
    } catch (err) {
      const d = (err as { response?: { status?: number; data?: Record<string, string[] | string> } })?.response
      setError(d?.status === 429 ? 'Trop de demandes envoyées. Réessayez plus tard ou appelez-nous.'
        : d?.data ? Object.values(d.data).flat().join(' ') : 'Envoi impossible. Vérifiez votre connexion ou appelez-nous.')
      setState('error')
    }
  }
  const input = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
  if (state === 'done') return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary-700" />
      <p className="mt-3 font-serif text-2xl font-semibold text-gray-900">Merci, votre demande est envoyée.</p>
      <p className="mt-2 text-sm text-gray-600">Nous vous rappelons sous 48 heures pour fixer la démonstration, sur vos propres données si vous le souhaitez.</p>
    </div>
  )
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="text-sm text-gray-700">Nom et prénom *<input required value={f.full_name} onChange={set('full_name')} className={input} autoComplete="name" /></label>
      <label className="text-sm text-gray-700">Structure *<input required value={f.organization} onChange={set('organization')} className={input} placeholder="Coopérative, exportateur…" autoComplete="organization" /></label>
      <label className="text-sm text-gray-700">Vous êtes
        <select value={f.profile} onChange={set('profile')} className={input}>
          <option value="cooperative">Une coopérative</option><option value="exportateur">Un exportateur</option>
          <option value="certification">Un organisme de certification</option><option value="autre">Autre</option>
        </select>
      </label>
      <label className="text-sm text-gray-700">Téléphone (WhatsApp) *<input required value={f.phone} onChange={set('phone')} className={input} placeholder="07 00 00 00 00" autoComplete="tel" inputMode="tel" /></label>
      <label className="text-sm text-gray-700">E-mail<input type="email" value={f.email} onChange={set('email')} className={input} autoComplete="email" /></label>
      <label className="text-sm text-gray-700">Nombre de producteurs (environ)<input type="number" min="0" value={f.producers} onChange={set('producers')} className={input} /></label>
      <label className="text-sm text-gray-700 sm:col-span-2">Formule envisagée
        <select value={f.plan} onChange={set('plan')} className={input}>
          <option value="">Je ne sais pas encore</option><option value="essentiel">Essentiel</option><option value="pro">Pro</option>
          <option value="exportateur">Exportateur</option><option value="parcelle">Paiement à la parcelle</option><option value="acquisition">Acquisition</option>
        </select>
      </label>
      <label className="text-sm text-gray-700 sm:col-span-2">Message<textarea rows={3} value={f.message} onChange={set('message')} className={input} placeholder="Votre besoin, votre calendrier, la campagne concernée…" /></label>
      <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden="true" />
      {state === 'error' && <p role="alert" className="sm:col-span-2 rounded-md border-l-4 border-red-500 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <button disabled={state === 'sending'} className="flex items-center gap-2 rounded-md bg-primary-700 px-6 py-3 font-semibold text-white hover:bg-primary-800 disabled:opacity-60">
          {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Demander ma démonstration
        </button>
        <p className="text-xs text-gray-500">Démonstration gratuite, sans engagement. Vos informations servent uniquement à vous recontacter.</p>
      </div>
    </form>
  )
}

export default function LandingPage() {
  const [menu, setMenu] = useState(false)
  const [scene, setScene] = useState(0)
  useEffect(() => { const t = setInterval(() => setScene((s) => (s + 1) % 5), 6500); return () => clearInterval(t) }, [])
  useEffect(() => { document.title = 'GeoCollect EUDR — Traçabilité du cacao et conformité EUDR' }, [])
  const nav = [['#fonctionnement', 'Fonctionnement'], ['#fonctionnalites', 'Fonctionnalités'], ['#tarifs', 'Tarifs'], ['#demo', 'Contact']]

  return (
    <div className="bg-white text-gray-900">
      {/* Barre de navigation */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0f1f15]/85 text-white backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top"><AnimatedLogo /></a>
          <nav className="hidden items-center gap-7 text-sm text-white/80 md:flex">
            {nav.map(([h, l]) => <a key={h} href={h} className="hover:text-white">{l}</a>)}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="text-sm font-medium text-white/85 hover:text-white">Se connecter</Link>
            <a href="#demo" className="rounded-md bg-[#e9c98b] px-4 py-2 text-sm font-semibold text-[#183a25] hover:bg-[#f1d7a3]">Demander une démo</a>
          </div>
          <button className="md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X /> : <Menu />}</button>
        </div>
        {menu && (
          <div className="border-t border-white/10 px-5 py-4 md:hidden">
            {nav.map(([h, l]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block py-2 text-white/85">{l}</a>)}
            <Link to="/login" className="mt-2 block py-2 font-medium">Se connecter</Link>
          </div>
        )}
      </header>

      {/* Héros */}
      <section id="top" className="relative overflow-hidden bg-[#2b2118] pt-16 text-white">
        <picture>
          <source srcSet="/images/producteur-cacao.webp" type="image/webp" />
          <img src="/images/producteur-cacao.jpg" alt="Producteur ivoirien étalant ses fèves de cacao au séchage" fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-[35%_center] animate-kenburns" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-[1.25fr_1fr] lg:py-28">
          <div className="[text-shadow:0_1px_12px_rgba(0,0,0,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e9c98b]"><SplitText text="Côte d'Ivoire · filière cacao et café" by="char" delay={300} step={20} variant="soft" /></p>
            <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.1] sm:text-5xl">
              <SplitText text="Prouvez que votre cacao ne vient pas de la déforestation." delay={600} step={70} variant="rise" highlight={['déforestation']} />
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85 mo-soft" style={{ animationDelay: '1.4s' }}>
              GeoCollect cartographie les parcelles de vos producteurs, contrôle leur conformité au règlement européen (EUDR)
              et prépare les dossiers dont l'exportateur a besoin.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 mo-soft" style={{ animationDelay: '1.7s' }}>
              <a href="#demo" className="flex items-center gap-2 rounded-md bg-[#e9c98b] px-6 py-3 font-semibold text-[#183a25] hover:bg-[#f1d7a3]">Demander une démo <ArrowRight className="h-4 w-4" /></a>
              <a href="#tarifs" className="rounded-md border border-white/40 px-6 py-3 font-semibold hover:bg-white/10">Voir les tarifs</a>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-white/20 pt-6 text-sm mo-soft" style={{ animationDelay: '2s' }}>
              <div><dt className="text-white/60">Polygones par analyse</dt><dd className="mt-1 text-xl font-semibold">10 000+</dd></div>
              <div><dt className="text-white/60">Formats de rapport</dt><dd className="mt-1 text-xl font-semibold">6</dd></div>
              <div><dt className="text-white/60">Date de référence</dt><dd className="mt-1 text-xl font-semibold">31/12/2020</dd></div>
            </dl>
          </div>
          <div className="hidden justify-center lg:flex">
            <div key={scene}><SlideMotion index={scene} /></div>
          </div>
        </div>
        <p className="relative mx-auto max-w-6xl px-5 pb-4 text-[11px] text-white/50">Photo : KokoDZ, Wikimedia Commons, CC BY-SA 4.0 · illustrations animées : exemples</p>
      </section>

      {/* Contexte réglementaire */}
      <section className="border-b border-gray-100 bg-[#f6f3ec]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
          {[['Règlement (UE) 2023/1115', 'Le cacao et le café vendus en Europe doivent provenir de parcelles sans déforestation après le 31 décembre 2020.'],
            ['Géolocalisation obligatoire', 'Chaque parcelle doit être localisée : un point sous 4 ha, un polygone au-delà, dans la déclaration de l\'exportateur.'],
            ['Preuves conservées 5 ans', 'Les données de traçabilité doivent pouvoir être présentées aux autorités pendant cinq ans.']].map(([t, d], i) => (
            <Reveal key={t} delay={i * 120}><p className="font-serif text-xl font-semibold text-[#183a25]">{t}</p><p className="mt-2 text-sm leading-relaxed text-gray-600">{d}</p></Reveal>
          ))}
        </div>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <Reveal><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">Fonctionnement</p>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl font-semibold sm:text-4xl">De la parcelle au dossier d'exportation, en quatre étapes.</h2></Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <div className="relative">
                <p className="font-serif text-5xl font-semibold text-primary-100">0{i + 1}</p>
                <s.icon className="mt-2 h-6 w-6 text-primary-700" />
                <p className="mt-3 text-lg font-semibold">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Photos de la filière */}
      <section className="mx-auto grid max-w-6xl gap-3 px-5 sm:grid-cols-3">
        {[['plantation-cacao', 'La plantation', 'Hanay'], ['cabosses-soubre', 'La récolte, Soubré', 'Milequem Diarassouba'], ['sacs-cacao-soubre', 'La mise en sacs, région de Soubré', 'Abdallahbigboy']].map(([img, cap, a], i) => (
          <Reveal key={img} delay={i * 120}>
            <figure className="group overflow-hidden rounded-lg">
              <picture><source srcSet={`/images/${img}.webp`} type="image/webp" />
                <img src={`/images/${img}.jpg`} alt={cap} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-105" /></picture>
              <figcaption className="mt-2 flex justify-between text-xs text-gray-500"><span>{cap}</span><span>{a}, CC BY-SA</span></figcaption>
            </figure>
          </Reveal>
        ))}
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <Reveal><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">Fonctionnalités</p>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl font-semibold sm:text-4xl">Tout ce qu'il faut pour être prêt avant la campagne.</h2></Reveal>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={(i % 4) * 80} className="h-full">
              <div className="h-full bg-white p-6 transition hover:bg-[#f6f3ec]">
                <f.icon className="h-5 w-5 text-primary-700" />
                <p className="mt-4 font-semibold">{f.t}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pour qui */}
      <section className="bg-[#183a25] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-3">
          {[[Building2, 'Coopératives', 'Registre, cartographie des parcelles, suivi des agents et des volumes, rapports prêts pour vos acheteurs.'],
            [Ship, 'Exportateurs', 'Vue consolidée de vos coopératives partenaires, export TRACES, fiches de lot, preuves de conformité.'],
            [Users, 'Agents de terrain', 'Application simple, guidée, qui fonctionne sans réseau et signale les erreurs dès le relevé.']].map(([I, t, d], i) => {
            const Icon = I as typeof Users
            return (
              <Reveal key={t as string} delay={i * 120}>
                <Icon className="h-7 w-7 text-[#e9c98b]" />
                <p className="mt-4 font-serif text-2xl font-semibold">{t as string}</p>
                <p className="mt-3 leading-relaxed text-white/75">{d as string}</p>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <Reveal><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">Tarifs 2026</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Trois formules annuelles, ou un prix à la parcelle.</h2>
          <p className="mt-3 text-gray-600">Montants hors taxes. Hébergement, mises à jour et accès ordinateur et téléphone inclus.</p></Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 120} className="h-full">
              <div className={`relative flex h-full flex-col rounded-xl border p-7 ${p.hot ? 'border-primary-700 shadow-[0_20px_50px_-20px_rgba(24,58,37,.45)]' : 'border-gray-200'}`}>
                {p.hot && <span className="absolute -top-3 left-7 rounded-full bg-primary-700 px-3 py-1 text-xs font-semibold text-white">Recommandée</span>}
                <p className="font-serif text-2xl font-semibold">{p.name}</p>
                <p className="mt-1 text-sm text-gray-500">{p.for}</p>
                <p className="mt-6"><span className="text-4xl font-semibold tabular-nums">{p.price}</span> <span className="text-sm text-gray-500">FCFA / an</span></p>
                <p className="text-sm text-gray-500">soit {p.month} FCFA / mois</p>
                <div className="mt-5 flex flex-wrap gap-2">{p.limits.map((l) => <span key={l} className="rounded bg-[#f6f3ec] px-2.5 py-1 text-xs font-medium text-[#183a25]">{l}</span>)}</div>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">{p.items.map((it) => <li key={it} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-700" />{it}</li>)}</ul>
                <a href="#demo" className={`mt-8 rounded-md px-5 py-2.5 text-center font-semibold ${p.hot ? 'bg-primary-700 text-white hover:bg-primary-800' : 'border border-gray-300 hover:border-primary-700 hover:text-primary-700'}`}>Choisir {p.name}</a>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Reveal><div className="h-full rounded-xl border border-gray-200 p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Sans abonnement</p>
            <p className="mt-2 font-serif text-2xl font-semibold">Paiement à la parcelle</p>
            <p className="mt-3"><span className="text-3xl font-semibold">1 200</span> <span className="text-sm text-gray-500">FCFA par parcelle cartographiée</span></p>
            <p className="mt-3 text-sm text-gray-600">Vous ne payez que les parcelles relevées dans l'application. Exemple : 1 000 parcelles = 1 200 000 FCFA.</p>
          </div></Reveal>
          <Reveal delay={120}><div className="h-full rounded-xl bg-[#183a25] p-7 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e9c98b]">Acquisition</p>
            <p className="mt-2 font-serif text-2xl font-semibold">Devenez propriétaire de la solution</p>
            <p className="mt-3"><span className="text-3xl font-semibold">12 000 000</span> <span className="text-sm text-white/70">FCFA, paiement unique</span></p>
            <p className="mt-3 text-sm text-white/75">Toutes les fonctionnalités Exportateur, installation, formation et accompagnement au démarrage. Plus avantageuse dès la 2e année face à la formule Exportateur.</p>
          </div></Reveal>
        </div>
      </section>

      {/* Démo */}
      <section id="demo" className="scroll-mt-20 bg-[#f6f3ec]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">Démonstration gratuite</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">Voyez GeoCollect sur vos propres données.</h2>
            <p className="mt-4 leading-relaxed text-gray-600">Envoyez-nous un extrait de votre registre ou de vos polygones : nous vous montrons en direct l'analyse de déforestation, le contrôle des parcelles et l'export TRACES.</p>
            <div className="mt-8 space-y-1 text-sm">
              <p className="font-semibold">Jean David Konan · GeoLab Service</p>
              <p className="text-gray-600">Abidjan, Côte d'Ivoire</p>
              <p><a href="tel:+2250714039692" className="text-primary-700 hover:underline">+225 07 14 03 96 92</a></p>
              <p><a href="mailto:jeandavidkyao@gmail.com" className="text-primary-700 hover:underline">jeandavidkyao@gmail.com</a></p>
            </div>
          </Reveal>
          <Reveal delay={120}><div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8"><DemoForm /></div></Reveal>
        </div>
      </section>

      <footer className="bg-[#0f1f15] text-white/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm">
          <AnimatedLogo />
          <p>© {new Date().getFullYear()} GeoLab Service · Abidjan</p>
          <div className="flex gap-5"><Link to="/login" className="hover:text-white">Se connecter</Link><Link to="/cgu" className="hover:text-white">CGU</Link><Link to="/confidentialite" className="hover:text-white">Confidentialité</Link></div>
        </div>
      </footer>
    </div>
  )
}
