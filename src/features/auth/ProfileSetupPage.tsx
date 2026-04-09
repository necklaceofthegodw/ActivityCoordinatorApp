import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import { useAuth } from './AuthProvider'

const profileSchema = z.object({
  nickname: z
    .string()
    .min(3, 'setup.nicknameMin')
    .max(30, 'setup.nicknameMax')
    .regex(/^[a-zA-Z0-9_-]+$/, 'setup.nicknamePattern'),
  bio: z.string().max(160, 'setup.bioMax').optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

export default function ProfileSetupPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors }, setError } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  })

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('setup.avatarTooLarge'))
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function onSubmit(data: ProfileForm) {
    if (!user) return
    setIsSubmitting(true)

    try {
      let avatarUrl: string | null = null

      if (avatarFile) {
        let compressedBlob: Blob
        try {
          compressedBlob = await compressImage(avatarFile)
        } catch {
          toast.error(t('setup.avatarUploadFail'))
          setIsSubmitting(false)
          return
        }

        const path = `${user.id}/avatar.jpg`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, compressedBlob, { upsert: true, contentType: 'image/jpeg' })

        if (uploadError) {
          toast.error(t('setup.avatarUploadFail'))
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(path)

          // Validate face detected in avatar
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (currentSession) {
              const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-face`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentSession.access_token}` },
                  body: JSON.stringify({ action: 'validate-avatar', avatarUrl: publicUrl }),
                }
              )
              if (res.ok) {
                const faceData = await res.json()
                if (faceData.faceDetected === false) {
                  await supabase.storage.from('avatars').remove([path])
                  toast.error(t('setup.avatarNoFace'))
                  setIsSubmitting(false)
                  return
                }
              }
            }
          } catch {
            // Edge Function unavailable — allow upload
          }

          avatarUrl = publicUrl
        }
      }

      const { error } = await supabase.rpc('create_profile', {
        p_nickname: data.nickname,
        p_bio: data.bio ?? null,
        p_avatar_url: avatarUrl,
      })

      if (error) {
        if (error.code === '23505') {
          setError('nickname', { message: t('setup.nicknameTaken') })
          return
        }
        throw error
      }

      // Trigger auth state refresh so AuthProvider picks up the new profile
      await supabase.auth.refreshSession()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.genericError')
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">{t('setup.title')}</h1>
        <p className="mb-6 text-sm text-gray-500">{t('setup.subtitle')}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-20 w-20 overflow-hidden rounded-full bg-gray-100 transition hover:opacity-80"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl text-gray-400">+</span>
              )}
            </button>
            <span className="text-xs text-gray-400">{t('setup.addPhoto')}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Nickname */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('setup.nickname')}</label>
            <input
              {...register('nickname')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder={t('setup.nicknamePlaceholder')}
            />
            {errors.nickname && <p className="mt-1 text-xs text-red-500">{t(errors.nickname.message!)}</p>}
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('setup.bio')}</label>
            <textarea
              {...register('bio')}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder={t('setup.bioPlaceholder')}
            />
            {errors.bio && <p className="mt-1 text-xs text-red-500">{t(errors.bio.message!)}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? t('common.saving') : t('setup.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
