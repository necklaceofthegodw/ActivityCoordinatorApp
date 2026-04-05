import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single()

      if (error) throw error
      return data
    },
  })
}

export function useActivityHistory(userId: string | null) {
  return useQuery({
    queryKey: ['activity-history', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_activity_history', {
        p_user_id: userId!,
      })
      if (error) throw error
      return data ?? []
    },
  })
}
