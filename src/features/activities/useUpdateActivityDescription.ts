import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export function useUpdateActivityDescription() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ activityId, description }: { activityId: string; description: string }) => {
      const { error } = await supabase
        .from('activities')
        .update({ description: description || null })
        .eq('id', activityId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      toast.success('Opis zaktualizowany')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
