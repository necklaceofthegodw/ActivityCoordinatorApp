import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

const profileSchema = z.object({
  nickname: z
    .string()
    .min(3, 'Minimum 3 znaki')
    .max(30, 'Maksimum 30 znaków')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Tylko litery, cyfry, _ i -'),
  bio: z.string().max(160, 'Maksimum 160 znaków').optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

export default function ProfileSetupPage() {
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
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar musi być mniejszy niż 2MB')
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
        const ext = avatarFile.name.split('.').pop()
        const path = `${user.id}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })

        if (uploadError) {
          toast.error('Nie udało się wgrać avatara — profil zostanie utworzony bez zdjęcia')
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(path)
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
          setError('nickname', { message: 'Ten nickname jest już zajęty' })
          return
        }
        throw error
      }

      // Trigger auth state refresh so AuthProvider picks up the new profile
      await supabase.auth.refreshSession()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Coś poszło nie tak'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Skonfiguruj profil</h1>
        <p className="mb-6 text-sm text-gray-500">Inni uczestnicy zobaczą te informacje</p>

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
            <span className="text-xs text-gray-400">Dodaj zdjęcie (opcjonalne)</span>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Nickname *</label>
            <input
              {...register('nickname')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="np. jan_kowalski"
            />
            {errors.nickname && <p className="mt-1 text-xs text-red-500">{errors.nickname.message}</p>}
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Bio (opcjonalne)</label>
            <textarea
              {...register('bio')}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Powiedz coś o sobie..."
            />
            {errors.bio && <p className="mt-1 text-xs text-red-500">{errors.bio.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Zapisywanie...' : 'Gotowe — pokaż mi mapę'}
          </button>
        </form>
      </div>
    </div>
  )
}
