import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export function useLeaveActivity() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error('Musisz być zalogowany')

      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: (_data, activityId) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['participant-status', activityId] })
      toast.success('Opuściłeś aktywność')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
