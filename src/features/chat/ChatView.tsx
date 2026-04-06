import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useChat } from './useChat'
import { useAuth } from '@/features/auth/AuthProvider'
import { FlappyBird } from '@/features/game/FlappyBird'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { useBackButton } from '@/hooks/useBackButton'

type Tab = 'chat' | 'game'

interface Props {
  activityId: string
  activityTitle: string
  onClose: () => void
}

export function ChatView({ activityId, activityTitle, onClose }: Props) {
  const { user } = useAuth()
  const { messages, isLoading, sendMessage, senderProfiles } = useChat(activityId)
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [isSending, setIsSending] = useState(false)
  const [viewingProfile, setViewingProfile] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useBackButton(true, onClose)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  return (
    <>
    <div className="absolute inset-0 z-[1002] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-gray-100"
        >
          <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{activityTitle}</p>
        </div>
        <button
          onClick={() => user && setViewingProfile(user.id)}
          className="shrink-0 text-xs text-gray-400 hover:text-blue-600"
        >
          Mój profil
        </button>

        <button
          onClick={() => setActiveTab(activeTab === 'game' ? 'chat' : 'game')}
          className={`shrink-0 text-lg transition ${activeTab === 'game' ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
          aria-label="Flappy Bird"
        >
          🐦
        </button>
      </div>

      {/* Game tab */}
      {activeTab === 'game' && (
        <div className="flex-1 overflow-hidden">
          <FlappyBird />
        </div>
      )}

      {/* Chat tab */}
      {activeTab === 'chat' && (
        <>
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
                  {/* Avatar */}
                  {!isOwn && (
                    <button
                      onClick={() => setViewingProfile(msg.user_id)}
                      className="mb-1 shrink-0"
                    >
                      {sender?.avatar_url ? (
                        <img src={sender.avatar_url} alt={sender.nickname} className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                          {sender?.nickname?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                    </button>
                  )}
                  <div className={`max-w-[70%] ${!isOwn ? '' : ''}`}>
                    {!isOwn && sender && (
                      <button
                        onClick={() => setViewingProfile(msg.user_id)}
                        className="mb-0.5 block text-[11px] font-medium text-gray-500 hover:text-blue-600"
                      >
                        {sender.nickname}
                      </button>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        isOwn
                          ? 'rounded-br-sm bg-blue-600 text-white'
                          : 'rounded-bl-sm bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="break-words">{msg.content}</p>
                      <p className={`mt-0.5 text-right text-[10px] ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('pl-PL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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

    {viewingProfile && (
      <ProfilePage
        userId={viewingProfile}
        onClose={() => setViewingProfile(null)}
      />
    )}
    </>
  )
}
