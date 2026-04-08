import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { ActivityCategory } from '@/lib/database.types'
import type { MyActivitiesResult, UserActivity } from './useMyActivities'

export interface JoinActivityInput {
  activityId: string
  title: string
  category: ActivityCategory
  scheduled_at: string
}

export function useJoinActivity() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ activityId }: JoinActivityInput) => {
      if (!user) throw new Error('Musisz być zalogowany')

      const { error } = await supabase.rpc('join_activity', {
        p_activity_id: activityId,
      })

      if (error) throw error
    },
    onMutate: async ({ activityId, title, category, scheduled_at }) => {
      if (!user) return

      await queryClient.cancelQueries({ queryKey: ['my-activities', user.id] })

      const previous = queryClient.getQueryData<MyActivitiesResult>(['my-activities', user.id])

      const optimistic: UserActivity = { id: activityId, title, category, scheduled_at, role: 'participant', organizer_id: '', is_private: false }

      queryClient.setQueryData<MyActivitiesResult>(['my-activities', user.id], (old) => {
        if (!old) return { activities: [optimistic], isAtLimit: true }
        if (old.activities.some((a) => a.id === activityId)) return old
        const activities = [...old.activities, optimistic].slice(0, 3)
        return { activities, isAtLimit: activities.length >= 3 }
      })

      return { previous }
    },
    onError: (err: unknown, _input, context) => {
      if (context?.previous && user) {
        queryClient.setQueryData(['my-activities', user.id], context.previous)
      }
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Nie udało się dołączyć'
      if (msg.includes('unique') || msg.includes('już jesteś')) {
        toast.error('Już jesteś zapisany na tę aktywność')
      } else {
        toast.error(msg)
      }
    },
    onSuccess: (_data, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['participant-status', activityId] })
      queryClient.invalidateQueries({ queryKey: ['my-current-activity'] })
      queryClient.invalidateQueries({ queryKey: ['my-activities'] })
      queryClient.invalidateQueries({ queryKey: ['my-joined-ids'] })
      toast.success('Dołączyłeś do aktywności!')
    },
  })
}
