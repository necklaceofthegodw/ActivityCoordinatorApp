import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { ActivityCategory } from '@/lib/database.types'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

interface UseActivitiesParams {
  lat: number
  lng: number
  radiusKm: number
  categories: ActivityCategory[]
}

export function useActivities({ lat, lng, radiusKm, categories }: UseActivitiesParams) {
  const { user } = useAuth()

  // Fetch the set of activity IDs the user has joined as a participant
  const { data: joinedIds } = useQuery({
    queryKey: ['my-joined-ids', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('participants')
        .select('activity_id')
        .eq('user_id', user!.id)
      return new Set((data ?? []).map((p) => p.activity_id))
    },
  })

  return useQuery({
    queryKey: ['activities', lat, lng, radiusKm, categories],
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_nearby_activities', {
        lat,
        lng,
        radius_meters: radiusKm * 1000,
        category_filter: categories.length > 0 ? categories : null,
      })
      if (error) throw error
      return data ?? []
    },
    select: (data) => {
      const now = Date.now()
      return data.filter((activity) => {
        const start = new Date(activity.scheduled_at).getTime()

        // Not started yet — visible to everyone
        if (start > now) return true

        // More than 2 hours past start — hidden from everyone
        if (now > start + TWO_HOURS_MS) return false

        // Within 2-hour window after start — only visible to organizer or participants
        const isMember =
          activity.organizer_id === user?.id ||
          joinedIds?.has(activity.id)

        return isMember ?? false
      })
    },
  })
}
