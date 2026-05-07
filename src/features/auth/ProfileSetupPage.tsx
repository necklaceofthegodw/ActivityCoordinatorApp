import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'
import { REQUIRE_PROFILE_VERIFICATION } from '@/lib/profileVerification'
import { requestVerifyFace } from '@/lib/verifyFaceRequest'
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
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error(t('setup.avatarInvalidFormat'))
      return
    }
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
        const result = await compressImage(avatarFile)
        const isCompressed = result !== avatarFile
        const ext = isCompressed ? 'jpg' : (avatarFile.name.split('.').pop() ?? 'jpg')
        const contentType = isCompressed ? 'image/jpeg' : (avatarFile.type || 'image/jpeg')
        const path = `${user.id}/avatar.${ext}`
        const uploadFile = new File([result], `avatar.${ext}`, { type: contentType })

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, uploadFile, { upsert: true })

        if (uploadError) {
          toast.error(t('setup.avatarUploadFail'), { description: uploadError.message })
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(path)

          if (REQUIRE_PROFILE_VERIFICATION) {
            try {
              const faceRes = await requestVerifyFace({ action: 'validate-avatar', avatarUrl: publicUrl })
              let faceData: { faceDetected?: boolean } | null = null
              try {
                faceData = (await faceRes.json()) as { faceDetected?: boolean }
              } catch {
                faceData = null
              }
              if (faceRes.ok && faceData?.faceDetected === false) {
                await supabase.storage.from('avatars').remove([path])
                toast.error(t('setup.avatarNoFace'))
                setIsSubmitting(false)
                return
              }
            } catch {
              // Edge Function unavailable - allow upload
            }
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
    <div className="flex min-h-screen items-center justify-center bg-fresh-surface px-4">
      <div className="fresh-card w-full max-w-sm p-8">
        <h1 className="mb-1 text-2xl font-bold text-fresh-plum">{t('setup.title')}</h1>
        <p className="mb-6 text-sm text-fresh-muted">{t('setup.subtitle')}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-20 w-20 overflow-hidden rounded-full bg-fresh-soft text-fresh-indigo transition hover:opacity-80"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl text-fresh-muted">+</span>
              )}
            </button>
            <span className="text-xs text-fresh-muted">{t('setup.addPhoto')}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Nickname */}
          <div>
            <label className="mb-1 block text-sm font-medium text-fresh-plum">{t('setup.nickname')}</label>
            <input
              {...register('nickname')}
              className="fresh-input w-full rounded-lg px-3 py-2 text-sm"
              placeholder={t('setup.nicknamePlaceholder')}
            />
            {errors.nickname && <p className="mt-1 text-xs text-red-500">{t(errors.nickname.message!)}</p>}
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1 block text-sm font-medium text-fresh-plum">{t('setup.bio')}</label>
            <textarea
              {...register('bio')}
              rows={3}
              className="fresh-input w-full resize-none rounded-lg px-3 py-2 text-sm"
              placeholder={t('setup.bioPlaceholder')}
            />
            {errors.bio && <p className="mt-1 text-xs text-red-500">{t(errors.bio.message!)}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="fresh-primary w-full rounded-lg px-4 py-2.5 text-sm font-medium"
          >
            {isSubmitting ? t('common.saving') : t('setup.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
