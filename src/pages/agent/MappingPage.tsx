import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Polygon, Marker, CircleMarker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Satellite, Play, Pause, Square, AlertTriangle, CheckCircle2,
  Target, ArrowLeft, ChevronRight, MapPin, Undo2, Crosshair, Ban,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import type { GPSPoint, MappingStatus, GeoJSONPolygon } from '../../types'
import {
  computePolygonArea, computePerimeter, formatArea,
  formatDistance, accuracyLabel, pointsToGeoJSONCoords, filterAberrantPoints,
  findOverlappingParcels,
} from '../../utils/gpsUtils'
import { validateEUDR } from '../../utils/eudrValidator'
import {
  generateParcelFieldId, getNextParcelIndex,
} from '../../utils/fieldId'
import { parcelsApi } from '../../api/parcels'
import { mapParcel } from '../../api/mappers'

// Fix leaflet default marker icon
delete (L.Icon.Default.prototype as unknown as { _getIconUrl: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Live position pulsing icon
const liveIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Numbered vertex icon
const vertexIcon = (n: number) =>
  L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;border:2px solid white;color:white;font-size:11px;font-weight:bold;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.4);">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

type Step = 'select_producer' | 'configure' | 'mapping' | 'result'

const BEOUMI_CENTER: [number, number] = [7.67, -5.68]

// Handles clicks on the map to add a vertex (useful on desktop / no-GPS testing)
function MapClickHandler({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function MappingPage() {
  const navigate = useNavigate()
  const { producers, parcels, addParcel, addNotification, currentAgentId, isLive } = useAppStore()
  const agentId = currentAgentId ?? 'agent-001'

  const [step, setStep] = useState<Step>('select_producer')
  const [selectedProducerId, setSelectedProducerId] = useState('')
  const [parcelName, setParcelName] = useState('Nouvelle parcelle')
  const [culture, setCulture] = useState('Cacao')
  const [status, setStatus] = useState<MappingStatus>('idle')
  const [points, setPoints] = useState<GPSPoint[]>([])
  const [currentPos, setCurrentPos] = useState<GPSPoint | null>(null)
  const [autoTrack, setAutoTrack] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [pauseStart, setPauseStart] = useState<number | null>(null)
  const [totalPausedMs, setTotalPausedMs] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateEUDR> | null>(null)
  const [mapRef, setMapRef] = useState<L.Map | null>(null)
  const [gpsState, setGpsState] = useState<'idle' | 'acquiring' | 'active' | 'denied' | 'unavailable'>('idle')
  const watchId = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoTrackRef = useRef(false)
  const statusRef = useRef<MappingStatus>('idle')
  const simRef = useRef<[number, number]>(BEOUMI_CENTER)
  const retriedRef = useRef(false)

  // En mode live, l'agent voit ses producteurs assignés ; sinon (démo) tous ceux du mock
  const myProducers = producers.filter((p) => !isLive || p.assignedAgentId === agentId)
  const selectedProducer = producers.find((p) => p.id === selectedProducerId)

  // Keep refs in sync so the geolocation callback always reads the latest values
  useEffect(() => { autoTrackRef.current = autoTrack }, [autoTrack])
  useEffect(() => { statusRef.current = status }, [status])

  // Timer
  useEffect(() => {
    if (status === 'active' && startTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime - totalPausedMs)
      }, 500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status, startTime, totalPausedMs])

  // Cleanup GPS watch on unmount
  useEffect(() => () => stopGPS(), [])

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m ${s % 60}s`
  }

  // Add a vertex point (manual or auto)
  const addPoint = useCallback((p: GPSPoint) => {
    setPoints((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1]
        const dist = Math.hypot(p.lat - last.lat, p.lng - last.lng) * 111000
        if (dist < 0.5) return prev // ignore duplicate / sub-0.5m
      }
      return [...prev, p]
    })
  }, [])

  // Latest-callback ref: the geolocation watch always runs fresh logic (no stale closure)
  const handlePositionRef = useRef<(pos: GeolocationPosition) => void>(() => {})
  handlePositionRef.current = (pos: GeolocationPosition) => {
    const gpsPoint: GPSPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
      speed: pos.coords.speed ?? undefined,
    }
    setGpsError(null)
    setGpsState('active')
    retriedRef.current = false
    setCurrentPos(gpsPoint)
    simRef.current = [gpsPoint.lat, gpsPoint.lng]
    // Auto-tracking mode: record the track continuously while active
    if (autoTrackRef.current && statusRef.current === 'active') {
      addPoint(gpsPoint)
      mapRef?.setView([gpsPoint.lat, gpsPoint.lng])
    }
  }

  const handleGeoError = useCallback((err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      setGpsState('denied')
      setGpsError("Autorisation GPS refusée. Cliquez sur l'icône cadenas du navigateur → Autoriser la localisation, puis « Réessayer le GPS ». En attendant, touchez la carte pour placer les sommets.")
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      setGpsState('unavailable')
      setGpsError('Position GPS indisponible sur cet appareil. Touchez la carte pour placer les sommets manuellement.')
    } else {
      // TIMEOUT — retry once with relaxed (low-accuracy) settings before giving up
      if (!retriedRef.current && navigator.geolocation) {
        retriedRef.current = true
        setGpsError('Signal GPS lent… nouvelle tentative en cours.')
        navigator.geolocation.getCurrentPosition(
          (p) => handlePositionRef.current(p),
          handleGeoError,
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 30000 }
        )
        return
      }
      setGpsState('unavailable')
      setGpsError('GPS introuvable. Touchez la carte pour placer les sommets manuellement.')
    }
    // Ensure a position exists so manual marking still works
    setCurrentPos((prev) => prev ?? {
      lat: BEOUMI_CENTER[0], lng: BEOUMI_CENTER[1], accuracy: 50, timestamp: Date.now(),
    })
  }, [])

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsState('unavailable')
      setGpsError("Ce navigateur ne supporte pas la géolocalisation. Touchez la carte pour placer les sommets.")
      setCurrentPos((prev) => prev ?? { lat: BEOUMI_CENTER[0], lng: BEOUMI_CENTER[1], accuracy: 50, timestamp: Date.now() })
      return
    }
    // Requires a secure context (https or localhost)
    if (!window.isSecureContext) {
      setGpsState('unavailable')
      setGpsError('Le GPS exige une connexion sécurisée (https) ou localhost. Touchez la carte pour placer les sommets.')
    }
    setGpsState('acquiring')
    retriedRef.current = false
    stopGPS()
    // Immediate first fix (high accuracy, generous timeout)
    navigator.geolocation.getCurrentPosition(
      (p) => handlePositionRef.current(p),
      handleGeoError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
    // Continuous tracking
    watchId.current = navigator.geolocation.watchPosition(
      (p) => handlePositionRef.current(p),
      handleGeoError,
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 3000 }
    )
  }, [handleGeoError])

  function stopGPS() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }

  const handleStart = () => {
    setStatus('active')
    setStartTime(Date.now())
    setPoints([])
    setTotalPausedMs(0)
    setGpsError(null)
    simRef.current = BEOUMI_CENTER
    startGPS()
  }

  // "Marquer ce point" — capture the current position as a polygon vertex
  const handleMarkPoint = () => {
    if (!currentPos) {
      // No fix yet → use simulated center
      const sim: GPSPoint = {
        lat: simRef.current[0], lng: simRef.current[1], accuracy: 8, timestamp: Date.now(),
      }
      setCurrentPos(sim)
      addPoint(sim)
      return
    }
    addPoint({ ...currentPos, timestamp: Date.now() })
  }

  // Add point from a map click (desktop / simulation)
  const handleMapClick = (lat: number, lng: number) => {
    if (status !== 'active') return
    const p: GPSPoint = { lat, lng, accuracy: currentPos?.accuracy ?? 8, timestamp: Date.now() }
    setCurrentPos(p)
    simRef.current = [lat, lng]
    addPoint(p)
  }

  const handleUndo = () => setPoints((prev) => prev.slice(0, -1))

  const handlePause = () => {
    setStatus('paused')
    setPauseStart(Date.now())
  }

  const handleResume = () => {
    if (pauseStart) {
      setTotalPausedMs((p) => p + (Date.now() - pauseStart))
      setPauseStart(null)
    }
    setStatus('active')
  }

  const handleFinish = () => {
    const cleaned = autoTrack ? filterAberrantPoints(points) : points
    const geomCoords = pointsToGeoJSONCoords(cleaned)
    if (geomCoords.length === 0) return

    // ⛔ Refuse if the new polygon overlaps an existing parcel
    const overlaps = findOverlappingParcels(geomCoords[0], existingParcels)
    if (overlaps.length > 0) {
      addNotification({
        type: 'error',
        title: 'Chevauchement détecté — mapping refusé',
        message: `Cette parcelle chevauche : ${overlaps.map((o) => o.fieldId).join(', ')}. Reprenez le tracé sans empiéter sur une parcelle existante.`,
      })
      return
    }

    stopGPS()
    setStatus('finishing')
    const geometry: GeoJSONPolygon = { type: 'Polygon', coordinates: geomCoords }
    const result = validateEUDR(geometry, { country: "Côte d'Ivoire", culture })
    setValidationResult(result)
    setStep('result')
  }

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!selectedProducer || !validationResult || saving) return
    const cleaned = autoTrack ? filterAberrantPoints(points) : points
    const geomCoords = pointsToGeoJSONCoords(cleaned)

    // ⛔ Safety net: never save a parcel that overlaps an existing one
    const overlaps = findOverlappingParcels(geomCoords[0], existingParcels)
    if (overlaps.length > 0) {
      addNotification({
        type: 'error',
        title: 'Enregistrement refusé — chevauchement',
        message: `Chevauche : ${overlaps.map((o) => o.fieldId).join(', ')}.`,
      })
      return
    }

    const geometry: GeoJSONPolygon = { type: 'Polygon', coordinates: geomCoords }
    const areaM2 = computePolygonArea(cleaned)
    const perim = computePerimeter(cleaned)
    setSaving(true)

    // ─── Mode live (connecté) : enregistre dans la BASE DE DONNÉES ───────────
    if (isLive) {
      try {
        const { data } = await parcelsApi.create({
          producer: selectedProducer.id,
          name: parcelName,
          culture,
          geometry,
          area_hectares: Math.round((areaM2 / 10000) * 100) / 100,
          perimeter_meters: Math.round(perim),
          vertex_count: cleaned.length,
          is_synced: true,
        } as never)
        const raw = data as unknown as Record<string, unknown>
        addParcel(mapParcel(raw))
        addNotification({
          type: 'success',
          title: 'Parcelle enregistrée en base ✓',
          message: `${String(raw.field_id ?? '')} — stockée et partagée avec la coopérative.`,
        })
        setSaving(false)
        navigate('/agent')
        return
      } catch {
        addNotification({
          type: 'error',
          title: 'Échec de l\'enregistrement en base',
          message: 'Vérifiez votre connexion. La parcelle est conservée localement.',
        })
        // continue → sauvegarde locale de secours
      }
    }

    // ─── Mode démo / secours : sauvegarde locale ─────────────────────────────
    const idx = getNextParcelIndex(parcels, selectedProducer.id)
    const fieldId = generateParcelFieldId(selectedProducer.fieldIdBase, idx)
    addParcel({
      id: crypto.randomUUID(),
      fieldId,
      producerId: selectedProducer.id,
      cooperativeId: selectedProducer.cooperativeId,
      agentId,
      name: parcelName,
      geometry,
      areaHectares: Math.round((areaM2 / 10000) * 100) / 100,
      perimeterMeters: Math.round(perim),
      vertexCount: cleaned.length,
      culture,
      village: selectedProducer.village,
      section: selectedProducer.section,
      region: selectedProducer.region,
      country: selectedProducer.country,
      status: validationResult.isValid ? 'validated' : 'rejected',
      eudrScore: validationResult.eudrScore,
      eudrStatus: validationResult.eudrScore >= 80 ? 'compliant' : validationResult.eudrScore >= 60 ? 'pending' : 'non_compliant',
      validationResult,
      isSynced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    addNotification({
      type: validationResult.isValid ? 'success' : 'error',
      title: 'Parcelle enregistrée (local)',
      message: `${fieldId} — Score EUDR: ${validationResult.eudrScore}%`,
    })
    setSaving(false)
    navigate('/agent')
  }

  const areaM2 = computePolygonArea(points)
  const perim = computePerimeter(points)
  const accInfo = currentPos ? accuracyLabel(currentPos.accuracy) : null
  const polygonPositions = points.map((p) => [p.lat, p.lng] as [number, number])

  // Existing parcels (to display & to check overlap against)
  const existingParcels = useMemo(
    () => parcels.filter((p) => p.geometry?.coordinates?.[0]?.length >= 3),
    [parcels]
  )

  // Live overlap detection: does the polygon being drawn overlap any existing parcel?
  const currentRing = useMemo(() => points.map((p) => [p.lng, p.lat]), [points])
  const overlapping = useMemo(
    () => (currentRing.length >= 3 ? findOverlappingParcels(currentRing, existingParcels) : []),
    [currentRing, existingParcels]
  )
  const hasOverlap = overlapping.length > 0

  // ─── Step: Select producer ────────────────────────────────────────────────

  if (step === 'select_producer') {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/agent')} className="p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nouveau Mapping</h1>
            <p className="text-sm text-gray-500">Étape 1 : Sélection du producteur</p>
          </div>
        </div>

        <div className="space-y-3">
          {myProducers.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelectedProducerId(p.id); setStep('configure') }}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition text-left ${
                selectedProducerId === p.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/30'
              }`}
            >
              <div>
                <p className="font-semibold text-gray-800">{p.fullName}</p>
                <p className="text-sm text-gray-500 font-mono">{p.fieldIdBase}</p>
                <p className="text-xs text-gray-400">{p.village} · {p.section}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-700">{parcels.filter((parc) => parc.producerId === p.id).length}</p>
                  <p className="text-xs text-gray-400">parcelles</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </button>
          ))}
          {myProducers.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-10">
              Aucun producteur assigné. Demandez à la coopérative de vous en assigner.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ─── Step: Configure ──────────────────────────────────────────────────────

  if (step === 'configure') {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('select_producer')} className="p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Configuration</h1>
            <p className="text-sm text-gray-500">Étape 2 : Paramètres de la parcelle</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="bg-primary-50 rounded-xl p-3">
            <p className="text-sm font-semibold text-primary-800">{selectedProducer?.fullName}</p>
            <p className="text-xs text-primary-600 font-mono">{selectedProducer?.fieldIdBase} · {selectedProducer?.village}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de la parcelle</label>
            <input
              value={parcelName}
              onChange={(e) => setParcelName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Culture</label>
            <select
              value={culture}
              onChange={(e) => setCulture(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              {['Cacao', 'Café', 'Hévéa', 'Palmier à huile', 'Soja', 'Bois'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <p className="font-semibold mb-1">FIELD ID généré automatiquement</p>
            <p className="font-mono text-base">
              {selectedProducer?.fieldIdBase}-M{String(getNextParcelIndex(parcels, selectedProducerId)).padStart(3, '0')}
            </p>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">📍 Comment mapper ?</p>
            <p>Marchez le long des limites de la parcelle. À chaque coin, appuyez sur <strong>« Marquer ce point »</strong>. Le polygone se forme automatiquement. Minimum 3 points.</p>
          </div>
        </div>

        <button
          onClick={() => { setStep('mapping'); handleStart() }}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-3 text-lg shadow-lg"
        >
          <Satellite className="w-6 h-6" />
          Commencer le Mapping GPS
        </button>
      </div>
    )
  }

  // ─── Step: Mapping ────────────────────────────────────────────────────────

  if (step === 'mapping') {
    return (
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="bg-primary-900 text-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">{parcelName}</p>
            <p className="text-primary-300 text-xs font-mono">{selectedProducer?.fieldIdBase}-M{String(getNextParcelIndex(parcels, selectedProducerId)).padStart(3, '0')}</p>
          </div>
          <div className={`flex items-center gap-2 text-sm px-3 py-1 rounded-full ${
            status === 'active' ? 'bg-green-500/20 text-green-300' :
            status === 'paused' ? 'bg-yellow-500/20 text-yellow-300' :
            'bg-gray-500/20 text-gray-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              status === 'active' ? 'bg-green-400 gps-pulse' :
              status === 'paused' ? 'bg-yellow-400' : 'bg-gray-400'
            }`} />
            {status === 'active' ? 'En cours' : status === 'paused' ? 'Pause' : 'Inactif'}
          </div>
        </div>

        {/* Live stats bar */}
        <div className="bg-primary-800 text-white px-4 py-2 grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xs text-primary-300">Durée</p>
            <p className="text-sm font-bold">{formatElapsed(elapsed)}</p>
          </div>
          <div>
            <p className="text-xs text-primary-300">Sommets</p>
            <p className="text-sm font-bold">{points.length}</p>
          </div>
          <div>
            <p className="text-xs text-primary-300">Superficie</p>
            <p className="text-sm font-bold">{formatArea(areaM2)}</p>
          </div>
          <div>
            <p className="text-xs text-primary-300">Périmètre</p>
            <p className="text-sm font-bold">{formatDistance(perim)}</p>
          </div>
        </div>

        {/* GPS acquiring */}
        {gpsState === 'acquiring' && !currentPos && (
          <div className="px-4 py-1.5 text-xs bg-blue-50 text-blue-700 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span>Acquisition du signal GPS… autorisez la localisation si le navigateur le demande.</span>
          </div>
        )}

        {/* GPS accuracy / mode */}
        {currentPos && accInfo && gpsState === 'active' && (
          <div className={`px-4 py-1.5 text-xs flex items-center justify-between ${accInfo.ok ? 'bg-green-50' : 'bg-orange-50'}`}>
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5" />
              <span>Précision GPS : <strong className={accInfo.color}>{accInfo.label}</strong> (±{currentPos.accuracy.toFixed(1)} m)</span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoTrack}
                onChange={(e) => setAutoTrack(e.target.checked)}
                className="accent-primary-600"
              />
              <span className="text-gray-600">Suivi automatique</span>
            </label>
          </div>
        )}
        {gpsError && (
          <div className="px-4 py-2 text-xs bg-orange-50 text-orange-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{gpsError}</span>
            </div>
            <button
              onClick={startGPS}
              className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white px-2.5 py-1 rounded-lg font-medium whitespace-nowrap"
            >
              <Crosshair className="w-3.5 h-3.5" /> Réessayer le GPS
            </button>
          </div>
        )}
        {/* ⛔ Overlap alert */}
        {hasOverlap && (
          <div className="px-4 py-2 text-xs bg-red-600 text-white flex items-center gap-2 font-medium">
            <Ban className="w-4 h-4 flex-shrink-0" />
            <span>Chevauchement avec {overlapping.map((o) => o.fieldId).join(', ')} — corrigez le tracé, l'enregistrement sera refusé.</span>
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={currentPos ? [currentPos.lat, currentPos.lng] : BEOUMI_CENTER}
            zoom={17}
            className="h-full w-full"
            ref={setMapRef}
          >
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google" />
            <MapClickHandler onAdd={handleMapClick} />

            {/* Existing parcels (to avoid overlap) — shown in orange/red */}
            {existingParcels.map((parcel) => {
              const coords = parcel.geometry.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
              const isHit = overlapping.some((o) => o.id === parcel.id)
              return (
                <Polygon
                  key={parcel.id}
                  positions={coords}
                  pathOptions={{
                    color: isHit ? '#dc2626' : '#f97316',
                    fillColor: isHit ? '#dc2626' : '#f97316',
                    fillOpacity: isHit ? 0.45 : 0.2,
                    weight: isHit ? 3 : 2,
                    dashArray: '5,5',
                  }}
                >
                  <Popup>
                    <div className="text-xs">
                      <p className="font-bold font-mono">{parcel.fieldId}</p>
                      <p className="text-gray-500">Parcelle existante · {parcel.areaHectares.toFixed(2)} ha</p>
                      <p className="text-gray-400">{parcel.culture} · {parcel.village}</p>
                    </div>
                  </Popup>
                </Polygon>
              )
            })}

            {/* Polygon being formed — green normally, red if overlapping */}
            {polygonPositions.length >= 3 && (
              <Polygon
                positions={polygonPositions}
                pathOptions={{
                  color: hasOverlap ? '#dc2626' : '#22c55e',
                  fillColor: hasOverlap ? '#dc2626' : '#22c55e',
                  fillOpacity: 0.3,
                  weight: 3,
                }}
              />
            )}
            {polygonPositions.length === 2 && (
              <Polyline positions={polygonPositions} color={hasOverlap ? '#dc2626' : '#22c55e'} weight={3} />
            )}

            {/* Numbered vertex markers */}
            {points.map((p, i) => (
              <Marker key={i} position={[p.lat, p.lng]} icon={vertexIcon(i + 1)} />
            ))}

            {/* Live position */}
            {currentPos && (
              <>
                <Marker position={[currentPos.lat, currentPos.lng]} icon={liveIcon} />
                <CircleMarker
                  center={[currentPos.lat, currentPos.lng]}
                  radius={Math.max(8, Math.min(currentPos.accuracy, 40))}
                  pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.1, weight: 1 }}
                />
              </>
            )}
          </MapContainer>

          {/* Recenter button */}
          <button
            onClick={() => currentPos && mapRef?.setView([currentPos.lat, currentPos.lng], 18)}
            className="absolute bottom-4 right-4 z-[1000] bg-white shadow-lg rounded-full p-3 hover:bg-gray-50"
            title="Recentrer sur ma position"
          >
            <Crosshair className="w-5 h-5 text-primary-600" />
          </button>
        </div>

        {/* Controls */}
        <div className="bg-white border-t border-gray-100 p-4 space-y-3">
          {/* Primary action: mark a point */}
          {status === 'active' && !autoTrack && (
            <button
              onClick={handleMarkPoint}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-2xl transition text-lg shadow-md active:scale-[0.98]"
            >
              <MapPin className="w-6 h-6" /> Marquer ce point
            </button>
          )}
          {status === 'active' && autoTrack && (
            <div className="text-center text-sm text-primary-700 bg-primary-50 rounded-xl py-3">
              📡 Suivi automatique actif — marchez le long des limites de la parcelle.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleUndo}
              disabled={points.length === 0}
              className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-semibold py-3 px-4 rounded-2xl transition"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            {status === 'active' && (
              <button
                onClick={handlePause}
                className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-2xl transition"
              >
                <Pause className="w-5 h-5" /> Pause
              </button>
            )}
            {status === 'paused' && (
              <button
                onClick={handleResume}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-2xl transition"
              >
                <Play className="w-5 h-5" /> Reprendre
              </button>
            )}
            <button
              onClick={handleFinish}
              disabled={points.length < 3 || hasOverlap}
              className={`flex-1 flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-2xl transition ${
                hasOverlap
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-300'
              }`}
            >
              {hasOverlap ? <Ban className="w-5 h-5" /> : <Square className="w-5 h-5" />}
              {hasOverlap ? 'Bloqué' : 'Terminer'}
            </button>
          </div>
          {hasOverlap ? (
            <p className="text-center text-xs text-red-600 font-medium">
              ⛔ Chevauchement détecté — déplacez les sommets hors des parcelles existantes (en orange/rouge) pour continuer.
            </p>
          ) : points.length < 3 ? (
            <p className="text-center text-xs text-gray-400">
              {points.length === 0
                ? 'Placez le 1er sommet : appuyez sur « Marquer ce point » à un coin de la parcelle.'
                : `${points.length} point(s) — minimum 3 requis pour fermer le polygone.`}
            </p>
          ) : (
            <p className="text-center text-xs text-gray-400">
              Les parcelles existantes apparaissent en orange (pointillés). Évitez de les chevaucher.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ─── Step: Result (EUDR validation) ──────────────────────────────────────

  if (step === 'result' && validationResult) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Satellite className="w-6 h-6 text-primary-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Résultats EUDR</h1>
            <p className="text-sm text-gray-500">Polygon Validator EUDR by JDK</p>
          </div>
        </div>

        {/* Score */}
        <div className={`rounded-2xl p-6 text-center ${validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-black ${validationResult.isValid ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {validationResult.eudrScore}%
          </div>
          <p className="mt-3 font-bold text-lg">
            {validationResult.isValid ? '🟢 Conforme EUDR' : '🔴 Non conforme EUDR'}
          </p>
          <p className="text-sm text-gray-600 mt-1">{validationResult.summary}</p>
        </div>

        {/* Checks */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50">
            <h3 className="font-semibold text-gray-800 text-sm">Détail des contrôles</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {validationResult.checks.map((check) => (
              <div key={check.name} className="flex items-start gap-3 px-5 py-3">
                {check.passed
                  ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${check.severity === 'error' ? 'text-red-500' : 'text-yellow-500'}`} />
                }
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{check.label}</p>
                  <p className="text-xs text-gray-500">{check.message}</p>
                </div>
                {check.value && (
                  <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded-lg">{check.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => { setStep('mapping'); setStatus('active'); setPoints([]); setStartTime(Date.now()); setTotalPausedMs(0); startGPS() }}
            className="flex-1 border border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition"
          >
            Refaire le mapping
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-2xl transition"
          >
            Enregistrer
          </button>
        </div>
      </div>
    )
  }

  return null
}
