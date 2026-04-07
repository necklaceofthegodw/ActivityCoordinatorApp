import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { ActivityCategory } from '@/lib/database.types'
import type { MyActivitiesResult } from './useMyActivities'

export interface CreateActivityInput {
  title: string
  description: string
  category: ActivityCategory
  location_name: string
  lat: number
  lng: number
  scheduled_at: string
  max_participants: number
}

export function useCreateActivity() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: CreateActivityInput) => {
      if (!user) throw new Error('Musisz być zalogowany')

      const { error } = await supabase.from('activities').insert({
        organizer_id: user.id,
        title: input.title,
        description: input.description || null,
        category: input.category,
        location: `POINT(${input.lng} ${input.lat})`,
        location_name: input.location_name || null,
        scheduled_at: input.scheduled_at,
        max_participants: input.max_participants,
      })

      if (error) throw error
    },
    onMutate: async ({ title, category, scheduled_at }) => {
      if (!user) return

      await queryClient.cancelQueries({ queryKey: ['my-activities', user.id] })

      const previous = queryClient.getQueryData<MyActivitiesResult>(['my-activities', user.id])

      const tempId = `temp-${Date.now()}`

      queryClient.setQueryData<MyActivitiesResult>(['my-activities', user.id], (old) => {
        const optimistic = { id: tempId, title, category, scheduled_at, role: 'organizer' as const }
        if (!old) return { activities: [optimistic], isAtLimit: true }
        const activities = [...old.activities, optimistic].slice(0, 3)
        return { activities, isAtLimit: activities.length >= 3 }
      })

      return { previous }
    },
    onError: (err: Error, _input, context) => {
      if (context?.previous && user) {
        queryClient.setQueryData(['my-activities', user.id], context.previous)
      }
      toast.error(err.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['my-activities'] })
      toast.success('Aktywność została dodana na mapę!')
    },
  })
}
