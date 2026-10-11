import { useMemo, useState } from 'react'
import { queryParam } from '../../utils/query'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, Satellite, CheckCircle2, Phone, ChevronDown, Navigation, Wifi, WifiOff, Route, Loader2 } from 'lucide-react'
import Header from '../../components/layout/Header'
import { useAuthStore } from '../../store/authStore'
import { useAppStore } from '../../store/appStore'
import type { Producer } from '../../types'

type Sort = 'count' | 'near' | 'name'
const LIMIT_PER_VILLAGE = 60

/** Distance (km) entre deux points WGS84. */
function km(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/**
 * « Ma tournée » : les producteurs du registre qui n'ont encore aucun polygone, regroupés par village.
 * Tri par nombre de producteurs ou par proximité (position du téléphone ↔ parcelles déjà relevées du village).
 */
export default function AgentProducersPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { producers, parcels, currentAgentId, isOnline, isLoading } = useAppStore()
  const coopId = user?.cooperativeId ?? 'coop-001'

  const [search, setSearch] = useState(() => queryParam('q'))   // ?q= : recherche globale (Ctrl+K)
  const [showDone, setShowDone] = useState(false)
  const [sort, setSort] = useState<Sort>('count')
  const [here, setHere] = useState<[number, number] | null>(null)
  const [locating, setLocating] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const coopProducers = useMemo(() => producers.filter((p) => p.cooperativeId === coopId), [producers, coopId])
  const coopParcels = useMemo(() => parcels.filter((p) => p.cooperativeId === coopId), [parcels, coopId])
  // polygones = parcelles mappées (à jour en direct) + anciens polygones rattachés par le code du registre
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const pc of coopParcels) m.set(pc.producerId, (m.get(pc.producerId) ?? 0) + 1)
    return m
  }, [coopParcels])
  const polys = (p: Producer) => (counts.get(p.id) ?? 0) + (p.legacyPolygonCount ?? 0)

  // position approximative de chaque village : moyenne des parcelles déjà relevées
  const villagePos = useMemo(() => {
    const acc = new Map<string, [number, number, number]>()
    for (const pc of coopParcels) {
      const ring = pc.geometry?.coordinates?.[0]
      if (!ring?.length || !pc.village) continue
      const [x, y] = ring[0]
      const a = acc.get(pc.village) ?? [0, 0, 0]
      acc.set(pc.village, [a[0] + x, a[1] + y, a[2] + 1])
    }
    return new Map([...acc].map(([v, [x, y, n]]) => [v, [x / n, y / n] as [number, number]]))
  }, [coopParcels])

  const today = new Date().toDateString()
  const mine = coopParcels.filter((p) => !currentAgentId || p.agentId === currentAgentId)
  const mappedToday = mine.filter((p) => new Date(p.createdAt).toDateString() === today).length
  const haToday = mine.filter((p) => new Date(p.createdAt).toDateString() === today).reduce((s, p) => s + (p.areaHectares || 0), 0)
  const todo = coopProducers.filter((p) => polys(p) === 0).length

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const by = new Map<string, Producer[]>()
    for (const p of coopProducers) {
      if (!showDone && polys(p) > 0) continue
      if (q && !`${p.fullName} ${p.village} ${p.fieldIdBase} ${p.phone ?? ''}`.toLowerCase().includes(q)) continue
      const v = p.village?.trim() || 'Village non renseigné'
      by.set(v, [...(by.get(v) ?? []), p])
    }
    const list = [...by].map(([village, ps]) => ({
      village, producers: ps.sort((a, b) => polys(a) - polys(b) || a.fullName.localeCompare(b.fullName)),
      distance: here && villagePos.has(village) ? km(here, villagePos.get(village)!) : null,
    }))
    if (sort === 'name') list.sort((a, b) => a.village.localeCompare(b.village))
    else if (sort === 'near') list.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9) || b.producers.length - a.producers.length)
    else list.sort((a, b) => b.producers.length - a.producers.length)
    return list
  }, [coopProducers, search, showDone, sort, here, villagePos, counts]) // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setHere([pos.coords.longitude, pos.coords.latitude]); setSort('near'); setLocating(false) },
      () => setLocating(false), { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 })
  }
  const toggle = (v: string) => setOpen((o) => { const n = new Set(o); if (n.has(v)) n.delete(v); else n.add(v); return n })
  const isOpen = (v: string, i: number) => open.has(v) !== (i === 0 || !!search)   // le premier village (et toute recherche) ouvert par défaut

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Header title="Ma tournée" subtitle="Producteurs du registre sans polygone, regroupés par village" />

      {/* Statut de la journée */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4"><p className="text-2xl font-bold text-orange-700 tabular-nums">{todo.toLocaleString('fr-FR')}</p><p className="text-xs text-orange-800/80">à mapper</p></div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4"><p className="text-2xl font-bold text-green-700 tabular-nums">{mappedToday}</p><p className="text-xs text-green-800/80">relevé(s) aujourd'hui</p></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4"><p className="text-2xl font-bold text-gray-900 tabular-nums">{haToday.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</p><p className="text-xs text-gray-500">ha aujourd'hui</p></div>
        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${isOnline ? 'border-gray-100 bg-white' : 'border-red-100 bg-red-50'}`}>
          {isOnline ? <Wifi className="h-6 w-6 text-green-600" /> : <WifiOff className="h-6 w-6 text-red-600" />}
          <div><p className="text-sm font-semibold text-gray-900">{isOnline ? 'En ligne' : 'Hors ligne'}</p>
            <p className="text-xs text-gray-500">{isOnline ? 'Relevés envoyés directement' : 'Utilisez l’application mobile'}</p></div>
        </div>
      </div>

      <button onClick={() => navigate('/agent/mapping')}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-700 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-primary-800 active:scale-[.99] sm:hidden">
        <Satellite className="h-5 w-5" /> Nouveau mapping
      </button>

      {/* Recherche et tri */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, village, code, téléphone…"
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
          <option value="count">Villages : plus de producteurs d'abord</option>
          <option value="near" disabled={!here}>Villages : les plus proches</option>
          <option value="name">Villages : ordre alphabétique</option>
        </select>
        <button onClick={locate} disabled={locating} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} Près de moi
        </button>
        <label className="flex items-center gap-2 px-1 text-sm text-gray-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Afficher aussi les producteurs déjà mappés
        </label>
      </div>

      {/* Villages */}
      <div className="space-y-3">
        {groups.map((g, i) => {
          const opened = isOpen(g.village, i)
          return (
            <section key={g.village} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <button onClick={() => toggle(g.village)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-gray-50">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary-600" />
                  <span className="font-semibold text-gray-900">{g.village}</span>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">{g.producers.length}</span>
                  {g.distance != null && <span className="text-xs text-gray-500">≈ {g.distance < 10 ? g.distance.toFixed(1) : Math.round(g.distance)} km</span>}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition ${opened ? 'rotate-180' : ''}`} />
              </button>
              {opened && (
                <ul className="divide-y divide-gray-50 border-t border-gray-100">
                  {g.producers.slice(0, LIMIT_PER_VILLAGE).map((p) => {
                    const n = polys(p)
                    return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800">{p.fullName || '—'}</p>
                          <p className="font-mono text-xs text-gray-500">{p.fieldIdBase}{p.section ? ` · ${p.section}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {n > 0 && <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> {n} polygone{n > 1 ? 's' : ''}</span>}
                          {p.phone && (
                            <a href={`tel:${p.phone.replace(/\s+/g, '')}`} title={`Appeler ${p.phone}`}
                              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                              <Phone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{p.phone}</span>
                            </a>
                          )}
                          <button onClick={() => navigate(`/agent/mapping?producer=${p.id}`)}
                            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700">
                            <Satellite className="h-3.5 w-3.5" /> Mapper
                          </button>
                        </div>
                      </li>
                    )
                  })}
                  {g.producers.length > LIMIT_PER_VILLAGE && (
                    <li className="px-5 py-2 text-center text-xs text-gray-500">{LIMIT_PER_VILLAGE} premiers sur {g.producers.length} — précisez la recherche.</li>
                  )}
                </ul>
              )}
            </section>
          )
        })}
        {groups.length === 0 && isLoading && coopProducers.length === 0 && (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-5 py-10 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de vos producteurs…</p>
        )}
        {groups.length === 0 && !(isLoading && coopProducers.length === 0) && (
          <p className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white px-5 py-10 text-center text-sm text-gray-500">
            <Route className="h-8 w-8 text-gray-300" />
            {coopProducers.length === 0 ? 'Aucun producteur : la coopérative doit importer son registre.'
              : search ? 'Aucun producteur ne correspond à la recherche.' : 'Tous les producteurs ont un polygone. Bravo !'}
          </p>
        )}
      </div>
    </div>
  )
}
