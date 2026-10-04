import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  toLatLngs, toMulti, fromMulti, translate, lineLength, areaHa, fmtLength, fmtArea,
  type PolyGeom, type Multi, type BBox,
} from './gisGeom'

export type LayerId = 'parcels' | 'legacy'
export type Tool = 'pan' | 'select' | 'selectRect' | 'identify' | 'vertex' | 'move' | 'add' | 'measureLine' | 'measureArea'

export interface GFeature {
  key: string                    // « parcels:<id> », « legacy:<id> » ou « new:<n> »
  layer: LayerId
  id: string                     // identifiant serveur (ou temporaire pour les créations)
  label: string                  // nom affiché (Field ID, nom…)
  geometry: PolyGeom
  props: Record<string, unknown> // table attributaire
  state: 'clean' | 'modified' | 'new'
}

export interface EngineStyle { fill: string; stroke: string }

interface Props {
  features: GFeature[]
  version: number                                      // change à chaque modification des entités
  selected: Set<string>
  tool: Tool
  editMode: boolean
  styleOf: (f: GFeature) => EngineStyle
  onSelect: (keys: string[], mode: 'replace' | 'add' | 'toggle') => void
  onBoxSelect: (box: BBox, additive: boolean) => void
  onIdentify: (key: string) => void
  onGeometries: (changes: Map<string, PolyGeom>, label: string) => void   // validation d'un déplacement / d'une édition de nœuds
  onAddPolygon: (g: PolyGeom) => void
  onMeasure: (text: string) => void
  onCursor?: (lng: number, lat: number) => void
}

const SELECT = { fill: '#facc15', stroke: '#a16207' }   // jaune de sélection, comme QGIS
const NODE_ICON = L.divIcon({ className: '', html: '<div style="width:10px;height:10px;background:#fff;border:2px solid #dc2626;border-radius:2px;box-shadow:0 0 2px #0008"></div>', iconSize: [10, 10], iconAnchor: [5, 5] })
const MID_ICON = L.divIcon({ className: '', html: '<div style="width:8px;height:8px;background:#dc2626aa;border:1px solid #fff;border-radius:50%"></div>', iconSize: [8, 8], iconAnchor: [4, 4] })

/** Moteur de la carte d'édition (Leaflet impératif : des milliers de polygones sur un canvas). */
export default function GisEngine(props: Props) {
  const map = useMap()
  const p = useRef(props); p.current = props
  const layers = useRef(new Map<string, L.Polygon>())
  const geoms = useRef(new Map<string, PolyGeom>())
  // un seul canvas pour tout (polygones et tracés temporaires) : un second canvas posé au-dessus intercepterait les clics
  const renderer = useRef(L.canvas({ tolerance: 4 }))
  const featureClicked = useRef(false)
  const nodeLayer = useRef(L.layerGroup())
  const tempLayer = useRef(L.layerGroup())

  // ── Synchronisation des polygones (création / mise à jour / suppression des seuls polygones changés)
  useEffect(() => {
    const seen = new Set<string>()
    for (const f of props.features) {
      seen.add(f.key)
      const lyr = layers.current.get(f.key)
      if (!lyr) {
        const poly = L.polygon(toLatLngs(f.geometry), { renderer: renderer.current, weight: 1.5, fillOpacity: 0.35, bubblingMouseEvents: true })
        poly.on('click', (e: L.LeafletMouseEvent) => onFeatureClick(f.key, e))
        poly.on('mousedown', (e: L.LeafletMouseEvent) => onFeatureDown(f.key, e))
        poly.addTo(map)
        layers.current.set(f.key, poly)
        geoms.current.set(f.key, f.geometry)
      } else if (geoms.current.get(f.key) !== f.geometry) {
        lyr.setLatLngs(toLatLngs(f.geometry))
        geoms.current.set(f.key, f.geometry)
      }
    }
    for (const [k, lyr] of layers.current) if (!seen.has(k)) { lyr.remove(); layers.current.delete(k); geoms.current.delete(k) }
    restyle()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.version, props.features])

  useEffect(() => { restyle() }, [props.selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const restyle = () => {
    const byKey = new Map(p.current.features.map((f) => [f.key, f]))
    for (const [k, lyr] of layers.current) {
      const f = byKey.get(k)
      if (!f) continue
      const sel = p.current.selected.has(k)
      const s = sel ? SELECT : p.current.styleOf(f)
      lyr.setStyle({
        color: s.stroke, fillColor: s.fill, weight: sel ? 3 : f.state === 'clean' ? 1.5 : 2.5,
        fillOpacity: sel ? 0.45 : 0.3, dashArray: f.state === 'new' ? '6 4' : f.state === 'modified' ? '3 3' : undefined,
      })
      if (sel) lyr.bringToFront()
    }
  }

  // ── Comportement de la souris selon l'outil
  useEffect(() => {
    const t = props.tool
    if (t === 'pan' || t === 'select' || t === 'identify') map.dragging.enable(); else map.dragging.disable()
    if (t === 'add' || t === 'measureLine' || t === 'measureArea') map.doubleClickZoom.disable(); else map.doubleClickZoom.enable()
    const c = map.getContainer()
    c.style.cursor = t === 'pan' ? 'grab' : t === 'move' ? 'move' : t === 'identify' ? 'help' : ['add', 'measureLine', 'measureArea', 'selectRect'].includes(t) ? 'crosshair' : 'default'
    tempLayer.current.clearLayers()
    p.current.onMeasure('')
  }, [props.tool, map])

  useEffect(() => {
    nodeLayer.current.addTo(map); tempLayer.current.addTo(map)
    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (featureClicked.current) { featureClicked.current = false; return }
      const t = p.current.tool
      if (t === 'select' && !(e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey)) p.current.onSelect([], 'replace')
      if (t === 'add' || t === 'measureLine' || t === 'measureArea') sketchClick(e.latlng)
    }
    const onMove = (e: L.LeafletMouseEvent) => {
      p.current.onCursor?.(e.latlng.lng, e.latlng.lat)
      if (sketch.current.length && ['add', 'measureLine', 'measureArea'].includes(p.current.tool)) drawSketch(e.latlng)
    }
    const onDbl = () => { if (['add', 'measureLine', 'measureArea'].includes(p.current.tool)) finishSketch() }
    const onDown = (e: L.LeafletMouseEvent) => { if (p.current.tool === 'selectRect') startBox(e) }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if (!['add', 'measureLine', 'measureArea'].includes(p.current.tool)) return
      if (e.key === 'Enter') finishSketch()
      if (e.key === 'Escape') { sketch.current = []; tempLayer.current.clearLayers(); p.current.onMeasure('') }
      if (e.key === 'Backspace' && sketch.current.length) { sketch.current.pop(); drawSketch(null) }
    }
    map.on('click', onMapClick); map.on('mousemove', onMove); map.on('dblclick', onDbl); map.on('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { map.off('click', onMapClick); map.off('mousemove', onMove); map.off('dblclick', onDbl); map.off('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  const onFeatureClick = (key: string, e: L.LeafletMouseEvent) => {
    const t = p.current.tool
    if (t === 'add' || t === 'measureLine' || t === 'measureArea' || t === 'selectRect') return   // le clic sert au dessin
    featureClicked.current = true
    const multi = e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey
    if (t === 'identify') { p.current.onIdentify(key); p.current.onSelect([key], 'replace'); return }
    if (t === 'select' || t === 'pan' || t === 'vertex') p.current.onSelect([key], multi ? 'toggle' : 'replace')
  }

  // ── Déplacement des polygones sélectionnés (outil « Déplacer »)
  const onFeatureDown = (key: string, e: L.LeafletMouseEvent) => {
    if (p.current.tool !== 'move' || !p.current.editMode) return
    L.DomEvent.stop(e)
    featureClicked.current = true
    let keys = [...p.current.selected]
    if (!p.current.selected.has(key)) { keys = [key]; p.current.onSelect([key], 'replace') }
    const start = e.latlng
    const orig = new Map(keys.map((k) => [k, geoms.current.get(k)!]).filter(([, g]) => g) as [string, PolyGeom][])
    let moved: Map<string, PolyGeom> | null = null
    const mm = (ev: L.LeafletMouseEvent) => {
      const dLng = ev.latlng.lng - start.lng, dLat = ev.latlng.lat - start.lat
      moved = new Map()
      for (const [k, g] of orig) { const ng = translate(g, dLng, dLat); moved.set(k, ng); layers.current.get(k)?.setLatLngs(toLatLngs(ng)) }
    }
    const up = () => {
      map.off('mousemove', mm); map.off('mouseup', up)
      if (moved) p.current.onGeometries(moved, `Déplacement de ${moved.size} polygone(s)`)
    }
    map.on('mousemove', mm); map.on('mouseup', up)
  }

  // ── Outil de nœuds : sommets déplaçables, milieux pour ajouter un sommet, clic droit pour supprimer
  const vertexKey = props.tool === 'vertex' && props.editMode && props.selected.size === 1 ? [...props.selected][0] : null
  const vertexGeom = vertexKey ? props.features.find((f) => f.key === vertexKey)?.geometry : undefined
  useEffect(() => {
    nodeLayer.current.clearLayers()
    if (!vertexKey || !vertexGeom) return
    const work: Multi = toMulti(vertexGeom)
    const lyr = layers.current.get(vertexKey)
    const commit = () => p.current.onGeometries(new Map([[vertexKey, fromMulti(work, vertexGeom.type)]]), 'Édition des nœuds')
    const live = () => lyr?.setLatLngs(toLatLngs(fromMulti(work, vertexGeom.type)))
    work.forEach((poly, pi) => poly.forEach((ring, ri) => {
      if (ring.length > 1500) return   // anneaux énormes : on évite des milliers de poignées
      ring.forEach(([x, y], vi) => {
        const m = L.marker([y, x], { icon: NODE_ICON, draggable: true, keyboard: false, zIndexOffset: 1000 })
        m.on('drag', (ev) => { const ll = (ev.target as L.Marker).getLatLng(); work[pi][ri][vi] = [ll.lng, ll.lat]; live() })
        m.on('dragend', commit)
        m.on('contextmenu', (ev) => {
          L.DomEvent.stop(ev)
          if (work[pi][ri].length <= 3) return
          work[pi][ri].splice(vi, 1); commit()
        })
        m.bindTooltip('Glisser : déplacer · clic droit : supprimer le sommet', { direction: 'top', offset: [0, -6] })
        nodeLayer.current.addLayer(m)
        const [nx, ny] = ring[(vi + 1) % ring.length]
        const mid = L.marker([(y + ny) / 2, (x + nx) / 2], { icon: MID_ICON, draggable: true, keyboard: false, zIndexOffset: 900 })
        let inserted = false
        mid.on('dragstart', () => { work[pi][ri].splice(vi + 1, 0, [(x + nx) / 2, (y + ny) / 2]); inserted = true })
        mid.on('drag', (ev) => { if (!inserted) return; const ll = (ev.target as L.Marker).getLatLng(); work[pi][ri][vi + 1] = [ll.lng, ll.lat]; live() })
        mid.on('dragend', commit)
        mid.bindTooltip('Glisser : ajouter un sommet', { direction: 'top', offset: [0, -6] })
        nodeLayer.current.addLayer(mid)
      })
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertexKey, vertexGeom])

  // ── Dessin (nouveau polygone) et mesures
  const sketch = useRef<L.LatLng[]>([])
  const sketchClick = (ll: L.LatLng) => {
    const last = sketch.current[sketch.current.length - 1]
    if (last && map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(ll)) < 3) return  // double-clic
    sketch.current.push(ll); drawSketch(null)
  }
  const drawSketch = (cursor: L.LatLng | null) => {
    tempLayer.current.clearLayers()
    const pts = cursor ? [...sketch.current, cursor] : sketch.current
    const t = p.current.tool
    const color = t === 'add' ? '#2563eb' : '#ea580c'
    if (pts.length >= 3 && t !== 'measureLine') L.polygon(pts, { renderer: renderer.current, color, weight: 2, dashArray: '5 4', fillOpacity: 0.15, interactive: false }).addTo(tempLayer.current)
    else if (pts.length >= 2) L.polyline(pts, { renderer: renderer.current, color, weight: 2, dashArray: '5 4', interactive: false }).addTo(tempLayer.current)
    sketch.current.forEach((q) => L.circleMarker(q, { renderer: renderer.current, radius: 4, color, fillColor: '#fff', fillOpacity: 1, weight: 2, interactive: false }).addTo(tempLayer.current))
    const coords = pts.map((q) => [q.lng, q.lat] as [number, number])
    if (t === 'measureLine') p.current.onMeasure(coords.length >= 2 ? `Distance : ${fmtLength(lineLength(coords))}` : 'Cliquez pour mesurer, double-clic pour terminer')
    else if (t === 'measureArea') p.current.onMeasure(coords.length >= 3
      ? `Surface : ${fmtArea(areaHa({ type: 'Polygon', coordinates: [[...coords, coords[0]]] }))} · périmètre ${fmtLength(lineLength([...coords, coords[0]]))}`
      : 'Cliquez les sommets, double-clic pour terminer')
    else p.current.onMeasure(coords.length ? `${sketch.current.length} sommet(s) · Entrée ou double-clic : terminer · Retour arrière : annuler le dernier · Échap : abandonner` : '')
  }
  const finishSketch = () => {
    const t = p.current.tool
    const coords = sketch.current.map((q) => [q.lng, q.lat] as [number, number])
    if (t === 'add') {
      if (coords.length < 3) return
      p.current.onAddPolygon({ type: 'Polygon', coordinates: [[...coords, coords[0]]] })
      sketch.current = []; tempLayer.current.clearLayers(); p.current.onMeasure('')
    } else {
      sketch.current = []   // la mesure reste affichée jusqu'au prochain clic
    }
  }

  // ── Sélection rectangulaire
  const startBox = (e: L.LeafletMouseEvent) => {
    const a = e.latlng
    const rect = L.rectangle(L.latLngBounds(a, a), { renderer: renderer.current, color: '#a16207', weight: 1, dashArray: '4 3', fillOpacity: 0.08, interactive: false }).addTo(tempLayer.current)
    const mm = (ev: L.LeafletMouseEvent) => rect.setBounds(L.latLngBounds(a, ev.latlng))
    const up = (ev: L.LeafletMouseEvent) => {
      map.off('mousemove', mm); map.off('mouseup', up)
      const b = rect.getBounds(); rect.remove()
      featureClicked.current = true
      p.current.onBoxSelect({ minX: b.getWest(), minY: b.getSouth(), maxX: b.getEast(), maxY: b.getNorth() },
        ev.originalEvent.shiftKey || ev.originalEvent.ctrlKey || ev.originalEvent.metaKey)
    }
    map.on('mousemove', mm); map.on('mouseup', up)
  }

  return null
}
