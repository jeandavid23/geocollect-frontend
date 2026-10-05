import { useEffect, useRef, useState } from 'react'
import { authApi } from '../../api/auth'

interface GoogleId {
  accounts: { id: {
    initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string; use_fedcm_for_prompt?: boolean }) => void
    renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
  } }
}
declare global { interface Window { google?: GoogleId } }

let scriptPromise: Promise<void> | null = null
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('Google injoignable')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/** Bouton « Se connecter avec Google » (Google Identity Services). Invisible tant que le serveur n'a pas d'identifiant Google. */
export default function GoogleSignInButton({ onCredential, disabled }: { onCredential: (credential: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onCredential); cb.current = onCredential
  const [clientId, setClientId] = useState('')

  useEffect(() => {
    authApi.googleConfig().then(({ data }) => { if (data.enabled) setClientId(data.client_id) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    loadScript().then(() => {
      if (cancelled || !ref.current || !window.google) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential), use_fedcm_for_prompt: true })
      window.google.accounts.id.renderButton(ref.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'fr',
        width: Math.min(360, ref.current.offsetWidth || 360),
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [clientId])

  if (!clientId) return null
  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      <div className="flex items-center gap-3 my-4 text-xs text-gray-400"><span className="flex-1 h-px bg-gray-200" />ou<span className="flex-1 h-px bg-gray-200" /></div>
      <div ref={ref} className="flex justify-center min-h-[44px]" />
    </div>
  )
}
