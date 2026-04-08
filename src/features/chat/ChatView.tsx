import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useChat } from './useChat'
import { useAuth } from '@/features/auth/AuthProvider'
import { FlappyBird } from '@/features/game/FlappyBird'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { useBackButton } from '@/hooks/useBackButton'
import { useLeaveActivity } from '@/features/activities/useLeaveActivity'
import { useDeleteActivity } from '@/features/activities/useDeleteActivity'
import { useUpdateActivityDescription } from '@/features/activities/useUpdateActivityDescription'
import { CATEGORY_MAP } from '@/lib/categories'
import type { Database } from '@/lib/database.types'

type Tab = 'chat' | 'game' | 'settings'
type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]

interface Props {
  activity: Activity
  onClose: () => void
}

export function ChatView({ activity, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { messages, isLoading, sendMessage, senderProfiles, isActivityDeleted } = useChat(activity.id)
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [isSending, setIsSending] = useState(false)
  const [viewingProfile, setViewingProfile] = useState<string | null>(null)
  const [desc, setDesc] = useState(activity.description ?? '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const leaveActivity = useLeaveActivity()
  const deleteActivity = useDeleteActivity()
  const updateDesc = useUpdateActivityDescription()

  const isHost = activity.organizer_id === user?.id

  useBackButton(true, onClose)

  useEffect(() => {
    if (!isActivityDeleted) return
    queryClient.invalidateQueries({ queryKey: ['my-activities'] })
    if (isHost) onClose()
  }, [isActivityDeleted])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    setShowDeleteConfirm(false)
    setShowLeaveConfirm(false)
  }

  async function handleSend() {
    const content = input.trim()
    if (!content || isSending) return

    setInput('')
    setIsSending(true)
    try {
      await sendMessage(content)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Nieznany błąd'
      toast.error(message)
      setInput(content)
    } finally {
      setIsSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const cat = CATEGORY_MAP[activity.category]
  const scheduledAt = activity.scheduled_at ? new Date(activity.scheduled_at) : null

  return (
    <>
      <div className="absolute inset-0 z-[1002] flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 0.75rem)' }}>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{activity.title}</p>
          </div>
          <button
            onClick={() => user && setViewingProfile(user.id)}
            className="shrink-0 text-xs text-gray-400 hover:text-blue-600"
          >
            Mój profil
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => handleTabChange('chat')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === 'chat' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            💬 Czat
          </button>
          <button
            onClick={() => handleTabChange('game')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === 'game' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'
            }`}
          >
            🐦 Flappy Bird
          </button>
          <button
            onClick={() => handleTabChange('settings')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === 'settings'
                ? isHost ? 'border-b-2 border-blue-600 text-blue-600' : 'border-b-2 border-red-500 text-red-500'
                : 'text-gray-500'
            }`}
          >
            {isHost ? '⚙️ Ustawienia' : '🚪 Opuść'}
          </button>
        </div>

        {/* Game tab */}
        {activeTab === 'game' && (
          <div className="flex-1 overflow-hidden">
            <FlappyBird />
          </div>
        )}

        {/* Settings tab — copy link (private activities, all members) */}
        {activeTab === 'settings' && activity.is_private && (
          <div className="border-b border-gray-100 p-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/activity/${activity.id}`)
                toast.success('Link skopiowany do schowka')
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              🔗 Skopiuj link zaproszenia
            </button>
          </div>
        )}

        {/* Settings tab — host */}
        {activeTab === 'settings' && isHost && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Opis aktywności</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                maxLength={400}
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Dodaj opis dla uczestników..."
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-gray-400">{desc.length}/400</span>
                <button
                  onClick={() => updateDesc.mutate({ activityId: activity.id, description: desc })}
                  disabled={updateDesc.isPending}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {updateDesc.isPending ? 'Zapisywanie...' : 'Zapisz'}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-500">Strefa niebezpieczna</p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  Usuń aktywność
                </button>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <p className="text-sm text-gray-800">Czy na pewno chcesz usunąć aktywność? Tej operacji nie można cofnąć.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteActivity.mutate(activity.id, { onSuccess: onClose })}
                      disabled={deleteActivity.isPending}
                      className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {deleteActivity.isPending ? 'Usuwanie...' : 'Tak, usuń'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leave tab — participant */}
        {activeTab === 'settings' && !isHost && (
          <div className="flex-1 p-4">
            {!showLeaveConfirm ? (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full rounded-xl border border-red-200 py-3.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                🚪 Opuść aktywność
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm text-gray-800">Czy na pewno chcesz opuścić aktywność?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => leaveActivity.mutate(activity.id, { onSuccess: onClose })}
                    disabled={leaveActivity.isPending}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {leaveActivity.isPending ? '...' : 'Tak, opuść'}
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat tab */}
        {activeTab === 'chat' && (
          <>
            {/* Activity info card */}
            <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
              <span className="text-2xl leading-none">{cat?.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-700">{cat?.label}</p>
                {scheduledAt && (
                  <p className="text-xs text-gray-500">
                    {scheduledAt.toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-gray-500">
                👥 {activity.current_participants}/{activity.max_participants}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              )}

              {!isLoading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="mb-2 text-3xl">💬</span>
                  <p className="text-sm text-gray-400">Bądź pierwszy i napisz coś!</p>
                </div>
              )}

              {messages.map((msg) => {
                const isOwn = msg.user_id === user?.id
                const sender = senderProfiles.get(msg.user_id)
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isOwn && (
                      <button onClick={() => setViewingProfile(msg.user_id)} className="mb-1 shrink-0">
                        {sender?.avatar_url ? (
                          <img src={sender.avatar_url} alt={sender.nickname} className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                            {sender?.nickname?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                      </button>
                    )}
                    <div className="max-w-[70%]">
                      {!isOwn && sender && (
                        <button
                          onClick={() => setViewingProfile(msg.user_id)}
                          className="mb-0.5 block text-[11px] font-medium text-gray-500 hover:text-blue-600"
                        >
                          {sender.nickname}
                        </button>
                      )}
                      <div className={`rounded-2xl px-3 py-2 text-sm ${isOwn ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'}`}>
                        <p className="break-words">{msg.content}</p>
                        <p className={`mt-0.5 text-right text-[10px] ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 px-3 pt-3" style={{ paddingBottom: '1rem' }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Napisz wiadomość..."
                  className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
                >
                  <svg className="h-4 w-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isActivityDeleted && !isHost && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
          <span className="text-5xl">🚫</span>
          <p className="text-base font-semibold text-gray-900">Aktywność została anulowana</p>
          <p className="text-sm text-gray-500">Organizator usunął tę aktywność.</p>
          <button
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white"
          >
            Wróć
          </button>
        </div>
      )}

      {viewingProfile && (
        <ProfilePage
          userId={viewingProfile}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </>
  )
}
