import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Leaf, Loader2, Shield } from 'lucide-react'
import { useAuthStore, MOCK_USERS } from '../../store/authStore'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  // Motif d'une déconnexion forcée (organisation suspendue, abonnement expiré…)
  const [error, setError] = useState(() => {
    try { return sessionStorage.getItem('geocollect-logout-reason') || '' } catch { return '' }
  })
  // le motif n'est affiché qu'une fois : effacé après le premier affichage
  useEffect(() => { try { sessionStorage.removeItem('geocollect-logout-reason') } catch { /* indisponible */ } }, [])

  const { loginWithApi, loginWithGoogle, loginMock } = useAuthStore()
  const navigate = useNavigate()

  const goHome = () => {
    const currentRole = useAuthStore.getState().user?.role
    if (currentRole === 'owner') navigate('/owner')
    else if (currentRole === 'super_admin') navigate('/admin')
    else if (currentRole === 'cooperative') navigate('/coop')
    else navigate('/agent')
  }

  const handleGoogle = async (credential: string) => {
    setError(''); setLoading(true)
    try {
      await loginWithGoogle(credential)
      setLoading(false)
      goHome()
    } catch (err) {
      const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(d || 'Connexion Google impossible. Réessayez.')
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await loginWithApi(username, password)
    } catch (err) {
      const resp = (err as { response?: { status?: number; data?: { code?: string; detail?: string } } })?.response
      const status = resp?.status
      // Organisation suspendue / abonnement expiré / coopérative désactivée : on affiche le vrai motif
      if (resp?.data?.code === 'tenant_inactive' && resp.data.detail) {
        setError(resp.data.detail)
        setLoading(false)
        return
      }
      // En production : jamais de connexion « démo » de secours (elle masquait les vraies erreurs)
      if (!import.meta.env.DEV) {
        setError(status === 429 ? 'Trop de tentatives. Patientez une minute avant de réessayer.'
          : status ? 'Identifiant ou mot de passe incorrect.'
          : 'Serveur injoignable. Vérifiez votre connexion Internet et réessayez.')
        setLoading(false)
        return
      }
      // Développement local uniquement : données de démonstration
      const found = MOCK_USERS[username]
      if (!found || found.password !== password) {
        setError('Identifiant ou mot de passe incorrect.')
        setLoading(false)
        return
      }
      loginMock(found.user, 'mock-jwt-token-' + Date.now())
    }

    setLoading(false)
    goHome()
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(420px,1fr)]">
      {/* Photo : producteur de cacao en Côte d'Ivoire */}
      <aside className="relative h-56 sm:h-72 lg:h-auto lg:min-h-screen overflow-hidden bg-[#2b2118]">
        <picture>
          <source srcSet="/images/producteur-cacao.webp" type="image/webp" />
          <img src="/images/producteur-cacao.jpg" alt="Producteur ivoirien étalant ses fèves de cacao au séchage"
            className="absolute inset-0 h-full w-full object-cover object-[35%_center]" />
        </picture>
        {/* ombrage : haut (logo), bas et gauche (texte) — le producteur reste lisible à droite */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/45" />
        <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-black/55 via-black/15 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-10 lg:p-14 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-primary-700"><Leaf className="h-5 w-5" /></span>
            <span className="text-[15px] font-semibold tracking-wide">GeoCollect <span className="font-normal text-white/70">EUDR</span></span>
          </div>

          <div className="hidden lg:block max-w-xl [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e9c98b]">Côte d'Ivoire · filière cacao</p>
            <h1 className="mt-4 font-serif text-[2.6rem] leading-[1.12] font-semibold">
              La traçabilité du cacao, de la parcelle jusqu'à l'exportation.
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-white/80 max-w-lg">
              Cartographie GPS des parcelles par les agents de terrain, contrôle de conformité au règlement européen
              contre la déforestation, et dossiers prêts pour les exportateurs.
            </p>
            <dl className="mt-9 grid grid-cols-3 gap-6 border-t border-white/20 pt-6 text-sm">
              <div><dt className="text-white/60">Coopératives</dt><dd className="mt-1 font-medium">Registre et parcelles</dd></div>
              <div><dt className="text-white/60">Agents</dt><dd className="mt-1 font-medium">Mapping GPS mobile</dd></div>
              <div><dt className="text-white/60">Exportateurs</dt><dd className="mt-1 font-medium">Preuves de conformité</dd></div>
            </dl>
          </div>

          <p className="text-[11px] text-white/55">
            Photo : KokoDZ, <a href="https://commons.wikimedia.org/wiki/File:Cultivateur_de_cacao_01.jpg" target="_blank" rel="noreferrer" className="underline hover:text-white">Wikimedia Commons</a>, CC BY-SA 4.0
          </p>
        </div>
      </aside>

      {/* Formulaire */}
      <main className="flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-16 lg:py-14">
        <div className="mx-auto w-full max-w-sm lg:mt-[12vh]">
          <h2 className="font-serif text-3xl font-semibold text-gray-900">Connexion</h2>
          <p className="mt-2 text-sm text-gray-500">Accédez à votre espace coopérative, administrateur ou agent de terrain.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-user" className="block text-sm font-medium text-gray-800 mb-1.5">Identifiant</label>
              <input id="login-user" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre identifiant" required
                className="w-full rounded-md border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
            </div>
            <div>
              <label htmlFor="login-pass" className="block text-sm font-medium text-gray-800 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input id="login-pass" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  className="w-full rounded-md border border-gray-300 px-3.5 py-2.5 pr-11 text-gray-900 shadow-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-md border-l-4 border-red-500 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                <Shield className="mt-0.5 h-4 w-4 flex-shrink-0" />{error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary-700 py-2.5 font-semibold text-white shadow-sm transition hover:bg-primary-800 disabled:opacity-60">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Connexion…</> : 'Se connecter'}
            </button>
          </form>
          <GoogleSignInButton onCredential={handleGoogle} disabled={loading} />

          <p className="mt-6 text-xs leading-relaxed text-gray-500">
            Mot de passe oublié ? Votre coopérative ou votre administrateur peut vous en attribuer un nouveau.
          </p>

          {/* Comptes de démonstration : développement local uniquement (jamais affichés en ligne) */}
          {import.meta.env.DEV && <div className="mt-6 border-t border-gray-100 pt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Comptes de démonstration</p>
            <div className="flex flex-wrap gap-2">
              {[['admin', 'admin123'], ['coop', 'coop123'], ['agent', 'agent123']].map(([u, pw]) => (
                <button key={u} type="button" onClick={() => { setUsername(u); setPassword(pw) }}
                  className="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">{u}</button>
              ))}
            </div>
          </div>}
        </div>

        {/* Bandeau : les deux autres photos de la filière */}
        <div className="mx-auto mt-12 w-full max-w-sm">
          <div className="grid grid-cols-2 gap-3">
            <figure>
              <picture><source srcSet="/images/cabosses-soubre.webp" type="image/webp" />
                <img src="/images/cabosses-soubre.jpg" alt="Cabosses de cacao récoltées à Soubré" loading="lazy" className="aspect-[4/3] w-full rounded object-cover" /></picture>
              <figcaption className="mt-1.5 text-[11px] text-gray-500">Cabosses récoltées, Soubré</figcaption>
            </figure>
            <figure>
              <picture><source srcSet="/images/feves-soubre.webp" type="image/webp" />
                <img src="/images/feves-soubre.jpg" alt="Fèves de cacao au séchage à Soubré" loading="lazy" className="aspect-[4/3] w-full rounded object-cover" /></picture>
              <figcaption className="mt-1.5 text-[11px] text-gray-500">Fèves au séchage, Soubré</figcaption>
            </figure>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Photos : Milequem Diarassouba, Wikimedia Commons, CC BY-SA 4.0</p>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-5 text-xs text-gray-500">
            <span>© {new Date().getFullYear()} GeoLab Service · Abidjan</span>
            <span className="flex gap-4">
              <Link to="/cgu" className="hover:text-gray-800">CGU</Link>
              <Link to="/confidentialite" className="hover:text-gray-800">Confidentialité</Link>
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
