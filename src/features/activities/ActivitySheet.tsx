import { useAuth } from '@/features/auth/AuthProvider'
import type { Database } from '@/lib/database.types'
import { useJoinActivity } from './useJoinActivity'
import { useLeaveActivity } from './useLeaveActivity'
import { useParticipantStatus } from './useParticipantStatus'
import { useProfile } from '@/features/profile/useProfile'
import { getTierInfo } from '@/lib/tiers'
import { CATEGORY_MAP } from '@/lib/categories'
import { useBackButton } from '@/hooks/useBackButton'

type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]

interface Props {
  activity: Activity | null
  onClose: () => void
  onChatOpen: (activityId: string) => void
}

export function ActivitySheet({ activity, onClose, onChatOpen }: Props) {
  const { user } = useAuth()
  const join = useJoinActivity()
  const leave = useLeaveActivity()
  const { data: isParticipant } = useParticipantStatus(activity?.id ?? null)
  const { data: organizerProfile } = useProfile(activity?.organizer_id ?? null)

  useBackButton(activity !== null, onClose)

  if (!activity) return null

  const scheduledAt = new Date(activity.scheduled_at)
  const isFull = activity.status === 'full'
  const spotsLeft = activity.max_participants - activity.current_participants
  const isOrganizer = user?.id === activity.organizer_id
  const hasAccess = isOrganizer || isParticipant

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-[1001] bg-black/20"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[1002] max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">{activity.title}</h2>
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            {CATEGORY_MAP[activity.category]?.emoji} {CATEGORY_MAP[activity.category]?.label}
          </span>
        </div>

        {/* Organizer */}
        <div className="mb-3 flex items-center gap-2">
          {activity.organizer_avatar_url ? (
            <img
              src={activity.organizer_avatar_url}
              alt={activity.organizer_nickname}
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
              {activity.organizer_nickname[0].toUpperCase()}
            </div>
          )}
          <span className="text-sm text-gray-500">{activity.organizer_nickname}</span>
          {organizerProfile && (() => {
            const tierInfo = getTierInfo(organizerProfile.tier)
            return (
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tierInfo.bg} ${tierInfo.color}`}>
                {tierInfo.emoji} {tierInfo.label}
              </span>
            )
          })()}
        </div>

        {/* Description */}
        {activity.description && (
          <p className="mb-3 text-sm text-gray-600">{activity.description}</p>
        )}

        {/* Meta */}
        <div className="mb-4 flex flex-wrap gap-3 text-sm text-gray-500">
          <span>
            🕐{' '}
            {scheduledAt.toLocaleString('pl-PL', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span>
            👥 {activity.current_participants}/{activity.max_participants} osób
            {!isFull && <span className="ml-1 text-green-600">({spotsLeft} miejsc)</span>}
            {isFull && <span className="ml-1 text-red-500">(pełna)</span>}
          </span>
          {activity.location_name && <span>📍 {activity.location_name}</span>}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {hasAccess ? (
              <button
                onClick={() => onChatOpen(activity.id)}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                💬 Otwórz czat
              </button>
            ) : isFull ? (
              <button
                disabled
                className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-400"
              >
                Brak miejsc
              </button>
            ) : (
              <button
                onClick={() => join.mutate(activity.id)}
                disabled={join.isPending}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {join.isPending ? 'Dołączanie...' : 'Dołącz'}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Zamknij
            </button>
          </div>

          {/* Opuść — tylko dla uczestników (nie organizatora) */}
          {isParticipant && !isOrganizer && (
            <button
              onClick={() => leave.mutate(activity.id)}
              disabled={leave.isPending}
              className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-60"
            >
              {leave.isPending ? 'Opuszczanie...' : 'Opuść aktywność'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
