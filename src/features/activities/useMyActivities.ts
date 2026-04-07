import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ActivityCategory } from '@/lib/database.types'

const TWO_HOURS_MS = 2 * 60 * 60 * 1000
const MAX_ACTIVITIES = 3

export interface UserActivity {
  id: string
  title: string
  category: ActivityCategory
  scheduled_at: string
  role: 'organizer' | 'participant'
  organizer_id: string
}

export interface MyActivitiesResult {
  activities: UserActivity[]
  isAtLimit: boolean
}

export function useMyActivities(userId: string | null) {
  return useQuery({
    queryKey: ['my-activities', userId],
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<MyActivitiesResult> => {
      const cutoff = new Date(Date.now() - TWO_HOURS_MS).toISOString()

      // Delete all expired activities (older than 2h)
      await supabase
        .from('activities')
        .delete()
        .lte('scheduled_at', cutoff)

      // Fetch organized activities
      const { data: organized } = await supabase
        .from('activities')
        .select('id, title, category, scheduled_at')
        .eq('organizer_id', userId!)
        .in('status', ['open', 'full', 'active'])
        .gt('scheduled_at', cutoff)
        .order('scheduled_at', { ascending: true })

      const organizedActivities: UserActivity[] = (organized ?? []).map((a) => ({
        ...a,
        category: a.category as ActivityCategory,
        role: 'organizer' as const,
        organizer_id: userId!,
      }))

      // Fetch participations
      const { data: participations } = await supabase
        .from('participants')
        .select('activity_id')
        .eq('user_id', userId!)

      let joinedActivities: UserActivity[] = []

      if (participations?.length) {
        const organizedIds = new Set(organizedActivities.map((a) => a.id))
        const joinedOnlyIds = participations
          .map((p) => p.activity_id)
          .filter((id) => !organizedIds.has(id))

        if (joinedOnlyIds.length > 0) {
          const { data: joined } = await supabase
            .from('activities')
            .select('id, title, category, scheduled_at, organizer_id')
            .in('id', joinedOnlyIds)
            .in('status', ['open', 'full', 'active'])
            .gt('scheduled_at', cutoff)
            .order('scheduled_at', { ascending: true })

          joinedActivities = (joined ?? []).map((a) => ({
            ...a,
            category: a.category as ActivityCategory,
            role: 'participant' as const,
          }))
        }
      }

      const all = [...organizedActivities, ...joinedActivities]

      return {
        activities: all.slice(0, MAX_ACTIVITIES),
        isAtLimit: all.length >= MAX_ACTIVITIES,
      }
    },
  })
}
