import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPinned, ShieldCheck, Satellite, FileCheck2, BookOpen, Layers, Users, Building2, Ship, Check, ArrowRight, Menu, X,
  Smartphone, WifiOff, Bell, Lock, Loader2, CheckCircle2,
} from 'lucide-react'
import api from '../../api/client'
import { AnimatedLogo, SplitText } from '../../components/auth/MotionText'
import SlideMotion from '../../components/auth/SlideMotion'
import { useT, useLang, LangSwitch } from '../../i18n'

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
  { icon: BookOpen, title: ['Recenser', 'Register'], text: ['Le registre des producteurs est importé depuis Excel : noms, villages, sections, codes producteurs.', 'The farmer register is imported from Excel: names, villages, sections, farmer codes.'] },
  { icon: MapPinned, title: ['Cartographier', 'Map'], text: ['Les agents relèvent chaque parcelle au GPS sur téléphone, même sans réseau en brousse.', 'Field agents survey every plot with phone GPS, even with no network in the bush.'] },
  { icon: Satellite, title: ['Contrôler', 'Check'], text: ['Chevauchements, auto-intersections et perte de forêt après le 31 décembre 2020 sont vérifiés automatiquement.', 'Overlaps, self-intersections and forest loss after 31 December 2020 are checked automatically.'] },
  { icon: Ship, title: ['Exporter', 'Export'], text: ['Fichier TRACES, fiches de lot et rapports PDF pour la déclaration de diligence raisonnable de l\'exportateur.', 'TRACES file, lot sheets and PDF reports for the exporter\'s due diligence statement.'] },
]

const FEATURES = [
  { icon: Smartphone, t: ['Mapping GPS mobile', 'Mobile GPS mapping'], d: ['Application pour les agents de terrain, tracé des parcelles et rattachement au producteur.', 'App for field agents: plot boundaries linked to the farmer.'] },
  { icon: WifiOff, t: ['Hors ligne', 'Offline'], d: ['Les parcelles sont gardées sur le téléphone et envoyées au retour du réseau.', 'Plots are kept on the phone and sent when the network is back.'] },
  { icon: Satellite, t: ['Analyse déforestation', 'Deforestation analysis'], d: ['Carte forêt 2020 de l\'UE (JRC), données Hansen, normes EUDR et Rainforest Alliance, forêts classées.', 'EU 2020 forest map (JRC), Hansen data, EUDR and Rainforest Alliance rules, classified forests.'] },
  { icon: ShieldCheck, t: ['Polygon Validator', 'Polygon Validator'], d: ['Plus de 10 000 polygones contrôlés en une fois : superpositions, doublons, géométries.', 'Over 10,000 polygons checked at once: overlaps, duplicates, geometries.'] },
  { icon: FileCheck2, t: ['Export TRACES', 'TRACES export'], d: ['GeoJSON conforme au système d\'information de l\'UE, contrôlé avant téléchargement.', 'GeoJSON compliant with the EU Information System, checked before download.'] },
  { icon: Layers, t: ['Outils SIG', 'GIS tools'], d: ['Table attributaire, édition des sommets, mesures : l\'essentiel de QGIS dans le navigateur.', 'Attribute table, vertex editing, measurements: the essentials of QGIS in the browser.'] },
  { icon: Bell, t: ['Suivi en temps réel', 'Real-time tracking'], d: ['Tableaux de bord, notifications et messagerie entre exportateur, coopératives et agents.', 'Dashboards, notifications and messaging between exporter, cooperatives and agents.'] },
  { icon: Lock, t: ['Données cloisonnées', 'Isolated data'], d: ['Chaque coopérative ne voit que ses propres données ; plateforme supervisée en continu.', 'Each cooperative only sees its own data; the platform is monitored continuously.'] },
]

type Pair = [string, string]
const PLANS: { name: Pair; price: string; month: string; for: Pair; hot?: boolean; limits: Pair[]; items: Pair[] }[] = [
  { name: ['Essentiel', 'Essential'], price: '2 000 000', month: '166 667', for: ['Une coopérative qui démarre sa cartographie EUDR', 'A cooperative starting its EUDR mapping'],
    limits: [['1 coopérative', '1 cooperative'], ['2 000 parcelles', '2,000 plots'], ['5 agents', '5 agents']],
    items: [['Mapping GPS mobile', 'Mobile GPS mapping'], ['Polygon Validator', 'Polygon Validator'], ['Registre des producteurs, import Excel', 'Farmer register, Excel import'], ['Rapports PDF, Excel et SIG', 'PDF, Excel and GIS reports'], ['Support par e-mail', 'E-mail support']] },
  { name: ['Pro', 'Pro'], price: '4 000 000', month: '333 333', for: ['Une ou deux coopératives qui préparent leurs dossiers de conformité', 'One or two cooperatives preparing their compliance files'], hot: true,
    limits: [['2 coopératives', '2 cooperatives'], ['10 000 parcelles', '10,000 plots'], ['10 agents', '10 agents']],
    items: [['Tout Essentiel', 'Everything in Essential'], ['Analyse déforestation et matrice RDUE', 'Deforestation analysis and EUDR risk matrix'], ['Self-intersection, Polygon & GMR', 'Self-intersection, Polygon & GMR'], ['Outils SIG d\'édition', 'GIS editing tools'], ['Export TRACES', 'TRACES export'], ['Formation des agents', 'Agent training'], ['Support WhatsApp prioritaire', 'Priority WhatsApp support']] },
  { name: ['Exportateur', 'Exporter'], price: '8 500 000', month: '708 333', for: ['Un exportateur et ses coopératives partenaires', 'An exporter and its partner cooperatives'],
    limits: [['Jusqu\'à 10 coopératives', 'Up to 10 cooperatives'], ['Parcelles illimitées', 'Unlimited plots'], ['Agents illimités', 'Unlimited agents']],
    items: [['Tout Pro, pour chaque coopérative', 'Everything in Pro, for each cooperative'], ['Espace multi-coopératives', 'Multi-cooperative workspace'], ['Carte et tableaux consolidés', 'Consolidated map and dashboards'], ['Journal d\'activité complet', 'Full activity log'], ['Formation sur site', 'On-site training'], ['Accompagnement dédié', 'Dedicated support']] },
]

function DemoForm() {
  const t = useT()
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
      setError(d?.status === 429 ? t('Trop de demandes envoyées. Réessayez plus tard ou appelez-nous.', 'Too many requests. Try again later or call us.')
        : d?.data ? Object.values(d.data).flat().join(' ') : t('Envoi impossible. Vérifiez votre connexion ou appelez-nous.', 'Could not send. Check your connection or call us.'))
      setState('error')
    }
  }
  const input = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600'
  if (state === 'done') return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary-700" />
      <p className="mt-3 font-serif text-2xl font-semibold text-gray-900">{t('Merci, votre demande est envoyée.', 'Thank you, your request has been sent.')}</p>
      <p className="mt-2 text-sm text-gray-600">{t('Nous vous rappelons sous 48 heures pour fixer la démonstration, sur vos propres données si vous le souhaitez.', 'We will call you back within 48 hours to schedule the demo, on your own data if you wish.')}</p>
    </div>
  )
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="text-sm text-gray-700">{t('Nom et prénom', 'Full name')} *<input required value={f.full_name} onChange={set('full_name')} className={input} autoComplete="name" /></label>
      <label className="text-sm text-gray-700">{t('Structure', 'Organisation')} *<input required value={f.organization} onChange={set('organization')} className={input} placeholder={t('Coopérative, exportateur…', 'Cooperative, exporter…')} autoComplete="organization" /></label>
      <label className="text-sm text-gray-700">{t('Vous êtes', 'You are')}
        <select value={f.profile} onChange={set('profile')} className={input}>
          <option value="cooperative">{t('Une coopérative', 'A cooperative')}</option><option value="exportateur">{t('Un exportateur', 'An exporter / buyer')}</option>
          <option value="certification">{t('Un organisme de certification', 'A certification body')}</option><option value="autre">{t('Autre', 'Other')}</option>
        </select>
      </label>
      <label className="text-sm text-gray-700">{t('Téléphone (WhatsApp)', 'Phone (WhatsApp)')} *<input required value={f.phone} onChange={set('phone')} className={input} placeholder="07 00 00 00 00" autoComplete="tel" inputMode="tel" /></label>
      <label className="text-sm text-gray-700">E-mail<input type="email" value={f.email} onChange={set('email')} className={input} autoComplete="email" /></label>
      <label className="text-sm text-gray-700">{t('Nombre de producteurs (environ)', 'Number of farmers (approx.)')}<input type="number" min="0" value={f.producers} onChange={set('producers')} className={input} /></label>
      <label className="text-sm text-gray-700 sm:col-span-2">{t('Formule envisagée', 'Plan considered')}
        <select value={f.plan} onChange={set('plan')} className={input}>
          <option value="">{t('Je ne sais pas encore', 'Not sure yet')}</option><option value="essentiel">{t('Essentiel', 'Essential')}</option><option value="pro">Pro</option>
          <option value="exportateur">{t('Exportateur', 'Exporter')}</option><option value="parcelle">{t('Paiement à la parcelle', 'Pay per plot')}</option><option value="acquisition">{t('Acquisition', 'Licence purchase')}</option>
        </select>
      </label>
      <label className="text-sm text-gray-700 sm:col-span-2">Message<textarea rows={3} value={f.message} onChange={set('message')} className={input} placeholder={t('Votre besoin, votre calendrier, la campagne concernée…', 'Your needs, timeline, the season concerned…')} /></label>
      <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden="true" />
      {state === 'error' && <p role="alert" className="sm:col-span-2 rounded-md border-l-4 border-red-500 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{error}</p>}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
        <button disabled={state === 'sending'} className="flex items-center gap-2 rounded-md bg-primary-700 px-6 py-3 font-semibold text-white hover:bg-primary-800 disabled:opacity-60">
          {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {t('Demander ma démonstration', 'Request my demo')}
        </button>
        <p className="text-xs text-gray-500">{t('Démonstration gratuite, sans engagement. Vos informations servent uniquement à vous recontacter.', 'Free demo, no commitment. Your details are only used to contact you.')}</p>
      </div>
    </form>
  )
}

export default function LandingPage() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const L = (p: Pair) => (lang === 'en' ? p[1] : p[0])
  const [menu, setMenu] = useState(false)
  const [scene, setScene] = useState(0)
  useEffect(() => { const t = setInterval(() => setScene((s) => (s + 1) % 5), 6500); return () => clearInterval(t) }, [])
  useEffect(() => { document.title = t('GeoCollect EUDR — Traçabilité du cacao et conformité EUDR', 'GeoCollect EUDR — Cocoa traceability and EUDR compliance') }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const nav = [['#fonctionnement', t('Fonctionnement', 'How it works')], ['#fonctionnalites', t('Fonctionnalités', 'Features')], ['#tarifs', t('Tarifs', 'Pricing')], ['#demo', 'Contact']]

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
            <LangSwitch dark />
            <Link to="/login" className="text-sm font-medium text-white/85 hover:text-white">{t('Se connecter', 'Sign in')}</Link>
            <a href="#demo" className="rounded-md bg-[#e9c98b] px-4 py-2 text-sm font-semibold text-[#183a25] hover:bg-[#f1d7a3]">{t('Demander une démo', 'Request a demo')}</a>
          </div>
          <div className="flex items-center gap-3 md:hidden">
            <LangSwitch dark />
            <button onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X /> : <Menu />}</button>
          </div>
        </div>
        {menu && (
          <div className="border-t border-white/10 px-5 py-4 md:hidden">
            {nav.map(([h, l]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block py-2 text-white/85">{l}</a>)}
            <Link to="/login" className="mt-2 block py-2 font-medium">{t('Se connecter', 'Sign in')}</Link>
          </div>
        )}
      </header>

      {/* Héros */}
      <section id="top" className="relative overflow-hidden bg-[#2b2118] pt-16 text-white">
        <picture>
          <source srcSet="/images/producteur-cacao.webp" type="image/webp" />
          <img src="/images/producteur-cacao.jpg" alt={t('Producteur ivoirien étalant ses fèves de cacao au séchage', 'Ivorian farmer spreading cocoa beans to dry')} fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-[35%_center] animate-kenburns" />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/25" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 lg:grid-cols-[1.25fr_1fr] lg:py-28">
          <div className="[text-shadow:0_1px_12px_rgba(0,0,0,0.4)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e9c98b]"><SplitText key={lang} text={t("Côte d'Ivoire · filière cacao et café", "Côte d'Ivoire · cocoa and coffee supply chain")} by="char" delay={300} step={20} variant="soft" /></p>
            <h1 className="mt-5 font-serif text-4xl font-semibold leading-[1.1] sm:text-5xl">
              <SplitText key={lang} text={t('Prouvez que votre cacao ne vient pas de la déforestation.', 'Prove that your cocoa is deforestation-free.')} delay={600} step={70} variant="rise" highlight={[t('déforestation', 'deforestation-free')]} />
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85 mo-soft" style={{ animationDelay: '1.4s' }}>
              {t("GeoCollect cartographie les parcelles de vos producteurs, contrôle leur conformité au règlement européen (EUDR) et prépare les dossiers dont l'exportateur a besoin.",
                'GeoCollect maps your farmers\' plots, checks their compliance with the EU Deforestation Regulation (EUDR) and prepares the files exporters and EU buyers need.')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 mo-soft" style={{ animationDelay: '1.7s' }}>
              <a href="#demo" className="flex items-center gap-2 rounded-md bg-[#e9c98b] px-6 py-3 font-semibold text-[#183a25] hover:bg-[#f1d7a3]">{t('Demander une démo', 'Request a demo')} <ArrowRight className="h-4 w-4" /></a>
              <a href="#tarifs" className="rounded-md border border-white/40 px-6 py-3 font-semibold hover:bg-white/10">{t('Voir les tarifs', 'See pricing')}</a>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-white/20 pt-6 text-sm mo-soft" style={{ animationDelay: '2s' }}>
              <div><dt className="text-white/60">{t('Polygones par analyse', 'Polygons per analysis')}</dt><dd className="mt-1 text-xl font-semibold">10 000+</dd></div>
              <div><dt className="text-white/60">{t('Formats de rapport', 'Report formats')}</dt><dd className="mt-1 text-xl font-semibold">6</dd></div>
              <div><dt className="text-white/60">{t('Date de référence', 'Cut-off date')}</dt><dd className="mt-1 text-xl font-semibold">31/12/2020</dd></div>
            </dl>
          </div>
          <div className="hidden justify-center lg:flex">
            <div key={scene}><SlideMotion index={scene} /></div>
          </div>
        </div>
        <p className="relative mx-auto max-w-6xl px-5 pb-4 text-[11px] text-white/50">{t('Photo : KokoDZ, Wikimedia Commons, CC BY-SA 4.0 · illustrations animées : exemples', 'Photo: KokoDZ, Wikimedia Commons, CC BY-SA 4.0 · animated illustrations: examples')}</p>
      </section>

      {/* Contexte réglementaire */}
      <section className="border-b border-gray-100 bg-[#f6f3ec]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
          {[[t('Règlement (UE) 2023/1115', 'Regulation (EU) 2023/1115'), t('Le cacao et le café vendus en Europe doivent provenir de parcelles sans déforestation après le 31 décembre 2020.', 'Cocoa and coffee sold in the EU must come from plots with no deforestation after 31 December 2020.')],
            [t('Géolocalisation obligatoire', 'Mandatory geolocation'), t("Chaque parcelle doit être localisée : un point sous 4 ha, un polygone au-delà, dans la déclaration de l'exportateur.", "Every plot must be geolocated: a point below 4 ha, a polygon above, in the operator's due diligence statement.")],
            [t('Preuves conservées 5 ans', 'Evidence kept for 5 years'), t('Les données de traçabilité doivent pouvoir être présentées aux autorités pendant cinq ans.', 'Traceability data must be available to competent authorities for five years.')]].map(([title, d], i) => (
            <Reveal key={title} delay={i * 120}><p className="font-serif text-xl font-semibold text-[#183a25]">{title}</p><p className="mt-2 text-sm leading-relaxed text-gray-600">{d}</p></Reveal>
          ))}
        </div>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <Reveal><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">{t('Fonctionnement', 'How it works')}</p>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl font-semibold sm:text-4xl">{t("De la parcelle au dossier d'exportation, en quatre étapes.", 'From plot to export file, in four steps.')}</h2></Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title[0]} delay={i * 120}>
              <div className="relative">
                <p className="font-serif text-5xl font-semibold text-primary-100">0{i + 1}</p>
                <s.icon className="mt-2 h-6 w-6 text-primary-700" />
                <p className="mt-3 text-lg font-semibold">{L(s.title as Pair)}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{L(s.text as Pair)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Photos de la filière */}
      <section className="mx-auto grid max-w-6xl gap-3 px-5 sm:grid-cols-3">
        {[['plantation-cacao', t('La plantation', 'The plantation'), 'Hanay'], ['cabosses-soubre', t('La récolte, Soubré', 'Harvest, Soubré'), 'Milequem Diarassouba'], ['sacs-cacao-soubre', t('La mise en sacs, région de Soubré', 'Bagging, Soubré region'), 'Abdallahbigboy']].map(([img, cap, a], i) => (
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
        <Reveal><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">{t('Fonctionnalités', 'Features')}</p>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl font-semibold sm:text-4xl">{t("Tout ce qu'il faut pour être prêt avant la campagne.", 'Everything you need to be ready before the season.')}</h2></Reveal>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t[0]} delay={(i % 4) * 80} className="h-full">
              <div className="h-full bg-white p-6 transition hover:bg-[#f6f3ec]">
                <f.icon className="h-5 w-5 text-primary-700" />
                <p className="mt-4 font-semibold">{L(f.t as Pair)}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{L(f.d as Pair)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pour qui */}
      <section className="bg-[#183a25] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-3">
          {[[Building2, t('Coopératives', 'Cooperatives'), t('Registre, cartographie des parcelles, suivi des agents et des volumes, rapports prêts pour vos acheteurs.', 'Register, plot mapping, agent and volume tracking, reports ready for your buyers.')],
            [Ship, t('Exportateurs', 'Exporters & EU buyers'), t('Vue consolidée de vos coopératives partenaires, export TRACES, fiches de lot, preuves de conformité.', 'Consolidated view of partner cooperatives, TRACES export, lot sheets, compliance evidence.')],
            [Users, t('Agents de terrain', 'Field agents'), t('Application simple, guidée, qui fonctionne sans réseau et signale les erreurs dès le relevé.', 'Simple, guided app that works offline and flags errors during the survey.')]].map(([I, t, d], i) => {
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
        <Reveal><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">{t('Tarifs 2026', 'Pricing 2026')}</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">{t('Trois formules annuelles, ou un prix à la parcelle.', 'Three annual plans, or a price per plot.')}</h2>
          <p className="mt-3 text-gray-600">{t('Montants hors taxes. Hébergement, mises à jour et accès ordinateur et téléphone inclus.', 'Prices excluding tax. Hosting, updates and computer and phone access included.')}</p></Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name[0]} delay={i * 120} className="h-full">
              <div className={`relative flex h-full flex-col rounded-xl border p-7 ${p.hot ? 'border-primary-700 shadow-[0_20px_50px_-20px_rgba(24,58,37,.45)]' : 'border-gray-200'}`}>
                {p.hot && <span className="absolute -top-3 left-7 rounded-full bg-primary-700 px-3 py-1 text-xs font-semibold text-white">{t('Recommandée', 'Recommended')}</span>}
                <p className="font-serif text-2xl font-semibold">{L(p.name)}</p>
                <p className="mt-1 text-sm text-gray-500">{L(p.for)}</p>
                <p className="mt-6"><span className="text-4xl font-semibold tabular-nums">{p.price}</span> <span className="text-sm text-gray-500">{t('FCFA / an', 'FCFA / year')}</span></p>
                <p className="text-sm text-gray-500">{t(`soit ${p.month} FCFA / mois`, `i.e. ${p.month} FCFA / month`)}</p>
                <div className="mt-5 flex flex-wrap gap-2">{p.limits.map((l) => <span key={l[0]} className="rounded bg-[#f6f3ec] px-2.5 py-1 text-xs font-medium text-[#183a25]">{L(l)}</span>)}</div>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">{p.items.map((it) => <li key={it[0]} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-700" />{L(it)}</li>)}</ul>
                <a href="#demo" className={`mt-8 rounded-md px-5 py-2.5 text-center font-semibold ${p.hot ? 'bg-primary-700 text-white hover:bg-primary-800' : 'border border-gray-300 hover:border-primary-700 hover:text-primary-700'}`}>{t('Choisir', 'Choose')} {L(p.name)}</a>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Reveal><div className="h-full rounded-xl border border-gray-200 p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{t('Sans abonnement', 'No subscription')}</p>
            <p className="mt-2 font-serif text-2xl font-semibold">{t('Paiement à la parcelle', 'Pay per plot')}</p>
            <p className="mt-3"><span className="text-3xl font-semibold">1 200</span> <span className="text-sm text-gray-500">{t('FCFA par parcelle cartographiée', 'FCFA per mapped plot')}</span></p>
            <p className="mt-3 text-sm text-gray-600">{t("Vous ne payez que les parcelles relevées dans l'application. Exemple : 1 000 parcelles = 1 200 000 FCFA.", 'You only pay for plots surveyed in the app. Example: 1,000 plots = 1,200,000 FCFA.')}</p>
          </div></Reveal>
          <Reveal delay={120}><div className="h-full rounded-xl bg-[#183a25] p-7 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e9c98b]">{t('Acquisition', 'Licence purchase')}</p>
            <p className="mt-2 font-serif text-2xl font-semibold">{t('Devenez propriétaire de la solution', 'Own the solution')}</p>
            <p className="mt-3"><span className="text-3xl font-semibold">12 000 000</span> <span className="text-sm text-white/70">{t('FCFA, paiement unique', 'FCFA, one-off payment')}</span></p>
            <p className="mt-3 text-sm text-white/75">{t('Toutes les fonctionnalités Exportateur, installation, formation et accompagnement au démarrage. Plus avantageuse dès la 2e année face à la formule Exportateur.', 'All Exporter features, installation, training and onboarding support. Better value than the Exporter plan from the second year.')}</p>
          </div></Reveal>
        </div>
      </section>

      {/* Démo */}
      <section id="demo" className="scroll-mt-20 bg-[#f6f3ec]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">{t('Démonstration gratuite', 'Free demo')}</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold sm:text-4xl">{t('Voyez GeoCollect sur vos propres données.', 'See GeoCollect on your own data.')}</h2>
            <p className="mt-4 leading-relaxed text-gray-600">{t("Envoyez-nous un extrait de votre registre ou de vos polygones : nous vous montrons en direct l'analyse de déforestation, le contrôle des parcelles et l'export TRACES.", 'Send us an extract of your register or polygons: we will show you the deforestation analysis, plot checks and TRACES export live.')}</p>
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
          <div className="flex gap-5"><Link to="/login" className="hover:text-white">{t('Se connecter', 'Sign in')}</Link><Link to="/cgu" className="hover:text-white">{t('CGU', 'Terms')}</Link><Link to="/confidentialite" className="hover:text-white">{t('Confidentialité', 'Privacy')}</Link></div>
        </div>
      </footer>
    </div>
  )
}
