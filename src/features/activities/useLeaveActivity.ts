import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { MyActivitiesResult } from './useMyActivities'

export function useLeaveActivity() {
  const { t } = useTranslation()
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
    onMutate: async (activityId) => {
      if (!user) return

      await queryClient.cancelQueries({ queryKey: ['my-activities', user.id] })

      const previous = queryClient.getQueryData<MyActivitiesResult>(['my-activities', user.id])

      queryClient.setQueryData<MyActivitiesResult>(['my-activities', user.id], (old) => {
        if (!old) return old
        const activities = old.activities.filter((a) => a.id !== activityId)
        return { activities, isAtLimit: activities.length >= 3 }
      })

      return { previous }
    },
    onError: (err: Error, _activityId, context) => {
      if (context?.previous && user) {
        queryClient.setQueryData(['my-activities', user.id], context.previous)
      }
      toast.error(err.message)
    },
    onSuccess: (_data, activityId) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['participant-status', activityId] })
      queryClient.invalidateQueries({ queryKey: ['my-current-activity'] })
      queryClient.invalidateQueries({ queryKey: ['my-activities'] })
      queryClient.invalidateQueries({ queryKey: ['my-joined-ids'] })
      toast.success(t('activity.left'))
    },
  })
}
