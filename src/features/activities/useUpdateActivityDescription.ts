import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export function useUpdateActivityDescription() {
  const { t } = useTranslation()
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
      toast.success(t('activity.descriptionUpdated'))
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
