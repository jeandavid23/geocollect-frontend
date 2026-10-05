import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Leaf, Loader2, MapPin, Shield } from 'lucide-react'
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
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-green-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-green-300 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-2xl mb-4">
            <Leaf className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            GeoCollect EUDR
          </h1>
          <p className="text-primary-200 mt-1 text-sm">
            Plateforme WebSIG de collecte et de suivi EUDR
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            Connexion à votre espace
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Identifiant
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin / coop / agent"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 pr-12 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <Shield className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
          <GoogleSignInButton onCredential={handleGoogle} disabled={loading} />

          {/* Comptes de démonstration : développement local uniquement (jamais affichés en ligne) */}
          {import.meta.env.DEV && <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
              Comptes de démonstration
            </p>
            <div className="space-y-2">
              {[
                { role: 'Super Admin', user: 'admin', pass: 'admin123', color: 'bg-purple-50 border-purple-200 text-purple-700' },
                { role: 'Coopérative', user: 'coop', pass: 'coop123', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                { role: 'Agent Mappeur', user: 'agent', pass: 'agent123', color: 'bg-green-50 border-green-200 text-green-700' },
              ].map(({ role, user, pass, color }) => (
                <button
                  key={user}
                  onClick={() => { setUsername(user); setPassword(pass) }}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition hover:opacity-80 ${color}`}
                >
                  <span className="font-semibold">{role}</span>
                  <span className="opacity-70 ml-2">— {user} / {pass}</span>
                </button>
              ))}
            </div>
          </div>}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary-200 text-xs">
            <MapPin className="w-3.5 h-3.5" />
            <span>Polygon Validator EUDR by JDK · © {new Date().getFullYear()} GeoCollect</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-primary-300 text-xs">
            <Link to="/cgu" className="hover:text-white underline">CGU</Link>
            <span>·</span>
            <Link to="/confidentialite" className="hover:text-white underline">Confidentialité</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
