import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export function useDeleteActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['my-current-activity'] })
      queryClient.invalidateQueries({ queryKey: ['my-activities'] })
      toast.success('Aktywność została usunięta')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
