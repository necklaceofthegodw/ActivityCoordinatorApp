import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export function useJoinActivity() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error('Musisz być zalogowany')

      const { error } = await supabase.rpc('join_activity', {
        p_activity_id: activityId,
      })

      if (error) throw error
    },
    onSuccess: (_data, activityId) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['participant-status', activityId] })
      toast.success('Dołączyłeś do aktywności!')
    },
    onError: (err: unknown) => {
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Nie udało się dołączyć'
      if (msg.includes('unique') || msg.includes('już jesteś')) {
        toast.error('Już jesteś zapisany na tę aktywność')
      } else {
        toast.error(msg)
      }
    },
  })
}
