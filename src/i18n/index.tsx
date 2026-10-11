import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Langue de l'interface (français par défaut, anglais pour les acheteurs et exportateurs européens).
 * Le texte français reste la source : t('Se connecter', 'Sign in').
 */
export type Lang = 'fr' | 'en'

export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>()(persist(
  (set) => ({
    lang: 'fr',
    setLang: (lang) => { set({ lang }); try { document.documentElement.lang = lang } catch { /* SSR */ } },
  }),
  { name: 'geocollect-lang' },
))

export function useT() {
  const lang = useLang((s) => s.lang)
  return (fr: string, en?: string) => (lang === 'en' && en ? en : fr)
}

export const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'fr-FR')

/** Sélecteur FR | EN. */
export function LangSwitch({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div role="group" aria-label="Langue / Language"
      className={`inline-flex overflow-hidden rounded-full border text-[11px] font-semibold ${dark ? 'border-white/25 bg-white/10 text-white' : 'border-gray-200 bg-white text-gray-600'} ${className}`}>
      {(['fr', 'en'] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`px-2.5 py-1 uppercase transition ${lang === l ? (dark ? 'bg-white text-gray-900' : 'bg-primary-700 text-white') : (dark ? 'hover:bg-white/15' : 'hover:bg-gray-50')}`}>{l}</button>
      ))}
    </div>
  )
}
