import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Participant {
  userId: string
  nickname: string
  avatarUrl: string | null
  isVerified: boolean
}

export function useParticipants(activityId: string) {
  return useQuery({
    queryKey: ['participants', activityId],
    staleTime: 30_000,
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from('participants')
        .select('user_id, profiles(nickname, avatar_url, is_verified)')
        .eq('activity_id', activityId)

      if (error) throw error

      return (data ?? []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          userId: row.user_id,
          nickname: profile?.nickname ?? 'Użytkownik',
          avatarUrl: profile?.avatar_url ?? null,
          isVerified: profile?.is_verified ?? false,
        }
      })
    },
  })
}
