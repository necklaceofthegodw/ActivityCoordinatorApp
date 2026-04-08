import { useRef, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile, useActivityHistory } from './useProfile'
import { ReportUserDialog } from '@/features/reports/ReportUserDialog'
import { getTierInfo, getNextTierPoints, TIERS } from '@/lib/tiers'
import { CATEGORY_MAP } from '@/lib/categories'
import { useBackButton } from '@/hooks/useBackButton'

const editSchema = z.object({
  bio: z.string().max(160, 'Max. 160 znaków').optional(),
})

type EditForm = z.infer<typeof editSchema>

interface Props {
  userId: string
  onClose: () => void
}

export function ProfilePage({ userId, onClose }: Props) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useProfile(userId)
  const { data: history = [] } = useActivityHistory(userId)
  const [isEditing, setIsEditing] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [avatarError, setAvatarError] = useState(false)

  useEffect(() => {
    setAvatarError(false)
  }, [profile?.avatar_url])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { signOut } = useAuth()
  const isOwnProfile = user?.id === userId

  useBackButton(true, onClose)

  const { register, handleSubmit, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: { bio: profile?.bio ?? '' },
  })

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Max. 2MB'); return }

    const ext = file.name.split('.').pop()
    const { error } = await supabase.storage
      .from('avatars')
      .upload(`${user.id}/avatar.${ext}`, file, { upsert: true })

    if (error) { toast.error('Błąd uploadu'); return }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(`${user.id}/avatar.${ext}`)

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    toast.success('Avatar zaktualizowany')
  }

  async function onSave(data: EditForm) {
    if (!user) return
    setIsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ bio: data.bio ?? null })
      .eq('id', user.id)

    setIsSaving(false)
    if (error) { toast.error('Nie udało się zapisać'); return }

    queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    setIsEditing(false)
    toast.success('Profil zapisany')
  }

  if (isLoading || !profile) {
    return (
      <div className="absolute inset-0 z-[1003] flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <div className="absolute inset-0 z-[1003] flex flex-col overflow-y-auto bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="flex-1 text-sm font-semibold text-gray-900">
            {isOwnProfile ? 'Mój profil' : 'Profil użytkownika'}
          </span>
          {isOwnProfile && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Edytuj
            </button>
          )}
          {isOwnProfile && (
            <button
              onClick={signOut}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              Wyloguj
            </button>
          )}
          {!isOwnProfile && (
            <button
              onClick={() => setShowReport(true)}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              Zgłoś
            </button>
          )}
        </div>

        {/* Profile info */}
        <div className="flex flex-col items-center px-4 py-6">
          {/* Avatar */}
          <div className="relative mb-3">
            {profile.avatar_url && !avatarError ? (
              <img
                src={profile.avatar_url}
                alt={profile.nickname}
                className="h-24 w-24 rounded-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-100 text-3xl font-bold text-blue-600">
                {profile.nickname[0].toUpperCase()}
              </div>
            )}
            {isOwnProfile && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.586l-3 .75.75-3a4 4 0 01.586-1.414z" />
                  </svg>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </>
            )}
          </div>

          <h2 className="mb-1 text-xl font-bold text-gray-900">@{profile.nickname}</h2>

          {/* Tier badge */}
          {(() => {
            const tierInfo = getTierInfo(profile.tier)
            const nextPoints = getNextTierPoints(profile.tier)
            const prevMin = TIERS[profile.tier]?.min ?? 0
            const progress = nextPoints
              ? Math.round(((profile.points - prevMin) / (nextPoints - prevMin)) * 100)
              : 100
            return (
              <div className="mb-4 flex w-full max-w-xs flex-col items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${tierInfo.bg} ${tierInfo.color}`}>
                  <span>{tierInfo.emoji}</span>
                  <span>{tierInfo.label}</span>
                </span>
                <p className="text-sm font-medium text-gray-700">{profile.points} pkt</p>
                {nextPoints && (
                  <div className="w-full">
                    <div className="mb-1 flex justify-between text-xs text-gray-400">
                      <span>{profile.points} pkt</span>
                      <span>{nextPoints} pkt do {TIERS[profile.tier + 1]?.label}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${tierInfo.bg.replace('bg-', 'bg-').replace('-100', '-400')}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400">{profile.activity_count} aktywności</p>
              </div>
            )
          })()}

          {/* Bio */}
          {isEditing ? (
            <form onSubmit={handleSubmit(onSave)} className="w-full max-w-xs space-y-3">
              <div>
                <textarea
                  {...register('bio')}
                  rows={3}
                  placeholder="Powiedz coś o sobie..."
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {errors.bio && <p className="mt-1 text-xs text-red-500">{errors.bio.message}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {isSaving ? 'Zapisywanie...' : 'Zapisz'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600"
                >
                  Anuluj
                </button>
              </div>
            </form>
          ) : (
            profile.bio && (
              <p className="max-w-xs text-center text-sm text-gray-600">{profile.bio}</p>
            )
          )}
        </div>

        {/* Activity history */}
        <div className="px-4 pb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Historia aktywności</h3>
          {history.length === 0 ? (
            <p className="text-center text-sm text-gray-400">Brak zakończonych aktywności</p>
          ) : (
            <div className="space-y-2">
              {history.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                  <span className="text-lg">{CATEGORY_MAP[activity.category]?.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{activity.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(activity.scheduled_at).toLocaleDateString('pl-PL', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {' · '}{activity.current_participants}/{activity.max_participants} osób
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <ReportUserDialog
          reportedUserId={userId}
          reportedNickname={profile.nickname}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  )
}
