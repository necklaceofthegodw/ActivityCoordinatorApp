import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]

export function useActivityById(activityId: string | null) {
  return useQuery({
    queryKey: ['activity', activityId],
    enabled: !!activityId,
    staleTime: 30_000,
    queryFn: async (): Promise<Activity | null> => {
      const { data, error } = await supabase.rpc('get_activity_by_id', { p_activity_id: activityId! })
      if (error) throw error
      return data?.[0] ?? null
    },
  })
}
