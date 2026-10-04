import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet'
import type { Map as LMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Hand, MousePointer2, SquareDashedMousePointer, Info, ZoomIn, ZoomOut, Maximize, Focus, CheckSquare, XSquare, Repeat,
  Pencil, PenTool, Spline, Move, Trash2, Undo2, Redo2, Save, RotateCcw, Ruler, Pentagon, Table2, Download, Loader2, X, Layers, Eye, EyeOff,
} from 'lucide-react'
import GisEngine, { type GFeature, type LayerId, type Tool } from './GisEngine'
import AttributeTable, { type Column } from './AttributeTable'
import { areaHa, bbox, bboxUnion, hasSelfIntersection, intersectsBox, lineLength, toMulti, vertexCount, fmtLength, type BBox, type PolyGeom } from './gisGeom'
import { useAppStore } from '../../store/appStore'
import { useAuthStore } from '../../store/authStore'
import { useHasModule } from '../../utils/modules'
import { LEGACY_COLOR } from '../map/LegacyParcelsLayer'
import api from '../../api/client'
import { gzipJson } from '../../utils/gzip'
import { apiErrorMessage } from '../../utils/retry'
import { exportGeoJSON, exportKML, exportShapefile } from '../../utils/featureExport'
import { downloadBlob } from '../../utils/geoExport'

const { BaseLayer } = LayersControl
const EUDR = { compliant: '#16a34a', non_compliant: '#dc2626', pending: '#f59e0b' } as Record<string, string>
const EUDR_LABEL = { compliant: 'Conforme', non_compliant: 'Non conforme', pending: 'En attente' } as Record<string, string>
const PARCEL_EDITABLE = ['name', 'village', 'section', 'culture']
const LEGACY_RO = new Set(['surface_ha', 'fichier'])
const LAYER_LABEL: Record<LayerId, string> = { parcels: 'Parcelles mappées', legacy: 'Anciens polygones' }

type Change = [string, GFeature | null, GFeature | null]     // clé, avant, après
interface HistoryEntry { label: string; changes: Change[] }

function MapRef({ onMap }: { onMap: (m: LMap) => void }) {
  const map = useMap()
  useEffect(() => {
    onMap(map)
    if (import.meta.env.DEV) (window as unknown as { __gisMap?: LMap }).__gisMap = map   // tests automatisés (développement uniquement)
  }, [map, onMap])
  return null
}

/** Espace d'édition SIG de la carte interactive : outils de navigation, sélection, édition et mesure type QGIS. */
export default function GisWorkspace() {
  const { parcels, producers, legacyParcels, cooperatives, addNotification, loadLegacyParcels, refreshData } = useAppStore()
  const role = useAuthStore((s) => s.user?.role)
  const userCoop = useAuthStore((s) => s.user?.cooperativeId)
  const hasLegacy = useHasModule('legacy')
  const isAdmin = role === 'super_admin' || role === 'owner'
  const [coop, setCoop] = useState<string>(isAdmin ? (cooperatives[0]?.id ?? 'all') : (userCoop ?? 'all'))

  // ── Entités de travail (copie locale modifiable)
  const build = useCallback(() => {
    const m = new Map<string, GFeature>()
    const prod = new Map(producers.map((x) => [x.id, x.fullName]))
    for (const p of parcels) {
      if (coop !== 'all' && p.cooperativeId !== coop) continue
      const g = p.geometry as unknown as PolyGeom
      if (!g?.coordinates?.length) continue
      m.set(`parcels:${p.id}`, {
        key: `parcels:${p.id}`, layer: 'parcels', id: p.id, label: p.fieldId, geometry: g, state: 'clean',
        props: { field_id: p.fieldId, producteur: prod.get(p.producerId) ?? '', name: p.name ?? '', village: p.village, section: p.section,
          culture: p.culture, surface_ha: Math.round((p.areaHectares || 0) * 10000) / 10000, statut_eudr: EUDR_LABEL[p.eudrStatus ?? ''] ?? '', score_eudr: p.eudrScore ?? '', _eudr: p.eudrStatus ?? '' },
      })
    }
    if (hasLegacy) for (const l of legacyParcels) {
      if (coop !== 'all' && l.cooperativeId !== coop) continue
      m.set(`legacy:${l.id}`, {
        key: `legacy:${l.id}`, layer: 'legacy', id: l.id, label: l.name || l.id.slice(0, 8), geometry: l.geometry, state: 'clean',
        props: { nom: l.name, ...l.properties, surface_ha: l.areaHectares ?? areaHa(l.geometry), fichier: l.sourceFile },
      })
    }
    return m
  }, [parcels, producers, legacyParcels, coop, hasLegacy])

  const feats = useRef(new Map<string, GFeature>())
  const original = useRef(new Map<string, GFeature>())
  const [version, setVersion] = useState(0)
  const undo = useRef<HistoryEntry[]>([])
  const redo = useRef<HistoryEntry[]>([])
  const dirty = undo.current.length > 0 || [...feats.current.values()].some((f) => f.state !== 'clean') || original.current.size !== feats.current.size

  useEffect(() => {
    if (dirty) return   // modifications en cours : on ne remplace pas la copie de travail (rafraîchissement automatique)
    const m = build()
    // rafraîchissement automatique : on garde la même géométrie (même objet) si elle n'a pas changé → pas de redessin
    const sig = (g: PolyGeom) => { const r = toMulti(g); const f = r[0]?.[0]?.[0]; return `${vertexCount(g)}:${f?.[0]}:${f?.[1]}:${areaHa(g)}` }
    for (const [k, f] of m) { const old = feats.current.get(k); if (old && (old.geometry === f.geometry || sig(old.geometry) === sig(f.geometry))) f.geometry = old.geometry }
    feats.current = m; original.current = new Map(m); undo.current = []; redo.current = []
    setVersion((v) => v + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tool, setTool] = useState<Tool>('pan')
  const [editMode, setEditMode] = useState(false)
  const [visible, setVisible] = useState<Record<LayerId, boolean>>({ parcels: true, legacy: true })
  const [active, setActive] = useState<LayerId>(hasLegacy && !parcels.length ? 'legacy' : 'parcels')
  const [showTable, setShowTable] = useState(false)
  const [identified, setIdentified] = useState<string | null>(null)
  const [measure, setMeasure] = useState('')
  const [cursor, setCursor] = useState<[number, number] | null>(null)
  const [saving, setSaving] = useState(false)
  const [map, setMap] = useState<LMap | null>(null)
  const newId = useRef(0)

  const all = useMemo(() => [...feats.current.values()], [version]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => all.filter((f) => visible[f.layer]), [all, visible])
  const activeFeats = useMemo(() => all.filter((f) => f.layer === active), [all, active])
  const editableLayer = (l: LayerId) => l === 'parcels' || hasLegacy

  // ── Historique (annuler / rétablir)
  const apply = (entry: HistoryEntry, dir: 'do' | 'undo') => {
    for (const [k, before, after] of entry.changes) {
      const v = dir === 'do' ? after : before
      if (v) feats.current.set(k, v); else feats.current.delete(k)
    }
    setVersion((x) => x + 1)
  }
  const commit = (label: string, changes: Change[]) => {
    if (!changes.length) return
    const entry = { label, changes }
    apply(entry, 'do'); undo.current.push(entry); redo.current = []
  }
  const doUndo = () => { const e = undo.current.pop(); if (e) { apply(e, 'undo'); redo.current.push(e); flash(`Annulé : ${e.label}`) } }
  const doRedo = () => { const e = redo.current.pop(); if (e) { apply(e, 'do'); undo.current.push(e); flash(`Rétabli : ${e.label}`) } }
  const flash = (t: string) => setMeasure(t)

  // ── Sélection
  const select = (keys: string[], mode: 'replace' | 'add' | 'toggle') => setSelected((cur) => {
    if (mode === 'replace') return new Set(keys)
    const n = new Set(cur)
    for (const k of keys) { if (mode === 'toggle' && n.has(k)) n.delete(k); else n.add(k) }
    return n
  })
  const selectAll = () => setSelected(new Set(activeFeats.filter((f) => visible[f.layer]).map((f) => f.key)))
  const invert = () => setSelected((cur) => new Set(activeFeats.filter((f) => !cur.has(f.key)).map((f) => f.key)))
  const boxSelect = (b: BBox, additive: boolean) => {
    const hits = shown.filter((f) => intersectsBox(f.geometry, b)).map((f) => f.key)
    select(hits, additive ? 'add' : 'replace'); flash(`${hits.length} polygone(s) sélectionné(s)`)
  }

  // ── Zoom
  const fit = (list: GFeature[]) => {
    if (!map || !list.length) return
    let b: BBox | null = null
    for (const f of list) b = bboxUnion(b, bbox(f.geometry))
    if (b) map.fitBounds([[b.minY, b.minX], [b.maxY, b.maxX]], { padding: [30, 30], maxZoom: 18 })
  }
  const firstFit = useRef(false)
  useEffect(() => { if (map && !firstFit.current && all.length) { firstFit.current = true; fit(all) } }, [map, all]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Édition
  const withGeometry = (f: GFeature, g: PolyGeom): GFeature => ({ ...f, geometry: g, state: f.state === 'new' ? 'new' : 'modified', props: { ...f.props, surface_ha: areaHa(g) } })
  const onGeometries = (changes: Map<string, PolyGeom>, label: string) => {
    const list: Change[] = []
    let bad = 0
    for (const [k, g] of changes) {
      const f = feats.current.get(k)
      if (!f) continue
      if (hasSelfIntersection(g)) bad++
      list.push([k, f, withGeometry(f, g)])
    }
    commit(label, list)
    if (bad) addNotification({ type: 'warning', title: 'Auto-intersection', message: `${bad} polygone(s) se croisent eux-mêmes après la modification. Corrigez les nœuds ou passez-les au Polygon Validator.` })
  }
  const onAddPolygon = (g: PolyGeom) => {
    if (!hasLegacy) return
    if (isAdmin && coop === 'all') { addNotification({ type: 'warning', title: 'Coopérative', message: 'Choisissez d’abord la coopérative à laquelle ajouter le polygone.' }); return }
    if (hasSelfIntersection(g)) addNotification({ type: 'warning', title: 'Auto-intersection', message: 'Le polygone dessiné se croise lui-même.' })
    const n = ++newId.current
    const key = `new:${n}`
    const f: GFeature = { key, layer: 'legacy', id: key, label: `Nouveau polygone ${n}`, geometry: g, state: 'new', props: { nom: `Nouveau polygone ${n}`, surface_ha: areaHa(g), fichier: 'Édition carte' } }
    commit('Ajout d’un polygone', [[key, null, f]])
    setSelected(new Set([key])); setActive('legacy')
    flash(`Polygone ajouté : ${areaHa(g)} ha — renseignez ses attributs dans la table, puis enregistrez.`)
  }
  const deleteSelection = () => {
    const keys = [...selected].filter((k) => feats.current.has(k) && editableLayer(feats.current.get(k)!.layer))
    if (!keys.length) return
    if (!window.confirm(`Supprimer ${keys.length} polygone(s) ? (définitif après « Enregistrer »)`)) return
    commit(`Suppression de ${keys.length} polygone(s)`, keys.map((k) => [k, feats.current.get(k)!, null]))
    setSelected(new Set())
  }
  const editAttribute = (key: string, field: string, value: string) => {
    const f = feats.current.get(key)
    if (!f) return
    const v: unknown = value !== '' && !isNaN(Number(value)) && typeof f.props[field] === 'number' ? Number(value) : value
    commit(`Attribut « ${field} »`, [[key, f, { ...f, state: f.state === 'new' ? 'new' : 'modified', label: field === 'nom' || field === 'name' ? String(value) || f.label : f.label, props: { ...f.props, [field]: v } }]])
  }
  const addField = (name: string) => {
    const changes: Change[] = activeFeats.filter((f) => !(name in f.props)).map((f) => [f.key, f, { ...f, state: f.state === 'new' ? 'new' : 'modified', props: { ...f.props, [name]: '' } }])
    commit(`Nouveau champ « ${name} »`, changes)
  }

  const changesCount = useMemo(() => {
    let mod = 0, add = 0
    for (const f of all) { if (f.state === 'modified') mod++; if (f.state === 'new') add++ }
    let del = 0
    for (const k of original.current.keys()) if (!feats.current.has(k)) del++
    return { mod, add, del, total: mod + add + del }
  }, [all])

  const rollback = () => {
    if (changesCount.total && !window.confirm('Abandonner toutes les modifications non enregistrées ?')) return
    feats.current = new Map(original.current); undo.current = []; redo.current = []; setSelected(new Set()); setVersion((v) => v + 1)
    flash('Modifications abandonnées')
  }

  const save = async () => {
    if (!changesCount.total) return
    setSaving(true)
    const payload = { cooperative: isAdmin && coop !== 'all' ? coop : undefined, parcels: { updates: [] as unknown[], deletes: [] as string[] }, legacy: { updates: [] as unknown[], deletes: [] as string[], creates: [] as unknown[] } }
    for (const f of feats.current.values()) {
      if (f.state === 'clean') continue
      const o = original.current.get(f.key)
      const geomChanged = !o || o.geometry !== f.geometry
      if (f.layer === 'parcels') {
        const u: Record<string, unknown> = { id: f.id }
        if (geomChanged) u.geometry = f.geometry
        for (const k of PARCEL_EDITABLE) if (!o || o.props[k] !== f.props[k]) u[k] = f.props[k] ?? ''
        payload.parcels.updates.push(u)
      } else {
        const properties = Object.fromEntries(Object.entries(f.props).filter(([k]) => k !== 'nom' && !LEGACY_RO.has(k)))
        if (f.state === 'new') payload.legacy.creates.push({ tmp_id: f.key, name: String(f.props.nom ?? ''), geometry: f.geometry, properties })
        else payload.legacy.updates.push({ id: f.id, name: String(f.props.nom ?? ''), properties, ...(geomChanged ? { geometry: f.geometry } : {}) })
      }
    }
    for (const [k, o] of original.current) if (!feats.current.has(k)) (o.layer === 'parcels' ? payload.parcels.deletes : payload.legacy.deletes).push(o.id)
    try {
      const { body, gzip } = await gzipJson(payload)
      const { data } = await api.post<{ summary: string; warnings: string[] }>('/parcels/gis/save/', body, {
        headers: { 'Content-Type': 'application/json', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) }, timeout: 180000,
      })
      addNotification({ type: 'success', title: 'Modifications enregistrées', message: data.summary || 'Enregistré.' })
      if (data.warnings?.length) addNotification({ type: 'warning', title: `${data.warnings.length} avertissement(s)`, message: data.warnings.slice(0, 3).join(' · ') })
      // la copie de travail repart des données du serveur (surfaces et conformité EUDR recalculées)
      undo.current = []; redo.current = []
      for (const f of feats.current.values()) f.state = 'clean'
      original.current = new Map(feats.current)
      setVersion((v) => v + 1)
      await Promise.all([loadLegacyParcels(), refreshData()])
    } catch (err) {
      addNotification({ type: 'error', title: 'Enregistrement impossible', message: apiErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  // ── Raccourcis clavier (comme QGIS)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); doUndo() }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); doRedo() }
      else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll() }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (editMode) save() }
      else if ((e.key === 'Delete' || e.key === 'Del') && editMode) deleteSelection()
      else if (e.key === 'Escape' && !['add', 'measureLine', 'measureArea'].includes(tool)) setSelected(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (changesCount.total) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changesCount.total])

  const toggleEdit = () => {
    if (editMode && changesCount.total) {
      const keep = window.confirm('Enregistrer les modifications avant de quitter le mode édition ?\nOK : enregistrer · Annuler : rester en édition')
      if (keep) save().then(() => setEditMode(false))
      return
    }
    setEditMode(!editMode)
    if (editMode && ['vertex', 'move', 'add'].includes(tool)) setTool('select')
  }

  const styleOf = (f: GFeature) => (f.layer === 'legacy' ? { fill: LEGACY_COLOR, stroke: LEGACY_COLOR } : { fill: EUDR[String(f.props._eudr)] ?? '#0ea5e9', stroke: EUDR[String(f.props._eudr)] ?? '#0369a1' })

  const columns: Column[] = useMemo(() => {
    if (active === 'parcels') return [
      { key: 'field_id', label: 'Field ID', editable: false }, { key: 'producteur', label: 'Producteur', editable: false },
      { key: 'name', label: 'Nom', editable: true }, { key: 'village', label: 'Village', editable: true }, { key: 'section', label: 'Section', editable: true },
      { key: 'culture', label: 'Culture', editable: true }, { key: 'surface_ha', label: 'Surface (ha)', editable: false, numeric: true },
      { key: 'statut_eudr', label: 'Statut EUDR', editable: false }, { key: 'score_eudr', label: 'Score EUDR', editable: false, numeric: true },
    ]
    const keys = new Set<string>()
    for (const f of activeFeats.slice(0, 3000)) Object.keys(f.props).forEach((k) => keys.add(k))
    keys.delete('nom'); keys.delete('surface_ha'); keys.delete('fichier')
    return [{ key: 'nom', label: 'Nom', editable: true }, ...[...keys].map((k) => ({ key: k, label: k, editable: true })),
      { key: 'surface_ha', label: 'Surface (ha)', editable: false, numeric: true }, { key: 'fichier', label: 'Fichier', editable: false }]
  }, [active, activeFeats])

  const exportRows = (rows: GFeature[]) => {
    const cols = columns.map((c) => c.key)
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    downloadBlob(new Blob(['﻿' + [columns.map((c) => c.label).join(';'), ...rows.map((f) => cols.map((c) => esc(f.props[c])).join(';'))].join('\r\n')], { type: 'text/csv;charset=utf-8' }), `table_${active}.csv`)
  }
  const selectionFeatures = () => all.filter((f) => selected.has(f.key)).map((f) => ({ geometry: f.geometry, properties: Object.fromEntries(Object.entries(f.props).filter(([k]) => !k.startsWith('_'))) }))
  const [exportOpen, setExportOpen] = useState(false)

  const ident = identified ? feats.current.get(identified) : null
  const selCount = selected.size
  const btn = (t: Tool, icon: React.ReactNode, title: string, needEdit = false) => (
    <button key={t} title={title + (needEdit && !editMode ? ' (activez le mode édition)' : '')} disabled={needEdit && !editMode}
      onClick={() => { setTool(t); if (t !== 'identify') setIdentified(null) }}
      className={`p-2 rounded-lg transition disabled:opacity-30 ${tool === t ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{icon}</button>
  )
  const act = (icon: React.ReactNode, title: string, onClick: () => void, disabled = false, cls = 'text-gray-700 hover:bg-gray-100') => (
    <button title={title} onClick={onClick} disabled={disabled} className={`p-2 rounded-lg transition disabled:opacity-30 ${cls}`}>{icon}</button>
  )
  const sep = <span className="w-px h-6 bg-gray-200 mx-1" />
  const ic = 'w-4 h-4'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-white border-y border-gray-200">
        {btn('pan', <Hand className={ic} />, 'Se déplacer sur la carte (main)')}
        {act(<ZoomIn className={ic} />, 'Zoom avant', () => map?.zoomIn())}
        {act(<ZoomOut className={ic} />, 'Zoom arrière', () => map?.zoomOut())}
        {act(<Maximize className={ic} />, 'Zoom sur la couche active', () => fit(activeFeats))}
        {act(<Focus className={ic} />, 'Zoom sur la sélection', () => fit(all.filter((f) => selected.has(f.key))), !selCount)}
        {sep}
        {btn('select', <MousePointer2 className={ic} />, 'Sélectionner (clic ; Maj/Ctrl + clic pour ajouter)')}
        {btn('selectRect', <SquareDashedMousePointer className={ic} />, 'Sélection rectangulaire (glisser ; Maj pour ajouter)')}
        {act(<CheckSquare className={ic} />, 'Tout sélectionner (couche active) — Ctrl+A', selectAll)}
        {act(<XSquare className={ic} />, 'Tout désélectionner — Échap', () => setSelected(new Set()), !selCount)}
        {act(<Repeat className={ic} />, 'Inverser la sélection', invert)}
        {btn('identify', <Info className={ic} />, 'Identifier les entités (attributs)')}
        {sep}
        {act(<Pencil className={ic} />, editMode ? 'Quitter le mode édition' : 'Basculer en mode édition', toggleEdit, false, editMode ? 'bg-amber-100 text-amber-800' : 'text-gray-700 hover:bg-gray-100')}
        {hasLegacy && btn('add', <PenTool className={ic} />, 'Ajouter un polygone (couche Anciens polygones)', true)}
        {btn('vertex', <Spline className={ic} />, 'Outil de nœuds : sélectionnez UN polygone puis déplacez / ajoutez / supprimez ses sommets', true)}
        {btn('move', <Move className={ic} />, 'Déplacer les polygones sélectionnés (glisser)', true)}
        {act(<Trash2 className={ic} />, 'Supprimer la sélection — Suppr', deleteSelection, !editMode || !selCount, 'text-red-600 hover:bg-red-50')}
        {act(<Undo2 className={ic} />, `Annuler${undo.current.length ? ' : ' + undo.current[undo.current.length - 1].label : ''} — Ctrl+Z`, doUndo, !undo.current.length)}
        {act(<Redo2 className={ic} />, 'Rétablir — Ctrl+Y', doRedo, !redo.current.length)}
        <button onClick={save} disabled={!editMode || !changesCount.total || saving} title="Enregistrer les modifications — Ctrl+S"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white disabled:bg-gray-200 disabled:text-gray-400 ml-1">
          {saving ? <Loader2 className={`${ic} animate-spin`} /> : <Save className={ic} />} Enregistrer{changesCount.total ? ` (${changesCount.total})` : ''}
        </button>
        {act(<RotateCcw className={ic} />, 'Annuler toutes les modifications non enregistrées', rollback, !changesCount.total)}
        {sep}
        {btn('measureLine', <Ruler className={ic} />, 'Mesurer une distance')}
        {btn('measureArea', <Pentagon className={ic} />, 'Mesurer une surface')}
        {sep}
        {act(<Table2 className={ic} />, 'Ouvrir la table attributaire', () => setShowTable(!showTable), false, showTable ? 'bg-primary-100 text-primary-800' : 'text-gray-700 hover:bg-gray-100')}
        <div className="relative">
          {act(<Download className={ic} />, 'Exporter la sélection', () => setExportOpen(!exportOpen), !selCount)}
          {exportOpen && selCount > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[1100] text-xs py-1 w-44">
              {[['GeoJSON', () => exportGeoJSON(selectionFeatures(), 'selection.geojson')], ['KML', () => exportKML(selectionFeatures(), 'selection.kml')],
                ['Shapefile', () => exportShapefile(selectionFeatures(), 'selection_shp.zip', 'selection')]].map(([l, fn]) => (
                <button key={l as string} onClick={() => { (fn as () => void)(); setExportOpen(false) }} className="block w-full text-left px-3 py-1.5 hover:bg-gray-50">{l as string} ({selCount})</button>
              ))}
            </div>
          )}
        </div>
        {isAdmin && (
          <select value={coop} onChange={(e) => { if (changesCount.total && !window.confirm('Des modifications ne sont pas enregistrées. Changer de coopérative les abandonne. Continuer ?')) return; setCoop(e.target.value); undo.current = []; firstFit.current = false }} className="ml-auto px-2 py-1.5 border border-gray-200 rounded-lg text-xs">
            {role === 'owner' && <option value="all">Toutes les coopératives</option>}
            {cooperatives.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Panneau des couches */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 p-2 text-xs space-y-1 overflow-y-auto">
          <p className="font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><Layers className="w-3.5 h-3.5" /> Couches</p>
          {(['parcels', ...(hasLegacy ? ['legacy'] : [])] as LayerId[]).map((l) => (
            <div key={l} onClick={() => setActive(l)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer ${active === l ? 'bg-primary-50 ring-1 ring-primary-300' : 'hover:bg-gray-50'}`}>
              <button onClick={(e) => { e.stopPropagation(); setVisible((v) => ({ ...v, [l]: !v[l] })) }} title={visible[l] ? 'Masquer' : 'Afficher'}>
                {visible[l] ? <Eye className="w-3.5 h-3.5 text-gray-600" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              <span className="w-3 h-3 rounded-sm" style={{ background: l === 'legacy' ? LEGACY_COLOR : '#16a34a' }} />
              <span className="flex-1">{LAYER_LABEL[l]}</span>
              <span className="text-gray-400">{all.filter((f) => f.layer === l).length}</span>
            </div>
          ))}
          <p className="text-[11px] text-gray-400 px-1">Couche active : sélection globale, table attributaire et zoom.</p>
          {active === 'parcels' && (
            <div className="pt-2 space-y-0.5">
              {Object.entries(EUDR_LABEL).map(([k, l]) => <p key={k} className="flex items-center gap-1.5 px-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: EUDR[k] }} />{l}</p>)}
            </div>
          )}
          {changesCount.total > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-amber-50 text-amber-800 space-y-0.5">
              <p className="font-semibold">Non enregistré</p>
              {changesCount.mod > 0 && <p>{changesCount.mod} modifié(s)</p>}
              {changesCount.add > 0 && <p>{changesCount.add} ajouté(s)</p>}
              {changesCount.del > 0 && <p>{changesCount.del} supprimé(s)</p>}
            </div>
          )}
          {undo.current.length > 0 && (
            <div className="mt-2">
              <p className="font-semibold text-gray-600 px-1">Historique</p>
              {undo.current.slice(-8).reverse().map((h, i) => <p key={i} className="px-1 text-gray-500 truncate">{h.label}</p>)}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="relative flex-1 min-h-0">
            <MapContainer center={[7.54, -5.55]} zoom={7} className="h-full w-full" preferCanvas>
              <LayersControl position="topright">
                <BaseLayer checked name="Satellite Google"><TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" maxZoom={21} /></BaseLayer>
                <BaseLayer name="Hybride Google"><TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google" maxZoom={21} /></BaseLayer>
                <BaseLayer name="OpenStreetMap"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" /></BaseLayer>
              </LayersControl>
              <MapRef onMap={setMap} />
              <GisEngine features={shown} version={version} selected={selected} tool={tool} editMode={editMode} styleOf={styleOf}
                onSelect={select} onBoxSelect={boxSelect} onIdentify={setIdentified} onGeometries={onGeometries}
                onAddPolygon={onAddPolygon} onMeasure={setMeasure} onCursor={(x, y) => setCursor([x, y])} />
            </MapContainer>

            {ident && (
              <div className="absolute top-3 left-3 z-[1000] bg-white rounded-xl shadow-xl border border-gray-100 w-72 max-h-[70%] flex flex-col text-xs">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <p className="font-semibold text-gray-800 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-primary-600" /> {ident.label}</p>
                  <button onClick={() => setIdentified(null)}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
                <div className="overflow-y-auto px-3 py-2 space-y-0.5">
                  <p className="text-gray-500">{LAYER_LABEL[ident.layer]}</p>
                  {Object.entries(ident.props).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                    <p key={k} className="flex justify-between gap-3"><span className="text-gray-500">{k}</span><span className="text-gray-800 text-right break-all">{String(v ?? '')}</span></p>
                  ))}
                  <p className="flex justify-between gap-3 pt-1 border-t border-gray-100"><span className="text-gray-500">Sommets</span><span>{vertexCount(ident.geometry)}</span></p>
                  <p className="flex justify-between gap-3"><span className="text-gray-500">Périmètre</span><span>{fmtLength(toMulti(ident.geometry).reduce((s, p) => s + (p[0] ? lineLength([...p[0], p[0][0]]) : 0), 0))}</span></p>
                  <p className="flex justify-between gap-3"><span className="text-gray-500">Auto-intersection</span><span className={hasSelfIntersection(ident.geometry) ? 'text-red-600 font-semibold' : 'text-green-700'}>{hasSelfIntersection(ident.geometry) ? 'OUI' : 'non'}</span></p>
                </div>
              </div>
            )}
            {tool === 'vertex' && editMode && selCount !== 1 && (
              <p className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-amber-50 text-amber-800 text-xs px-3 py-1.5 rounded-lg shadow">Outil de nœuds : cliquez UN polygone pour afficher ses sommets.</p>
            )}
          </div>

          {/* Barre d'état */}
          <div className="flex flex-wrap items-center gap-4 px-3 py-1 bg-gray-50 border-t border-gray-200 text-[11px] text-gray-600">
            <span>{cursor ? `Coordonnées : ${cursor[1].toFixed(6)}, ${cursor[0].toFixed(6)} (WGS84)` : 'Coordonnées : —'}</span>
            <span>Zoom : {map?.getZoom() ?? '—'}</span>
            <span>{selCount} sélectionné(s)</span>
            <span className={editMode ? 'text-amber-700 font-semibold' : ''}>{editMode ? '✎ Mode édition' : 'Consultation'}</span>
            {measure && <span className="text-primary-700 font-medium">{measure}</span>}
          </div>

          {showTable && (
            <div className="h-72 flex-shrink-0">
              <AttributeTable title={LAYER_LABEL[active]} features={activeFeats} columns={columns} selected={selected} editMode={editMode && editableLayer(active)}
                canAddField={active === 'legacy'} onRowClick={(k, multi) => select([k], multi ? 'toggle' : 'replace')}
                onZoom={(k) => { const f = feats.current.get(k); if (f) { fit([f]); setSelected(new Set([k])) } }}
                onEdit={editAttribute} onAddField={addField} onExportCsv={exportRows} onClose={() => setShowTable(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
