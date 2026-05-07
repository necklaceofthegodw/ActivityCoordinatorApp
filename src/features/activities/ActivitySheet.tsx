import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Database } from '@/lib/database.types'
import { useJoinActivity } from './useJoinActivity'
import { useLeaveActivity } from './useLeaveActivity'
import { useDeleteActivity } from './useDeleteActivity'
import { useParticipantStatus } from './useParticipantStatus'
import { useProfile } from '@/features/profile/useProfile'
import { getTierInfo } from '@/lib/tiers'
import { CATEGORY_MAP } from '@/lib/categories'
import { useBackButton } from '@/hooks/useBackButton'
import { REQUIRE_PROFILE_VERIFICATION } from '@/lib/profileVerification'

type Activity = Database['public']['Functions']['get_nearby_activities']['Returns'][number]

interface Props {
  activity: Activity | null
  onClose: () => void
  onChatOpen: (activityId: string) => void
  onNavigateToVerify: () => void
  isAtLimit: boolean
}

export function ActivitySheet({ activity, onClose, onChatOpen, onNavigateToVerify, isAtLimit }: Props) {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const join = useJoinActivity()
  const leave = useLeaveActivity()
  const deleteActivity = useDeleteActivity()
  const { data: isParticipant } = useParticipantStatus(activity?.id ?? null)
  const { data: organizerProfile } = useProfile(activity?.organizer_id ?? null)

  useBackButton(activity !== null, onClose)

  if (!activity) return null

  const scheduledAt = new Date(activity.scheduled_at)
  const isFull = activity.status === 'full'
  const spotsLeft = activity.max_participants - activity.current_participants
  const isOrganizer = user?.id === activity.organizer_id
  const hasAccess = isOrganizer || isParticipant
  const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-[1001] bg-fresh-plum/25"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[1002] max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-fresh-border bg-white p-5 shadow-xl" style={{ paddingBottom: 'calc(var(--top-inset, 0px) + 1.25rem)' }}>
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-fresh-border" />

        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-fresh-plum">{activity.title}</h2>
          <span className="shrink-0 rounded-full bg-fresh-soft px-2.5 py-1 text-xs font-medium text-fresh-indigo">
            {CATEGORY_MAP[activity.category]?.emoji} {t(`category.${activity.category}`)}
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
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-fresh-soft text-xs font-bold text-fresh-indigo">
              {activity.organizer_nickname[0].toUpperCase()}
            </div>
          )}
          <span className="text-sm text-fresh-muted">{activity.organizer_nickname}</span>
          {organizerProfile?.is_verified && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-fresh-garden text-[10px] font-bold text-white" title={t('verify.verified')}>✓</span>
          )}
          {organizerProfile && (() => {
            const tierInfo = getTierInfo(organizerProfile.tier)
            return (
              <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tierInfo.bg} ${tierInfo.color}`}>
                {tierInfo.emoji} {t(`tier.${organizerProfile.tier}`)}
              </span>
            )
          })()}
        </div>

        {/* Description */}
        {activity.description && (
          <p className="mb-3 text-sm text-fresh-muted">{activity.description}</p>
        )}

        {/* Meta */}
        <div className="mb-4 flex flex-wrap gap-3 text-sm text-fresh-muted">
          <span>
            🕐{' '}
            {scheduledAt.toLocaleString(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span>
            👥 {activity.current_participants}/{activity.max_participants} {t('activity.people')}
            {!isFull && <span className="ml-1 text-fresh-garden">{t('activity.spotsLeft', { count: spotsLeft })}</span>}
            {isFull && <span className="ml-1 text-red-500">{t('activity.full')}</span>}
          </span>
          {activity.location_name && <span>📍 {activity.location_name}</span>}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {hasAccess ? (
              <button
                onClick={() => onChatOpen(activity.id)}
                className="fresh-primary flex-1 rounded-xl py-3 text-sm font-medium"
              >
                💬 {t('activity.openChat')}
              </button>
            ) : REQUIRE_PROFILE_VERIFICATION && profile?.is_verified === false ? (
              <button
                onClick={() => { onClose(); onNavigateToVerify() }}
                className="fresh-primary flex-1 rounded-xl py-3 text-sm font-medium"
              >
                {t('verify.goVerify')}
              </button>
            ) : isFull ? (
              <button
                disabled
                className="flex-1 rounded-xl bg-fresh-surface py-3 text-sm font-medium text-fresh-muted/60"
              >
                {t('activity.noSpots')}
              </button>
            ) : isAtLimit ? (
              <button
                disabled
                className="flex-1 rounded-xl bg-amber-50 py-3 text-sm font-medium text-amber-700 border border-amber-200"
              >
                {t('activity.limitLabel')}
              </button>
            ) : (
              <button
                onClick={() => join.mutate({ activityId: activity.id, title: activity.title, category: activity.category, scheduled_at: activity.scheduled_at })}
                disabled={join.isPending}
                className="fresh-primary flex-1 rounded-xl py-3 text-sm font-medium"
              >
                {join.isPending ? t('activity.joining') : t('activity.join')}
              </button>
            )}
            <button
              onClick={onClose}
              className="fresh-secondary rounded-xl px-4 py-3 text-sm font-medium"
            >
              {t('common.close')}
            </button>
          </div>

          {/* Verification hint */}
          {!hasAccess && REQUIRE_PROFILE_VERIFICATION && profile?.is_verified === false && (
            <p className="text-center text-xs text-fresh-muted/70">{t('verify.notVerifiedJoin')}</p>
          )}

          {/* Leave — participant only (not organizer) */}
          {isParticipant && !isOrganizer && (
            <button
              onClick={() => leave.mutate(activity.id)}
              disabled={leave.isPending}
              className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-60"
            >
              {leave.isPending ? t('activity.leaving') : t('activity.leave')}
            </button>
          )}

          {/* Cancel — organizer only */}
          {isOrganizer && (
            <button
              onClick={() => { deleteActivity.mutate(activity.id); onClose() }}
              disabled={deleteActivity.isPending}
              className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-60"
            >
              {deleteActivity.isPending ? t('activity.cancelling') : t('activity.cancelActivity')}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
