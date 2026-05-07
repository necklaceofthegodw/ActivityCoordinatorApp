import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useParticipants } from '@/features/activities/useParticipants'
import { useActivityById } from '@/features/activities/useActivityById'
import { useProfile } from '@/features/profile/useProfile'
import { CATEGORY_MAP } from '@/lib/categories'
import type { Database } from '@/lib/database.types'

type Tab = 'chat' | 'game' | 'settings'
type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]

interface Props {
  activity: Activity
  onClose: () => void
}

export function ChatView({ activity, onClose }: Props) {
  const { t, i18n } = useTranslation()
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
  const { data: participants = [] } = useParticipants(activity.id)
  const { data: fullActivity } = useActivityById(activity.id)
  const { data: organizerProfile } = useProfile(activity.organizer_id)
  const act = fullActivity ?? activity

  const isHost = activity.organizer_id === user?.id
  const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'

  useBackButton(true, onClose)

  useEffect(() => {
    if (fullActivity?.description !== undefined) setDesc(fullActivity.description ?? '')
  }, [fullActivity?.description])

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
            : t('chat.unknownError')
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

  const cat = CATEGORY_MAP[act.category]
  const scheduledAt = act.scheduled_at ? new Date(act.scheduled_at) : null

  return (
    <>
      <div className="absolute inset-0 z-[1002] flex flex-col bg-white text-fresh-plum">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-fresh-border bg-fresh-surface px-4 py-3" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 0.75rem)' }}>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-fresh-soft"
          >
            <svg className="h-5 w-5 text-fresh-plum" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fresh-plum">{activity.title}</p>
            {scheduledAt && (
              <p className="text-xs text-fresh-muted">
                {scheduledAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <button
            onClick={() => user && setViewingProfile(user.id)}
            className="shrink-0 text-xs text-fresh-muted hover:text-fresh-indigo"
          >
            {t('profile.myProfile')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-fresh-border">
          <button
            onClick={() => handleTabChange('chat')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === 'chat' ? 'border-b-2 border-fresh-garden text-fresh-indigo' : 'text-fresh-muted'
            }`}
          >
            💬 {t('chat.tab')}
          </button>
          <button
            onClick={() => handleTabChange('game')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === 'game' ? 'border-b-2 border-fresh-garden text-fresh-indigo' : 'text-fresh-muted'
            }`}
          >
            🐦 Flappy Bird
          </button>
          <button
            onClick={() => handleTabChange('settings')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              activeTab === 'settings' ? 'border-b-2 border-fresh-garden text-fresh-indigo' : 'text-fresh-muted'
            }`}
          >
            ⚙️ {t('chat.settings')}
          </button>
        </div>

        {/* Game tab */}
        {activeTab === 'game' && (
          <div className="flex-1 overflow-hidden">
            <FlappyBird />
          </div>
        )}

        {/* Settings tab — participants list */}
        {activeTab === 'settings' && (
          <div className="border-b border-fresh-border p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-fresh-muted">
              {t('chat.participants')} ({act.current_participants}/{act.max_participants})
            </p>
            <div className="space-y-2">
              {/* Organizer */}
              <button
                onClick={() => setViewingProfile(act.organizer_id)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-fresh-surface"
              >
                {act.organizer_avatar_url ? (
                  <img src={act.organizer_avatar_url} alt={act.organizer_nickname} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fresh-soft text-sm font-bold text-fresh-indigo">
                    {act.organizer_nickname?.[0]?.toUpperCase() ?? '…'}
                  </div>
                )}
                <span className="flex-1 text-sm font-medium text-fresh-plum">{act.organizer_nickname}</span>
                {organizerProfile?.is_verified && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-fresh-garden text-[10px] font-bold text-white" title={t('verify.verified')}>✓</span>
                )}
                <span className="text-xs font-medium text-fresh-sky">{t('chat.organizer')}</span>
              </button>

              {/* Participants */}
              {participants.map((p) => (
                <button
                  key={p.userId}
                  onClick={() => setViewingProfile(p.userId)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-fresh-surface"
                >
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.nickname} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fresh-soft text-sm font-bold text-fresh-muted">
                      {p.nickname[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <span className="flex-1 text-sm text-fresh-plum">{p.nickname}</span>
                  {p.isVerified && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-fresh-garden text-[10px] font-bold text-white" title={t('verify.verified')}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Settings tab — location link */}
        {activeTab === 'settings' && act.location_name && (
          <div className="border-b border-fresh-border px-4 py-3">
            <a
              href={`https://www.google.com/maps?q=${act.lat},${act.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-fresh-sky hover:underline"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {act.location_name}
            </a>
          </div>
        )}

        {/* Settings tab — copy link (private activities, all members) */}
        {activeTab === 'settings' && act.is_private && (
          <div className="border-b border-fresh-border p-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/activity/${activity.id}`)
                toast.success(t('chat.linkCopied'))
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-fresh-border bg-fresh-soft py-3 text-sm font-medium text-fresh-indigo transition hover:bg-fresh-moss/60"
            >
              🔗 {t('chat.copyLink')}
            </button>
          </div>
        )}

        {/* Settings tab — host */}
        {activeTab === 'settings' && isHost && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fresh-plum">{t('chat.descriptionLabel')}</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={4}
                maxLength={400}
                className="fresh-input w-full resize-none rounded-xl px-3 py-2.5 text-sm"
                placeholder={t('chat.descriptionPlaceholder')}
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-fresh-muted">{desc.length}/400</span>
                <button
                  onClick={() => updateDesc.mutate({ activityId: activity.id, description: desc })}
                  disabled={updateDesc.isPending}
                  className="fresh-primary rounded-lg px-4 py-1.5 text-sm font-medium"
                >
                  {updateDesc.isPending ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>

            <div className="border-t border-fresh-border pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-500">{t('chat.dangerZone')}</p>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  {t('chat.deleteActivity')}
                </button>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                  <p className="text-sm text-fresh-plum">{t('chat.deleteConfirm')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteActivity.mutate(activity.id, { onSuccess: onClose })}
                      disabled={deleteActivity.isPending}
                      className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {deleteActivity.isPending ? t('chat.deleting') : t('chat.confirmDelete')}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="fresh-secondary flex-1 rounded-xl bg-white py-2.5 text-sm font-medium"
                    >
                      {t('common.cancel')}
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
                🚪 {t('chat.leaveActivity')}
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm text-fresh-plum">{t('chat.leaveConfirm')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => leaveActivity.mutate(activity.id, { onSuccess: onClose })}
                    disabled={leaveActivity.isPending}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {leaveActivity.isPending ? '...' : t('chat.confirmLeave')}
                  </button>
                  <button
                    onClick={() => setShowLeaveConfirm(false)}
                    className="fresh-secondary flex-1 rounded-xl bg-white py-2.5 text-sm font-medium"
                  >
                    {t('common.cancel')}
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
            <div className="flex items-center gap-3 border-b border-fresh-border bg-fresh-surface px-4 py-2.5">
              <span className="text-2xl leading-none">{cat?.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-fresh-plum">{t(`category.${act.category}`)}</p>
                {scheduledAt && (
                  <p className="text-xs text-fresh-muted">
                    {scheduledAt.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-fresh-muted">
                👥 {act.current_participants}/{act.max_participants}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-fresh-indigo border-t-transparent" />
                </div>
              )}

              {!isLoading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="mb-2 text-3xl">💬</span>
                  <p className="text-sm text-fresh-muted">{t('chat.emptyChat')}</p>
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
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-fresh-soft text-xs font-bold text-fresh-indigo">
                            {sender?.nickname?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                      </button>
                    )}
                    <div className="max-w-[70%]">
                      {!isOwn && sender && (
                        <button
                          onClick={() => setViewingProfile(msg.user_id)}
                          className="mb-0.5 block text-[11px] font-medium text-fresh-muted hover:text-fresh-indigo"
                        >
                          {sender.nickname}
                        </button>
                      )}
                      <div className={`rounded-2xl px-3 py-2 text-sm ${isOwn ? 'rounded-br-sm bg-fresh-indigo text-white' : 'rounded-bl-sm bg-fresh-surface text-fresh-plum'}`}>
                        <p className="break-words">{msg.content}</p>
                        <p className={`mt-0.5 text-right text-[10px] ${isOwn ? 'text-fresh-moss' : 'text-fresh-muted'}`}>
                          {new Date(msg.created_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-fresh-border px-3 pt-3" style={{ paddingBottom: '1rem' }}>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={t('chat.inputPlaceholder')}
                  className="fresh-input flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fresh-indigo text-white transition hover:bg-fresh-plum disabled:opacity-40"
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
          <p className="text-base font-semibold text-fresh-plum">{t('chat.activityDeleted')}</p>
          <p className="text-sm text-fresh-muted">{t('chat.activityDeletedDesc')}</p>
          <button
            onClick={onClose}
            className="fresh-primary rounded-xl px-6 py-3 text-sm font-medium"
          >
            {t('common.back')}
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
