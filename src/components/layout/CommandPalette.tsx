import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, MapPin, Package, UserCircle, CornerDownLeft, Keyboard, Building2, ArrowRight } from 'lucide-react'
import { NAV_ITEMS } from './Sidebar'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import { lotsApi } from '../../api/lots'
import { usersApi, type ApiUser } from '../../api/users'

interface Hit { key: string; group: string; label: string; sub?: string; icon: React.ReactNode; to: string }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const MAX_PER_GROUP = 6


/**
 * Recherche globale (Ctrl+K / ⌘K) : pages du menu, producteurs (nom, code du registre, village), parcelles, lots,
 * coopératives et comptes. ↑ ↓ pour choisir, Entrée pour ouvrir, Échap pour fermer. « ? » affiche les raccourcis.
 */
export default function CommandPalette() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { producers, parcels, cooperatives } = useAppStore()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [lots, setLots] = useState<{ id: string; code: string; status: string }[]>([])
  const [accounts, setAccounts] = useState<ApiUser[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const role = user?.role ?? 'agent'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); setHelp(false) }
      else if (e.key === '?' && !typing) { e.preventDefault(); setHelp((h) => !h); setOpen(false) }
      else if (e.key === 'Escape') { setOpen(false); setHelp(false) }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('geocollect:search', onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('geocollect:search', onOpen) }
  }, [])

  useEffect(() => {
    if (!open) return
    setQ(''); setActive(0)
    setTimeout(() => inputRef.current?.focus(), 20)
    // lots et comptes : chargés à l'ouverture seulement
    if (role === 'cooperative' && (user?.modules == null || user.modules.includes('lots'))) {
      lotsApi.list().then(({ data }) => setLots(data.map((l) => ({ id: l.id, code: l.code, status: l.status })))).catch(() => {})
    }
    if (role === 'owner' || role === 'super_admin') {
      usersApi.list().then(({ data }) => setAccounts(Array.isArray(data) ? data : data.results)).catch(() => {})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const hits = useMemo<Hit[]>(() => {
    const t = norm(q.trim())
    const match = (...xs: (string | undefined)[]) => !t || xs.some((x) => x && norm(x).includes(t))
    const out: Hit[] = []
    const modules = user?.modules ?? null
    NAV_ITEMS.filter((n) => n.roles.includes(role) && (!n.module || modules === null || modules.includes(n.module)) && match(n.label, n.group))
      .slice(0, t ? 8 : 12)
      .forEach((n) => out.push({ key: `p${n.to}${n.label}`, group: 'Pages', label: n.label, sub: n.group, icon: n.icon, to: n.to }))
    if (t.length >= 2) {
      const prodPage = role === 'agent' ? '/agent/producers' : '/coop/producers'
      if (role === 'cooperative' || role === 'agent') {
        producers.filter((p) => match(p.fullName, p.fieldIdBase, p.village, p.phone)).slice(0, MAX_PER_GROUP).forEach((p) =>
          out.push({ key: `pr${p.id}`, group: 'Producteurs', label: p.fullName || p.fieldIdBase, sub: `${p.fieldIdBase} · ${p.village}`, icon: <Users className="h-4 w-4" />, to: `${prodPage}?q=${encodeURIComponent(p.fieldIdBase)}` }))
        const parcPage = role === 'agent' ? '/agent/parcels' : '/coop/parcels'
        parcels.filter((p) => match(p.fieldId, p.village, p.name)).slice(0, MAX_PER_GROUP).forEach((p) =>
          out.push({ key: `pa${p.id}`, group: 'Parcelles', label: p.fieldId, sub: `${p.village} · ${p.areaHectares?.toFixed?.(2) ?? p.areaHectares} ha`, icon: <MapPin className="h-4 w-4" />, to: `${parcPage}?q=${encodeURIComponent(p.fieldId)}` }))
        lots.filter((l) => match(l.code)).slice(0, MAX_PER_GROUP).forEach((l) =>
          out.push({ key: `l${l.id}`, group: 'Fiches de lot', label: l.code, sub: l.status, icon: <Package className="h-4 w-4" />, to: '/coop/lots' }))
      }
      if (role === 'owner' || role === 'super_admin') {
        cooperatives.filter((c) => match(c.name)).slice(0, MAX_PER_GROUP).forEach((c) =>
          out.push({ key: `c${c.id}`, group: 'Coopératives', label: c.name, icon: <Building2 className="h-4 w-4" />, to: `/admin/cooperatives?q=${encodeURIComponent(c.name)}` }))
        accounts.filter((a) => match(a.full_name, a.username, a.email ?? '', a.cooperative_name ?? '')).slice(0, MAX_PER_GROUP).forEach((a) =>
          out.push({ key: `u${a.id}`, group: 'Comptes', label: a.full_name || a.username, sub: `${a.username}${a.cooperative_name ? ` · ${a.cooperative_name}` : ''}`, icon: <UserCircle className="h-4 w-4" />, to: `/admin/accounts?q=${encodeURIComponent(a.username)}` }))
      }
    }
    return out
  }, [q, role, producers, parcels, lots, cooperatives, accounts, user?.modules])

  useEffect(() => { setActive(0) }, [q])

  const go = (h: Hit) => { setOpen(false); navigate(h.to) }

  if (help) return <ShortcutsHelp onClose={() => setHelp(false)} />
  if (!open) return null
  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[900] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div role="dialog" aria-label="Recherche globale" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-100 px-4">
          <Search className="h-5 w-5 text-gray-400" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code producteur, parcelle, lot, page…"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter' && hits[active]) { e.preventDefault(); go(hits[active]) }
            }}
            className="h-14 flex-1 bg-transparent text-base text-gray-900 placeholder-gray-400 focus:outline-none" />
          <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">Échap</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto py-2">
          {hits.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-500">{q.trim().length < 2 ? 'Tapez au moins 2 caractères.' : 'Aucun résultat.'}</li>}
          {hits.map((h, i) => {
            const header = h.group !== lastGroup ? (lastGroup = h.group) : null
            return (
              <li key={h.key}>
                {header && <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{header}</p>}
                <button onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === active ? 'bg-primary-50' : ''}`}>
                  <span className="text-gray-500 [&>svg]:h-4 [&>svg]:w-4">{h.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-900">{h.label}</span>
                    {h.sub && <span className="block truncate text-xs text-gray-500">{h.sub}</span>}
                  </span>
                  {i === active ? <CornerDownLeft className="h-4 w-4 text-primary-700" /> : <ArrowRight className="h-3.5 w-3.5 text-gray-300" />}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2 text-[11px] text-gray-500">
          <span><kbd className="font-mono">↑ ↓</kbd> choisir</span><span><kbd className="font-mono">Entrée</kbd> ouvrir</span>
          <button onClick={() => { setOpen(false); setHelp(true) }} className="ml-auto flex items-center gap-1 hover:text-gray-800"><Keyboard className="h-3.5 w-3.5" /> Raccourcis</button>
        </div>
      </div>
    </div>
  )
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl + K', 'Recherche globale (producteur, parcelle, lot, page)'],
  ['?', 'Afficher ces raccourcis'],
  ['Échap', 'Fermer une fenêtre, un panneau ou la recherche'],
  ['Entrée', 'Valider une fenêtre de confirmation'],
  ['Ctrl + S', 'Enregistrer (registre, fiche producteur)'],
  ['Ctrl + Z / Ctrl + Y', 'Annuler / rétablir (registre)'],
  ['↑ ↓', 'Se déplacer dans la recherche'],
  ['← →', 'Photos de la page de connexion'],
]

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="Raccourcis clavier" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <p className="flex items-center gap-2 font-semibold text-gray-900"><Keyboard className="h-5 w-5 text-primary-700" /> Raccourcis clavier</p>
        <dl className="mt-4 divide-y divide-gray-100 text-sm">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-gray-600">{d}</dt>
              <dd><kbd className="whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-800">{k}</kbd></dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-gray-400">Sur Mac, Ctrl = ⌘.</p>
      </div>
    </div>
  )
}
