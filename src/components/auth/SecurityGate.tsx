import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck, Smartphone, Copy, Download, Eye, EyeOff, LogOut } from 'lucide-react'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { apiErrorMessage } from '../../utils/retry'
import Button from '../ui/Button'

/**
 * Étapes de sécurité à franchir avant d'utiliser GeoCollect :
 *   1. mot de passe provisoire (créé par un administrateur) → choisir le sien ;
 *   2. propriétaire / super admin → activer la double authentification.
 */
export default function SecurityGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user?.mustChangePassword) return <Shell><ForcePasswordChange /></Shell>
  if (user?.mfaRequired && !user.mfaEnabled) return <Shell><MfaSetup forced /></Shell>
  return <>{children}</>
}

function Shell({ children }: { children: React.ReactNode }) {
  const logout = async () => {
    useAppStore.getState().clearData()
    await useAuthStore.getState().logout()
    window.location.replace('/login')
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-[#2b2118] p-4">
      <div className="w-full max-w-md">
        {children}
        <button onClick={logout} className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-white/70 hover:text-white">
          <LogOut className="h-3.5 w-3.5" /> Se déconnecter
        </button>
      </div>
    </div>
  )
}

const input = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30'

/** Règles simples, vérifiées aussi par le serveur (validateurs Django). */
function strength(p: string) {
  const rules = [
    [p.length >= 10, '10 caractères au moins'],
    [/[A-Z]/.test(p) && /[a-z]/.test(p), 'majuscules et minuscules'],
    [/\d/.test(p), 'un chiffre'],
    [/[^A-Za-z0-9]/.test(p), 'un caractère spécial'],
  ] as const
  return { ok: rules.filter((r) => r[0]).length, rules }
}

function ForcePasswordChange() {
  const user = useAuthStore((s) => s.user)
  const [oldPw, setOldPw] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const s = strength(pw)
  const reason = !oldPw ? 'Saisissez le mot de passe provisoire' : s.ok < 3 ? 'Mot de passe trop faible' : pw !== pw2 ? 'Les deux mots de passe diffèrent' : pw === oldPw ? 'Choisissez un mot de passe différent' : undefined

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reason) return
    setBusy(true); setError('')
    try {
      await authApi.changePassword(oldPw, pw)
      await useAuthStore.getState().refreshMe()
      useAuthStore.getState().updateUser({ mustChangePassword: false })
    } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="login-card-in rounded-2xl bg-white p-6 shadow-2xl space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50"><KeyRound className="h-5 w-5 text-amber-700" /></span>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Choisissez votre mot de passe</h1>
          <p className="text-sm text-gray-500">Bonjour {user?.fullName}, votre compte a été créé avec un mot de passe provisoire. Remplacez-le pour continuer.</p>
        </div>
      </div>
      <label className="block text-xs font-medium text-gray-700">Mot de passe provisoire
        <input type="password" autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} className={`mt-1 ${input}`} autoFocus />
      </label>
      <label className="block text-xs font-medium text-gray-700">Nouveau mot de passe
        <span className="relative mt-1 block">
          <input type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={`${input} pr-10`} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Masquer' : 'Afficher'} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
      </label>
      <div>
        <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s.ok ? (s.ok >= 4 ? 'bg-green-500' : s.ok === 3 ? 'bg-amber-400' : 'bg-red-400') : 'bg-gray-200'}`} />)}</div>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
          {s.rules.map(([ok, label]) => <li key={label} className={ok ? 'text-green-700' : 'text-gray-400'}>{ok ? '✓' : '○'} {label}</li>)}
        </ul>
      </div>
      <label className="block text-xs font-medium text-gray-700">Confirmez le nouveau mot de passe
        <input type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={`mt-1 ${input}`} />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <Button type="submit" fullWidth size="lg" loading={busy} disabledReason={reason}>Enregistrer et continuer</Button>
    </form>
  )
}

/** Activation de la double authentification (aussi utilisée depuis « Mon compte »). */
export function MfaSetup({ forced = false, onDone }: { forced?: boolean; onDone?: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null)
  const [qr, setQr] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)

  useEffect(() => {
    authApi.mfaSetup().then(async ({ data }) => {
      if (data.enabled) { onDone?.(); return }
      setSetup({ secret: data.secret!, uri: data.uri! })
      const QR = await import('qrcode')
      setQr(await QR.toDataURL(data.uri!, { margin: 1, width: 220, errorCorrectionLevel: 'M' }))
    }).catch((err) => setError(apiErrorMessage(err)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const enable = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { setCodes((await authApi.mfaEnable(code)).data.recovery_codes) } catch (err) { setError(apiErrorMessage(err)) } finally { setBusy(false) }
  }
  const finish = async () => {
    useAuthStore.getState().updateUser({ mfaEnabled: true })
    await useAuthStore.getState().refreshMe()
    onDone?.()
  }
  const download = () => {
    const blob = new Blob([`GeoCollect EUDR — codes de secours (double authentification)\nCompte : ${useAuthStore.getState().user?.username}\n\n${codes!.join('\n')}\n\nChaque code ne sert qu'une fois.\n`], { type: 'text/plain' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'geocollect-codes-de-secours.txt'; a.click()
  }

  if (codes) {
    return (
      <div className="login-card-in rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50"><ShieldCheck className="h-5 w-5 text-green-600" /></span>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Double authentification activée</h1>
            <p className="text-sm text-gray-500">Gardez ces codes de secours en lieu sûr : ils remplacent le téléphone s'il est perdu. Chacun ne sert qu'une fois et ils ne seront plus affichés.</p>
          </div>
        </div>
        <ol className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-4 font-mono text-sm text-gray-800">{codes.map((c) => <li key={c}>{c}</li>)}</ol>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => navigator.clipboard?.writeText(codes.join('\n'))}>Copier</Button>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={download}>Télécharger</Button>
          <Button className="ml-auto" onClick={finish}>{forced ? 'Continuer' : 'Terminé'}</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={enable} className={`${forced ? 'login-card-in rounded-2xl bg-white p-6 shadow-2xl' : ''} space-y-4`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50"><Smartphone className="h-5 w-5 text-primary-700" /></span>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Activez la double authentification</h1>
          <p className="text-sm text-gray-500">{forced ? 'Obligatoire pour votre rôle : votre compte peut gérer et supprimer des données sensibles. ' : ''}À chaque connexion, un code à 6 chiffres de votre téléphone vous sera demandé.</p>
        </div>
      </div>
      <ol className="space-y-2 text-sm text-gray-700">
        <li>1. Installez <b>Google Authenticator</b>, <b>Microsoft Authenticator</b> ou <b>Authy</b> sur votre téléphone.</li>
        <li>2. Scannez ce QR code dans l'application :</li>
      </ol>
      <div className="flex flex-col items-center gap-2">
        {qr ? <img src={qr} alt="QR code de la double authentification" className="h-[200px] w-[200px] rounded-lg border border-gray-200" /> : <div className="h-[200px] w-[200px] animate-pulse rounded-lg bg-gray-100" />}
        {setup && <p className="text-center text-[11px] text-gray-500">Ou saisissez la clé : <span className="select-all font-mono text-gray-800">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</span></p>}
      </div>
      <label className="block text-sm text-gray-700">3. Saisissez le code à 6 chiffres affiché :
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
          placeholder="123 456" className={`mt-1 text-center font-mono text-lg tracking-[0.4em] ${input}`} />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <Button type="submit" fullWidth size="lg" loading={busy} disabledReason={code.replace(/\D/g, '').length !== 6 ? 'Saisissez les 6 chiffres' : undefined}>Activer</Button>
    </form>
  )
}
