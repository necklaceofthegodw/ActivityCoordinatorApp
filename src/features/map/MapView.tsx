import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useUserLocation } from './useUserLocation'
import { useActivities } from '@/features/activities/useActivities'
import { CategoryFilter } from './CategoryFilter'
import { CategoryPicker } from './CategoryPicker'
import { RadiusSlider } from './RadiusSlider'
import { CATEGORY_MAP } from '@/lib/categories'
import type { ActivityCategory, Database } from '@/lib/database.types'

// Fix Leaflet default icon issue with Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  walk:        '#22c55e',
  coffee:      '#f59e0b',
  squash:      '#3b82f6',
  running:     '#ef4444',
  language:    '#8b5cf6',
  skateboard:  '#f97316',
  cycling:     '#06b6d4',
  yoga:        '#ec4899',
  climbing:    '#84cc16',
  swimming:    '#0ea5e9',
  basketball:  '#f59e0b',
  volleyball:  '#10b981',
  chess:       '#6b7280',
  cooking:     '#d97706',
  hiking:      '#65a30d',
  photography: '#7c3aed',
  music:       '#db2777',
  board_games: '#dc2626',
  gym:         '#1d4ed8',
  dancing:     '#c026d3',
}

const userLocationIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const newPinIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📍</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function createActivityIcon(category: ActivityCategory) {
  const color = CATEGORY_COLORS[category]
  const emoji = CATEGORY_MAP[category].emoji
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white;">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]
type LatLng = { lat: number; lng: number }

function RecenterOnLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  map.setView([lat, lng], map.getZoom(), { animate: true })
  return null
}

function MapClickHandler({
  isPickingLocation,
  onPick,
}: {
  isPickingLocation: boolean
  onPick: (latlng: LatLng) => void
}) {
  const map = useMapEvents({
    click(e) {
      if (isPickingLocation) {
        onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
  })

  // Change cursor when picking
  if (isPickingLocation) {
    map.getContainer().style.cursor = 'crosshair'
  } else {
    map.getContainer().style.cursor = ''
  }

  return null
}

interface ActivityMarkerProps {
  activity: Activity
  onSelect: (activity: Activity) => void
}

function ActivityMarker({ activity, onSelect }: ActivityMarkerProps) {
  return (
    <Marker
      position={[activity.lat, activity.lng]}
      icon={createActivityIcon(activity.category)}
      eventHandlers={{ click: () => onSelect(activity) }}
    >
      <Popup>
        <div className="min-w-[160px]">
          <p className="font-semibold">{activity.title}</p>
          <p className="text-xs text-gray-500">
            {new Date(activity.scheduled_at).toLocaleString('pl-PL', {
              weekday: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </p>
          <p className="text-xs text-gray-500">
            {activity.current_participants}/{activity.max_participants} osób
          </p>
        </div>
      </Popup>
    </Marker>
  )
}

interface Props {
  onActivitySelect: (activity: Activity) => void
  onCreateActivity: (latlng: LatLng) => void
  pinnedCategories: ActivityCategory[]
  onPinnedChange: (pinned: ActivityCategory[]) => void
}

export function MapView({ onActivitySelect, onCreateActivity, pinnedCategories, onPinnedChange }: Props) {
  const { location, isLoading } = useUserLocation()
  const [radiusKm, setRadiusKm] = useState(5)
  const [categories, setCategories] = useState<ActivityCategory[]>([])
  const [hasRecentered, setHasRecentered] = useState(false)
  const [isPickingLocation, setIsPickingLocation] = useState(false)
  const [pendingPin, setPendingPin] = useState<LatLng | null>(null)

  const { data: activities = [] } = useActivities({
    lat: location.lat,
    lng: location.lng,
    radiusKm,
    categories,
  })

  function handleFabClick() {
    setIsPickingLocation(true)
    setPendingPin(null)
  }

  function handleMapPick(latlng: LatLng) {
    setPendingPin(latlng)
    setIsPickingLocation(false)
    onCreateActivity(latlng)
  }

  function handleCancelPick() {
    setIsPickingLocation(false)
    setPendingPin(null)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {!hasRecentered && (
          <RecenterOnLocation lat={location.lat} lng={location.lng} />
        )}

        <MapClickHandler
          isPickingLocation={isPickingLocation}
          onPick={handleMapPick}
        />

        {/* User location */}
        <Marker position={[location.lat, location.lng]} icon={userLocationIcon} interactive={false} />
        <Circle
          center={[location.lat, location.lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.05, weight: 1 }}
        />

        {/* Pending pin preview */}
        {pendingPin && (
          <Marker position={[pendingPin.lat, pendingPin.lng]} icon={newPinIcon} />
        )}

        {/* Activity markers */}
        {activities.map((activity) => (
          <ActivityMarker
            key={activity.id}
            activity={activity}
            onSelect={onActivitySelect}
          />
        ))}
      </MapContainer>

      {/* Top-left controls: radius slider + category filters */}
      <div className="absolute left-0 top-0 z-[1000] flex flex-col gap-2 p-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="rounded-xl bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm">
          <RadiusSlider value={radiusKm} onChange={(km) => { setRadiusKm(km); setHasRecentered(true) }} />
        </div>
        <CategoryFilter pinned={pinnedCategories} selected={categories} onChange={setCategories} />
      </div>

      {/* Pick location banner */}
      {isPickingLocation && (
        <div className="absolute bottom-24 left-1/2 z-[1000] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-900/90 px-4 py-3 text-white shadow-xl backdrop-blur-sm">
            <span className="text-sm font-medium">Kliknij na mapie aby ustawić lokalizację</span>
            <button
              onClick={handleCancelPick}
              className="rounded-lg bg-white/20 px-2 py-1 text-xs font-medium transition hover:bg-white/30"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Bottom-left: category picker */}
      {!isPickingLocation && (
        <div className="absolute bottom-6 left-4 z-[1000]">
          <CategoryPicker
            pinned={pinnedCategories}
            onChange={(next) => {
              onPinnedChange(next)
              setCategories((prev) => prev.filter((c) => next.includes(c)))
            }}
          />
        </div>
      )}

      {/* FAB */}
      {!isPickingLocation && (
        <button
          onClick={handleFabClick}
          className="absolute bottom-6 right-4 z-[1000] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 active:scale-95"
          aria-label="Dodaj aktywność"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  )
}
