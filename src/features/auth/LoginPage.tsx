import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

const loginSchema = z.object({
  email: z.string().email('auth.emailInvalid'),
  password: z.string().min(6, 'auth.passwordMinLogin'),
  confirmPassword: z.string().optional(),
})

const registerSchema = loginSchema.extend({
  password: z.string().min(8, 'auth.passwordMinRegister'),
  confirmPassword: z.string().min(1, 'auth.confirmPasswordRequired'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'auth.passwordsDoNotMatch',
  path: ['confirmPassword'],
})

type AuthForm = {
  email: string
  password: string
  confirmPassword?: string
}

export default function LoginPage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const oauthRedirectTo = import.meta.env.VITE_OAUTH_REDIRECT_TO?.trim() || `${window.location.origin}/`
  const authEmailRedirectTo = import.meta.env.VITE_AUTH_EMAIL_REDIRECT_TO?.trim() || `${window.location.origin}/`

  const { register, handleSubmit, formState: { errors } } = useForm<AuthForm>({
    resolver: zodResolver(mode === 'login' ? loginSchema : registerSchema),
  })

  async function onSubmit(data: AuthForm) {
    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: authEmailRedirectTo,
          },
        })
        if (error) throw error
        toast.success(t('auth.checkEmail'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.genericError')
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    if (isGoogleSubmitting) return
    setIsGoogleSubmitting(true)

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: oauthRedirectTo,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) throw error
      if (!data?.url) throw new Error('Missing OAuth redirect URL')

      window.location.assign(data.url)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.genericError')
      toast.error(message)
    } finally {
      setIsGoogleSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">ActivityCoordinator</h1>
        <p className="mb-6 text-sm text-gray-500">
          {mode === 'login' ? t('auth.loginSubtitle') : t('auth.createAccount')}
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={isGoogleSubmitting}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isGoogleSubmitting ? t('common.loading') : t('auth.continueWithGoogle')}
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-400">{t('common.or')}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.email')}</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="ty@example.com"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{t(errors.email.message!)}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.password')}</label>
            <input
              {...register('password')}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{t(errors.password.message!)}</p>}
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('auth.confirmPassword')}</label>
              <input
                {...register('confirmPassword')}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="********"
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{t(errors.confirmPassword.message!)}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? t('common.loading') : mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="font-medium text-blue-600 hover:underline"
          >
            {mode === 'login' ? t('auth.registerLink') : t('auth.loginLink')}
          </button>
        </p>
      </div>
    </div>
  )
}
