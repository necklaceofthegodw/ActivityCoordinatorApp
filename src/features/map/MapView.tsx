import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet'
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
  other:       '#6b7280',
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

const ACTIVITY_ICONS = Object.fromEntries(
  (Object.keys(CATEGORY_COLORS) as ActivityCategory[]).map((category) => [
    category,
    L.divIcon({
      className: '',
      html: `<div style="background:${CATEGORY_COLORS[category]};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white;">${CATEGORY_MAP[category].emoji}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
  ])
) as Record<ActivityCategory, L.DivIcon>

type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]
type LatLng = { lat: number; lng: number }

function RecenterOnLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  map.setView([lat, lng], map.getZoom(), { animate: true })
  return null
}

// Centers the pin in the top 1/3 of the screen (visible area above the sheet)
function RecenterOnPin({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    const zoom = map.getZoom()
    const mapH = map.getSize().y
    const pinPx = map.project([lat, lng], zoom)
    const centerPx = L.point(pinPx.x, pinPx.y + mapH / 4)
    map.setView(map.unproject(centerPx, zoom), zoom, { animate: true })
  }, [lat, lng])
  return null
}

function MapClickHandler({
  isPickingLocation,
  onPick,
  onMoved,
}: {
  isPickingLocation: boolean
  onPick: (latlng: LatLng) => void
  onMoved: () => void
}) {
  const map = useMapEvents({
    click(e) {
      if (isPickingLocation) {
        onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
    dragstart() {
      onMoved()
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

function ActivityMarkerInner({ activity, onSelect }: ActivityMarkerProps) {
  const eventHandlers = useMemo(
    () => ({ click: () => onSelect(activity) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity.id, onSelect],
  )
  return (
    <Marker
      position={[activity.lat, activity.lng]}
      icon={ACTIVITY_ICONS[activity.category]}
      eventHandlers={eventHandlers}
    />
  )
}

const ActivityMarker = React.memo(ActivityMarkerInner, (prev, next) =>
  prev.activity.id === next.activity.id &&
  prev.activity.lat === next.activity.lat &&
  prev.activity.lng === next.activity.lng &&
  prev.activity.current_participants === next.activity.current_participants &&
  prev.activity.title === next.activity.title &&
  prev.onSelect === next.onSelect,
)

interface Props {
  onActivitySelect: (activity: Activity) => void
  onCreateActivity: (latlng: LatLng) => void
  pinnedCategories: ActivityCategory[]
  onPinnedChange: (pinned: ActivityCategory[]) => void
  focusLocation?: LatLng | null
  focusTrigger?: number
}

export function MapView({ onActivitySelect, onCreateActivity, pinnedCategories, onPinnedChange, focusLocation, focusTrigger }: Props) {
  const { t } = useTranslation()
  const { location, isLoading } = useUserLocation()
  const [radiusKm, setRadiusKm] = useState(12)
  const [categories, setCategories] = useState<ActivityCategory[]>([])
  const [hasRecentered, setHasRecentered] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
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

        {focusLocation && (
          <RecenterOnPin key={focusTrigger} lat={focusLocation.lat} lng={focusLocation.lng} />
        )}

        <MapClickHandler
          isPickingLocation={isPickingLocation}
          onPick={handleMapPick}
          onMoved={() => setHasRecentered(true)}
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

      {/* Category icons — top-left corner */}
      {!isPickerOpen && (
        <div className="absolute left-0 top-0 z-[1000] p-3" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 0.75rem)' }}>
          <CategoryFilter pinned={pinnedCategories} selected={categories} onChange={setCategories} />
        </div>
      )}

      {/* Radius slider — centered between category icons and profile button */}
      {!isPickerOpen && (
        <div className="absolute left-1/2 top-0 z-[1000] -translate-x-1/2" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 1rem)' }}>
          <div className="w-[187px] rounded-xl bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <RadiusSlider value={radiusKm} onChange={(km) => { setRadiusKm(km); setHasRecentered(true) }} />
          </div>
        </div>
      )}

      {/* Pick location banner */}
      {isPickingLocation && (
        <div className="absolute bottom-24 left-1/2 z-[1000] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-900/90 px-4 py-3 text-white shadow-xl backdrop-blur-sm">
            <span className="text-sm font-medium">{t('map.pickLocation')}</span>
            <button
              onClick={handleCancelPick}
              className="rounded-lg bg-white/20 px-2 py-1 text-xs font-medium transition hover:bg-white/30"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Bottom-left: category picker — always rendered so the fullscreen overlay can show */}
      {!isPickingLocation && (
        <div className="absolute left-4 z-[1000]" style={{ bottom: '1.5rem' }}>
          <CategoryPicker
            pinned={pinnedCategories}
            isOpen={isPickerOpen}
            onOpenChange={setIsPickerOpen}
            onChange={(next) => {
              onPinnedChange(next)
              setCategories((prev) => prev.filter((c) => next.includes(c)))
            }}
          />
        </div>
      )}

      {/* FAB — hidden while picker is open */}
      {!isPickingLocation && !isPickerOpen && (
        <button
          onClick={handleFabClick}
          className="absolute right-4 z-[1000] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 active:scale-95"
          style={{ bottom: '1.5rem' }}
          aria-label={t('activity.new')}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  )
}
