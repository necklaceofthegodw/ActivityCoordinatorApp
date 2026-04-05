import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export function useParticipantStatus(activityId: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['participant-status', activityId, user?.id],
    enabled: !!activityId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('participants')
        .select('id')
        .eq('activity_id', activityId!)
        .eq('user_id', user!.id)
        .maybeSingle()

      return !!data
    },
  })
}
