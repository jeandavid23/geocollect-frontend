import { useT, useLang, LangSwitch } from '../../i18n'
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Shield, ShieldCheck, MapPinned, Lock, ArrowRight, LogIn, Minimize2 } from 'lucide-react'
import { useAuthStore, MOCK_USERS } from '../../store/authStore'
import { isRemembered } from '../../store/authStorage'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import HeroSlideshow from '../../components/auth/HeroSlideshow'
import { AnimatedLogo, SplitText } from '../../components/auth/MotionText'

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

  const { loginWithApi, loginWithGoogle, loginMock, verifyMfa } = useAuthStore()
  const [remember, setRemember] = useState(() => isRemembered())
  // 2e étape : double authentification active → code à 6 chiffres (ou code de secours)
  const [mfa, setMfa] = useState<{ token: string; name: string } | null>(null)
  const [code, setCode] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
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
      const r = await loginWithGoogle(credential, remember)
      setLoading(false)
      if (r.mfaToken) { setMfa({ token: r.mfaToken, name: '' }); return }
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
      const r = await loginWithApi(username, password, remember)
      if (r.mfaToken) { setMfa({ token: r.mfaToken, name: username }); setCode(''); setLoading(false); return }
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

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfa) return
    setError(''); setLoading(true)
    try {
      await verifyMfa(mfa.token, code.trim())
      setLoading(false)
      goHome()
    } catch (err) {
      const d = (err as { response?: { data?: { detail?: string; code?: string } } })?.response?.data
      if (d?.code === 'mfa_expired') { setMfa(null); setPassword('') }
      setError(d?.detail || 'Code incorrect.')
      setLoading(false)
    }
  }

  const [collapsed, setCollapsed] = useState(false)
  const t = useT()
  const lang = useLang((st) => st.lang)
  const input = 'w-full rounded-lg border border-gray-300/80 bg-white/80 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/30'

  return (
    <div className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-[#2b2118]">
      {/* Diaporama plein écran : le parcours du cacao en Côte d'Ivoire */}
      <HeroSlideshow reserveRight={collapsed ? 'pill' : 'card'}
        headline={
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              <SplitText key={lang} text={t("Côte d'Ivoire · filière cacao", "Côte d'Ivoire · cocoa supply chain")} by="char" delay={500} step={22} variant="soft" />
            </p>
            <h1 className="mt-4 font-serif text-[2.4rem] xl:text-[3.1rem] leading-[1.1] font-semibold">
              <SplitText key={lang} text={t("La traçabilité du cacao, de la parcelle jusqu'à l'exportation.", 'Cocoa traceability, from plot to export.')} delay={900} step={75} variant="rise" highlight={[t('cacao', 'Cocoa')]} />
            </h1>
            <ul className="mt-6 flex flex-wrap gap-2 text-[13px] text-white/85">
              {[
                [MapPinned, t('Parcelles relevées au GPS', 'GPS-surveyed plots')],
                [ShieldCheck, t('Règlement (UE) 2023/1115', 'Regulation (EU) 2023/1115')],
                [Lock, t('Données cloisonnées par coopérative', 'Data isolated per cooperative')],
              ].map(([Icon, t], i) => {
                const I = Icon as typeof Lock
                return <li key={t as string} className="mo-soft flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-sm" style={{ animationDelay: `${1800 + i * 160}ms` }}><I className="h-3.5 w-3.5 text-[#e9c98b]" />{t as string}</li>
              })}
            </ul>
          </>
        }
        footer={
          <span className="flex gap-4">
            <span>© {new Date().getFullYear()} GeoLab Service · Abidjan</span>
            <Link to="/cgu" className="hover:text-white">{t('CGU', 'Terms')}</Link>
            <Link to="/confidentialite" className="hover:text-white">{t('Confidentialité', 'Privacy')}</Link>
          </span>
        }>
        <div className="flex items-start justify-between gap-4">
          <AnimatedLogo />
          <div className="flex items-center gap-2">
          <LangSwitch dark />
          <Link to="/" className="mo-soft hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm text-white backdrop-blur-sm transition hover:bg-white/20" style={{ animationDelay: '700ms' }}>
            {t("Découvrir l'offre", 'Discover the offer')} <ArrowRight className="h-4 w-4" />
          </Link>
          </div>
        </div>
      </HeroSlideshow>

      {/* Connexion : petite carte vitrée en bas à droite (feuille en bas sur mobile), réductible */}
      {collapsed ? (
        <button onClick={() => setCollapsed(false)}
          className="login-card-in login-glow absolute bottom-24 right-4 z-20 flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-primary-800 shadow-2xl transition hover:scale-[1.03] sm:bottom-28 sm:right-8 lg:bottom-12 lg:right-14">
          <LogIn className="h-4 w-4" /> {t('Se connecter', 'Sign in')}
        </button>
      ) : (
        <section aria-label="Connexion"
          className="login-card-in absolute inset-x-3 bottom-3 z-20 max-h-[calc(100svh-1.5rem)] overflow-y-auto rounded-2xl border border-white/40 bg-white/85 p-5 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl
            sm:inset-x-auto sm:right-8 sm:bottom-8 sm:w-[370px] lg:right-10 lg:bottom-10 lg:p-6"
          style={{ animationDelay: '250ms' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-gray-900"><SplitText key={lang} text={t('Connexion', 'Sign in')} by="char" delay={600} step={40} variant="rise" /></h2>
              <p className="mt-1 text-xs text-gray-500">{t('Espace coopérative, administrateur ou agent de terrain.', 'Cooperative, administrator or field agent workspace.')}</p>
            </div>
            <button type="button" onClick={() => setCollapsed(true)} title={t('Réduire pour voir les photos', 'Minimise to see the photos')}
              className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-900/5 hover:text-gray-700"><Minimize2 className="h-4 w-4" /></button>
          </div>

          {mfa ? (
            <form onSubmit={submitCode} className="mt-4 space-y-3">
              <p className="flex items-start gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {useRecovery ? t('Saisissez un de vos codes de secours (format ABCD-1234).', 'Enter one of your recovery codes (ABCD-1234).') : t('Saisissez le code à 6 chiffres affiché par votre application d’authentification.', 'Enter the 6-digit code from your authenticator app.')}
              </p>
              <input autoFocus inputMode={useRecovery ? 'text' : 'numeric'} autoComplete="one-time-code" value={code}
                onChange={(e) => setCode(useRecovery ? e.target.value.toUpperCase() : e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                placeholder={useRecovery ? 'ABCD-1234' : '123456'} aria-label="Code de vérification"
                className={`${input} text-center font-mono text-xl tracking-[0.5em]`} />
              {error && <div role="alert" className="flex items-start gap-2 rounded-md border-l-4 border-red-500 bg-red-50 px-3 py-2 text-xs text-red-800"><Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{error}</div>}
              <button type="submit" disabled={loading || (useRecovery ? code.length < 9 : code.length !== 6)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-700 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-primary-800 disabled:opacity-60">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('Vérification…', 'Checking…')}</> : t('Valider', 'Verify')}
              </button>
              <div className="flex justify-between text-[11px]">
                <button type="button" onClick={() => { setUseRecovery(!useRecovery); setCode(''); setError('') }} className="text-primary-700 hover:underline">
                  {useRecovery ? t('Utiliser le code de l’application', 'Use the app code') : t('Téléphone perdu ? Code de secours', 'Lost phone? Recovery code')}
                </button>
                <button type="button" onClick={() => { setMfa(null); setCode(''); setError('') }} className="text-gray-500 hover:underline">{t('Retour', 'Back')}</button>
              </div>
            </form>
          ) : <>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 mo-stagger">
            <div>
              <label htmlFor="login-user" className="mb-1 block text-xs font-medium text-gray-700">{t('Identifiant', 'Username')}</label>
              <input id="login-user" type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder={t('Votre identifiant', 'Your username')} required className={input} />
            </div>
            <div>
              <label htmlFor="login-pass" className="mb-1 block text-xs font-medium text-gray-700">{t('Mot de passe', 'Password')}</label>
              <div className="relative">
                <input id="login-pass" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required className={`${input} pr-10`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" style={{ animationDelay: '0s' }} className="flex items-start gap-2 rounded-md border-l-4 border-red-500 bg-red-50 px-3 py-2 text-xs text-red-800">
                <Shield className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />{error}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 text-primary-700" />
              {t('Rester connecté', 'Stay signed in')} <span className="text-gray-400">— {t('décochez sur un ordinateur partagé', 'untick on a shared computer')}</span>
            </label>

            <button type="submit" disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary-700 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-900/20 transition hover:bg-primary-800 hover:shadow-lg active:scale-[.98] disabled:opacity-60">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t('Connexion…', 'Signing in…')}</> : <>{t('Se connecter', 'Sign in')} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></>}
            </button>
          </form>
          <GoogleSignInButton onCredential={handleGoogle} disabled={loading} />
          </>}

          <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
            {t('Mot de passe oublié ? Votre coopérative ou votre administrateur peut vous en attribuer un nouveau.', 'Forgot your password? Your cooperative or administrator can issue a new one.')}
          </p>

          {/* Comptes de démonstration : développement local uniquement (jamais affichés en ligne) */}
          {import.meta.env.DEV && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200/70 pt-3">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Démo</span>
            {[['admin', 'admin123'], ['coop', 'coop123'], ['agent', 'agent123']].map(([u, pw]) => (
              <button key={u} type="button" onClick={() => { setUsername(u); setPassword(pw) }}
                className="rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50">{u}</button>
            ))}
          </div>}
        </section>
      )}
    </div>
  )
}
