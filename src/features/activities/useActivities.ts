import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ActivityCategory } from '@/lib/database.types'

interface UseActivitiesParams {
  lat: number
  lng: number
  radiusKm: number
  categories: ActivityCategory[]
}

export function useActivities({ lat, lng, radiusKm, categories }: UseActivitiesParams) {
  return useQuery({
    queryKey: ['activities', lat, lng, radiusKm, categories],
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
    refetchInterval: 30_000,
  })
}
