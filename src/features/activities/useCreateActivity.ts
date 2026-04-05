import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { ActivityCategory } from '@/lib/database.types'

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      toast.success('Aktywność została dodana na mapę!')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
