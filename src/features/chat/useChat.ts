import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Database } from '@/lib/database.types'

type Message = Database['public']['Tables']['messages']['Row']
type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'nickname' | 'avatar_url'>

export function useChat(activityId: string) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [senderProfiles, setSenderProfiles] = useState<Map<string, Profile>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isActivityDeleted, setIsActivityDeleted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const missing = userIds.filter((id) => !senderProfiles.has(id))
    if (missing.length === 0) return

    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .in('id', missing)

    if (data) {
      setSenderProfiles((prev) => {
        const next = new Map(prev)
        data.forEach((p) => next.set(p.id, p))
        return next
      })
    }
  }, [senderProfiles])

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true })

    const msgs = data ?? []
    setMessages(msgs)
    setIsLoading(false)

    const uniqueUserIds = [...new Set(msgs.map((m) => m.user_id))]
    if (uniqueUserIds.length > 0) await fetchProfiles(uniqueUserIds)
  }, [activityId, fetchProfiles])

  useEffect(() => {
    let ignore = false

    fetchMessages()

    const channel = supabase
      .channel(`chat:${activityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `activity_id=eq.${activityId}`,
        },
        (payload) => {
          if (!ignore) {
            const newMsg = payload.new as Message
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })
            fetchProfiles([newMsg.user_id])
          }
        },
      )
      .subscribe()

    return () => {
      ignore = true
      supabase.removeChannel(channel)
    }
  }, [activityId, fetchMessages, fetchProfiles])

  async function sendMessage(content: string) {
    if (!user) throw new Error('Musisz być zalogowany')

    const { error } = await supabase.from('messages').insert({
      activity_id: activityId,
      user_id: user.id,
      content,
    } satisfies Database['public']['Tables']['messages']['Insert'])

    if (error) throw error

    await fetchMessages()
  }

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('activities')
        .select('id')
        .eq('id', activityId)
        .maybeSingle()

      if (data === null) {
        setIsActivityDeleted(true)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, 5_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [activityId])

  return { messages, isLoading, sendMessage, senderProfiles, isActivityDeleted }
}
