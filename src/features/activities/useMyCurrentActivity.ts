import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ActivityCategory } from '@/lib/database.types'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000

export interface CurrentActivity {
  id: string
  title: string
  category: ActivityCategory
  scheduled_at: string
  role: 'organizer' | 'participant'
}

export function useMyCurrentActivity(userId: string | null) {
  return useQuery({
    queryKey: ['my-current-activity', userId],
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<CurrentActivity | null> => {
      const cutoff = new Date(Date.now() - TWO_HOURS_MS).toISOString()

      // Check if user is organizing an active activity within 2-hour window
      const { data: organized } = await supabase
        .from('activities')
        .select('id, title, category, scheduled_at')
        .eq('organizer_id', userId!)
        .in('status', ['open', 'full', 'active'])
        .gt('scheduled_at', cutoff)
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (organized) {
        return { ...organized, category: organized.category as ActivityCategory, role: 'organizer' }
      }

      // Check participations
      const { data: participations } = await supabase
        .from('participants')
        .select('activity_id')
        .eq('user_id', userId!)

      if (!participations?.length) return null

      const activityIds = participations.map((p) => p.activity_id)

      const { data: joined } = await supabase
        .from('activities')
        .select('id, title, category, scheduled_at')
        .in('id', activityIds)
        .in('status', ['open', 'full', 'active'])
        .gt('scheduled_at', cutoff)
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!joined) return null
      return { ...joined, category: joined.category as ActivityCategory, role: 'participant' }
    },
  })
}
