import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import LoginPage from '@/features/auth/LoginPage'
import ProfileSetupPage from '@/features/auth/ProfileSetupPage'
import { MapView } from '@/features/map/MapView'
import { ActivitySheet } from '@/features/activities/ActivitySheet'
import { CreateActivitySheet } from '@/features/activities/CreateActivitySheet'
import { ChatView } from '@/features/chat/ChatView'
import { ProfilePage } from '@/features/profile/ProfilePage'
import type { ActivityCategory, Database } from '@/lib/database.types'
import { useMyCurrentActivity } from '@/features/activities/useMyCurrentActivity'
import { CATEGORY_MAP } from '@/lib/categories'

type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]

function MapPage() {
  const { user } = useAuth()
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [createLocation, setCreateLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [pinnedCategories, setPinnedCategories] = useState<ActivityCategory[]>(['walk', 'coffee', 'squash', 'running', 'language'])
  const { data: currentActivity } = useMyCurrentActivity(user?.id ?? null)
  const [chatActivity, setChatActivity] = useState<{ id: string; title: string } | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  function handleChatOpen(activityId: string) {
    const activity = selectedActivity?.id === activityId ? selectedActivity : null
    setChatActivity({ id: activityId, title: activity?.title ?? 'Czat' })
    setSelectedActivity(null)
  }

  return (
    <div className="relative h-screen w-screen">
      <MapView
        onActivitySelect={setSelectedActivity}
        onCreateActivity={setCreateLocation}
        pinnedCategories={pinnedCategories}
        onPinnedChange={setPinnedCategories}
      />

      <ActivitySheet
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onChatOpen={handleChatOpen}
      />

      {createLocation && (
        <CreateActivitySheet
          lat={createLocation.lat}
          lng={createLocation.lng}
          pinnedCategories={pinnedCategories}
          onClose={() => setCreateLocation(null)}
        />
      )}

      {/* Przycisk profilu na mapie */}
      <div className="absolute right-4 top-4 z-[1000] flex flex-col items-end gap-2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button
          onClick={() => setShowProfile(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-gray-50"
          aria-label="Mój profil"
        >
          <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>

        {currentActivity && (
          <button
            onClick={() => setChatActivity({ id: currentActivity.id, title: currentActivity.title })}
            className="flex items-center gap-2 rounded-full bg-white py-2 pl-2.5 pr-3 shadow-md transition hover:bg-gray-50 active:scale-95"
          >
            <span className="text-base leading-none">{CATEGORY_MAP[currentActivity.category].emoji}</span>
            <span className="max-w-[120px] truncate text-xs font-medium text-gray-800">{currentActivity.title}</span>
          </button>
        )}
      </div>

      {chatActivity && (
        <ChatView
          activityId={chatActivity.id}
          activityTitle={chatActivity.title}
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/setup" element={<ProfileSetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
