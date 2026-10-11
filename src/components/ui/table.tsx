import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

/** État mémorisé pour l'utilisateur (filtres, tri, vue) : retrouvé au prochain passage sur la page. */
export function useStickyState<T>(key: string, initial: T, override?: T | null): [T, (v: T) => void] {
  const uid = useAuthStore((s) => s.user?.id ?? 'anon')
  const storageKey = `geocollect:${uid}:${key}`
  const [value, setValue] = useState<T>(() => {
    if (override !== undefined && override !== null) return override
    try { const raw = localStorage.getItem(storageKey); return raw === null ? initial : (JSON.parse(raw) as T) } catch { return initial }
  })
  const set = (v: T) => { setValue(v); try { localStorage.setItem(storageKey, JSON.stringify(v)) } catch { /* indisponible */ } }
  return [value, set]
}

type Getter<T> = (row: T) => string | number | null | undefined
export interface SortState { key: string; dir: 'asc' | 'desc' }

/** Tri par colonne (clic sur l'en-tête : croissant → décroissant → sans tri), mémorisé par page. */
export function useSort<T>(rows: T[], getters: Record<string, Getter<T>>, storeKey: string) {
  const [sort, setSort] = useStickyState<SortState | null>(`sort:${storeKey}`, null)
  const sorted = useMemo(() => {
    if (!sort || !getters[sort.key]) return rows
    const g = getters[sort.key]
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = g(a), y = g(b)
      if (x === y) return 0
      if (x === null || x === undefined || x === '') return 1
      if (y === null || y === undefined || y === '') return -1
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true, sensitivity: 'base' })) * factor
    })
  }, [rows, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key: string) => setSort(!sort || sort.key !== key ? { key, dir: 'asc' } : sort.dir === 'asc' ? { key, dir: 'desc' } : null)
  return { sorted, sort, toggle }
}

/** En-tête de colonne triable. */
export function SortTh({ label, k, sort, onSort, className = '' }: { label: string; k: string; sort: SortState | null; onSort: (k: string) => void; className?: string }) {
  const on = sort?.key === k
  return (
    <th className={`text-left px-5 py-3 font-medium ${className}`} aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => onSort(k)} className={`group inline-flex items-center gap-1 uppercase hover:text-gray-800 ${on ? 'text-gray-900' : ''}`}>
        {label}
        {on ? (sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-60" />}
      </button>
    </th>
  )
}

/** Barre d'actions fixe, visible tant que des lignes sont sélectionnées. */
export function SelectionBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  if (!count) return null
  return (
    <div className="fixed bottom-5 left-1/2 z-[1400] flex w-[min(94vw,640px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-2xl animate-[login-card-in_.3s_cubic-bezier(.2,.8,.2,1)_both]">
      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary-700 px-2 text-xs font-semibold text-white">{count.toLocaleString('fr-FR')}</span>
      <span className="text-sm text-gray-700">sélectionné{count > 1 ? 's' : ''}</span>
      <div className="ml-auto flex items-center gap-2">{children}</div>
      <button onClick={onClear} aria-label="Désélectionner" title="Désélectionner" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
    </div>
  )
}
