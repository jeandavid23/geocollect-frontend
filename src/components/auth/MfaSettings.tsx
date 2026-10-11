import { useState } from 'react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { apiErrorMessage } from '../../utils/retry'
import Button from '../ui/Button'
import { alertDialog, promptDialog } from '../ui/dialog'
import { MfaSetup } from './SecurityGate'

/** « Mon compte » : état de la double authentification, activation / désactivation (si non obligatoire). */
export default function MfaSettings() {
  const user = useAuthStore((s) => s.user)
  const [setup, setSetup] = useState(false)

  const disable = async () => {
    const password = await promptDialog({ title: 'Désactiver la double authentification', label: 'Votre mot de passe', validate: (v) => (v ? null : 'Obligatoire') })
    if (!password) return
    const code = await promptDialog({ title: 'Désactiver la double authentification', label: 'Code à 6 chiffres (ou code de secours)', validate: (v) => (v ? null : 'Obligatoire') })
    if (!code) return
    try {
      await authApi.mfaDisable(password, code)
      useAuthStore.getState().updateUser({ mfaEnabled: false })
      await alertDialog({ tone: 'success', title: 'Double authentification désactivée' })
    } catch (err) { await alertDialog({ tone: 'danger', title: 'Désactivation impossible', message: apiErrorMessage(err) }) }
  }

  return (
    <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {user?.mfaEnabled ? <ShieldCheck className="mt-0.5 h-5 w-5 text-green-600" /> : <ShieldOff className="mt-0.5 h-5 w-5 text-gray-400" />}
          <div>
            <h2 className="font-semibold text-gray-900">Double authentification</h2>
            <p className="text-sm text-gray-500">
              {user?.mfaEnabled ? 'Active : un code à 6 chiffres de votre téléphone est demandé à chaque connexion.'
                : 'Protégez votre compte avec un code à 6 chiffres envoyé par une application de votre téléphone.'}
              {user?.mfaRequired && ' Obligatoire pour votre rôle.'}
            </p>
          </div>
        </div>
        {!user?.mfaEnabled && !setup && <Button onClick={() => setSetup(true)}>Activer</Button>}
        {user?.mfaEnabled && !user.mfaRequired && <Button variant="secondary" onClick={disable}>Désactiver</Button>}
      </div>
      {setup && !user?.mfaEnabled && <div className="border-t border-gray-100 pt-4"><MfaSetup onDone={() => setSetup(false)} /></div>}
    </section>
  )
}
