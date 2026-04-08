import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import LoginPage from '@/features/auth/LoginPage'
import ProfileSetupPage from '@/features/auth/ProfileSetupPage'
import { MapView } from '@/features/map/MapView'
import { ActivitySheet } from '@/features/activities/ActivitySheet'
import { CreateActivitySheet } from '@/features/activities/CreateActivitySheet'
import { ChatView } from '@/features/chat/ChatView'
import { ProfilePage } from '@/features/profile/ProfilePage'
import type { ActivityCategory, Database } from '@/lib/database.types'
import { useMyActivities } from '@/features/activities/useMyActivities'
import { useActivityById } from '@/features/activities/useActivityById'
import { CATEGORY_MAP } from '@/lib/categories'

type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]

// Saves the activity ID from /activity/:id links and redirects appropriately
function ActivityLinkRoute() {
  const { id } = useParams<{ id: string }>()
  const { session, profile } = useAuth()

  if (id) sessionStorage.setItem('pendingActivityId', id)

  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/setup" replace />
  return <Navigate to="/" replace />
}

function MapPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [createLocation, setCreateLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [pinnedCategories, setPinnedCategories] = useState<ActivityCategory[]>(['walk', 'coffee', 'squash', 'running', 'language'])
  const { data: myActivitiesResult } = useMyActivities(user?.id ?? null)
  const myActivities = myActivitiesResult?.activities ?? []
  const isAtLimit = myActivitiesResult?.isAtLimit ?? false
  const [chatActivity, setChatActivity] = useState<Activity | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(() => {
    const id = sessionStorage.getItem('pendingActivityId')
    if (id) sessionStorage.removeItem('pendingActivityId')
    return id
  })
  const [pendingFocusLocation, setPendingFocusLocation] = useState<{ lat: number; lng: number } | null>(null)

  const { data: pendingActivity } = useActivityById(pendingActivityId)

  useEffect(() => {
    if (!pendingActivity) return
    setSelectedActivity(pendingActivity)
    setPendingFocusLocation({ lat: pendingActivity.lat, lng: pendingActivity.lng })
    setPendingActivityId(null)
    queryClient.invalidateQueries({ queryKey: ['my-activities'] })
  }, [pendingActivity])

  // Clear focus after one render so user can pan freely
  useEffect(() => {
    if (!pendingFocusLocation) return
    const t = setTimeout(() => setPendingFocusLocation(null), 100)
    return () => clearTimeout(t)
  }, [pendingFocusLocation])

  function handleChatOpen(activityId: string) {
    if (selectedActivity?.id === activityId) {
      setChatActivity(selectedActivity)
    }
    setSelectedActivity(null)
  }

  return (
    <div className="relative w-screen" style={{ height: 'var(--app-height, 100svh)' }}>
      <MapView
        onActivitySelect={setSelectedActivity}
        onCreateActivity={setCreateLocation}
        pinnedCategories={pinnedCategories}
        onPinnedChange={setPinnedCategories}
        focusLocation={createLocation ?? pendingFocusLocation}
      />

      <ActivitySheet
        activity={selectedActivity}
        onClose={() => { setSelectedActivity(null); setPendingFocusLocation(null) }}
        onChatOpen={handleChatOpen}
        isAtLimit={isAtLimit}
      />

      {createLocation && (
        <CreateActivitySheet
          lat={createLocation.lat}
          lng={createLocation.lng}
          pinnedCategories={pinnedCategories}
          onClose={() => setCreateLocation(null)}
          isAtLimit={isAtLimit}
        />
      )}

      {/* Przycisk profilu na mapie */}
      <div className="absolute right-4 top-0 z-[1000] flex flex-col items-end gap-2" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 1rem)' }}>
        <button
          onClick={() => setShowProfile(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-gray-50"
          aria-label="Mój profil"
        >
          <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>

        {myActivities.map((activity) => (
          <button
            key={activity.id}
            onClick={() => setChatActivity({ id: activity.id, title: activity.title, category: activity.category, organizer_id: activity.organizer_id, is_private: activity.is_private } as Activity)}
            className="flex items-center gap-2 rounded-full bg-white py-2 pl-2.5 pr-3 shadow-md transition hover:bg-gray-50 active:scale-95"
          >
            <span className="text-base leading-none">{activity.is_private ? '🔒' : CATEGORY_MAP[activity.category].emoji}</span>
            <span className="max-w-[120px] truncate text-xs font-medium text-gray-800">{activity.title}</span>
          </button>
        ))}
      </div>

      {chatActivity && (
        <ChatView
          activity={chatActivity}
          onClose={() => setChatActivity(null)}
        />
      )}

      {showProfile && user && (
        <ProfilePage
          userId={user.id}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  )
}

function AppRoutes() {
  const { session, profile, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activity/:id" element={<ActivityLinkRoute />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/setup" element={<ProfileSetupPage />} />
        <Route path="/activity/:id" element={<ActivityLinkRoute />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      <Route path="/activity/:id" element={<ActivityLinkRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    function update() {
      const vv = window.visualViewport
      const height = vv ? vv.height : window.innerHeight
      const topInset = vv ? vv.offsetTop : 0
      document.documentElement.style.setProperty('--app-height', `${height}px`)
      document.documentElement.style.setProperty('--top-inset', `${topInset}px`)
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
