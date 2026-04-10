import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

type VerifyState =
  | { status: 'idle' }
  | { status: 'streaming' }
  | { status: 'captured'; dataUrl: string; blob: Blob }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'error'; reason: 'no_match' | 'no_face' | 'camera' | 'unknown'; attemptsLeft?: number }
  | { status: 'limit_reached'; retryAfter: string }
  | { status: 'api_down' }

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip "data:image/jpeg;base64," prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export default function VerifyPage() {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<VerifyState>({ status: 'idle' })

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Navigate away once the profile confirms is_verified after a successful submission
  useEffect(() => {
    if (state.status === 'success' && profile?.is_verified) {
      navigate('/')
    }
  }, [state.status, profile?.is_verified, navigate])

  function skipForNow() {
    sessionStorage.setItem('verificationPending', 'true')
    navigate('/', { state: { openProfile: !profile?.avatar_url } })
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setState({ status: 'streaming' })
    } catch {
      setState({ status: 'error', reason: 'camera' })
    }
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setState({ status: 'error', reason: 'camera' })
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (!blob) {
        setState({ status: 'error', reason: 'unknown' })
        return
      }
      // Use createObjectURL for preview — avoids double JPEG encoding
      const dataUrl = URL.createObjectURL(blob)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setState({ status: 'captured', dataUrl, blob })
    }, 'image/jpeg', 0.85)
  }

  async function submitVerification() {
    if (state.status !== 'captured') return
    setState({ status: 'pending' })

    try {
      const base64 = await blobToBase64(state.blob)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setState({ status: 'error', reason: 'unknown' }); return }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-face`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'verify', selfie: base64 }),
        }
      )

      if (res.status === 503) {
        sessionStorage.setItem('verificationPending', 'true')
        setState({ status: 'api_down' })
        return
      }

      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        // Edge Function returned a non-JSON body (e.g. 500 crash)
        setState({ status: 'error', reason: 'unknown' })
        return
      }

      if (!res.ok) {
        setState({ status: 'error', reason: 'unknown' })
        return
      }

      if (data.verified) {
        sessionStorage.removeItem('verificationPending')
        setState({ status: 'success' })
        // Refresh session so AuthProvider re-fetches profile with is_verified = true
        await supabase.auth.refreshSession()
        return
      }

      if (data.reason === 'limit_reached') {
        setState({ status: 'limit_reached', retryAfter: data.retryAfter })
        return
      }

      setState({
        status: 'error',
        reason: data.reason === 'no_face' ? 'no_face' : 'no_match',
        attemptsLeft: data.attemptsLeft,
      })
    } catch {
      setState({ status: 'error', reason: 'unknown' })
    }
  }

  function retake() {
    setState({ status: 'idle' })
  }

  // After success AuthProvider will re-route — show brief success screen
  if (state.status === 'success') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-4">
        <span className="text-5xl">✅</span>
        <h2 className="text-xl font-bold text-gray-900">{t('verify.successTitle')}</h2>
        <p className="text-sm text-gray-500">{t('verify.successDesc')}</p>
      </div>
    )
  }

  if (state.status === 'api_down') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <span className="text-4xl">⏳</span>
        <p className="max-w-xs text-center text-sm text-gray-600">{t('verify.apiDown')}</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white"
        >
          {t('common.done')}
        </button>
      </div>
    )
  }

  // No avatar — let user through to set one
  if (!profile?.avatar_url) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <span className="text-4xl">📷</span>
        <p className="max-w-xs text-center text-sm text-gray-600">{t('verify.noAvatar')}</p>
        <button
          onClick={skipForNow}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white"
        >
          {t('verify.goToProfile')}
        </button>
      </div>
    )
  }

  const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US'

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 px-4 pt-10">
      <div className="w-full max-w-sm">
        {/* Header with skip */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('verify.title')}</h1>
            <p className="mt-1 text-sm text-gray-500">{t('verify.subtitle')}</p>
          </div>
          <button
            onClick={skipForNow}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-400 hover:bg-gray-100"
          >
            {t('verify.skipForNow')}
          </button>
        </div>

        {/* Camera / Preview */}
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '4/3' }}>
          {state.status === 'captured' ? (
            <img src={state.dataUrl} alt="selfie" className="h-full w-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          )}
          {(state.status === 'idle' || state.status === 'error' || state.status === 'limit_reached') && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl opacity-30">🤳</span>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Error / status messages */}
        {state.status === 'error' && (
          <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {state.reason === 'camera' && t('verify.cameraError')}
            {state.reason === 'no_face' && t('verify.noFace')}
            {state.reason === 'no_match' && (
              <>
                <p>{t('verify.noMatch')}</p>
                {state.attemptsLeft !== undefined && (
                  <p className="mt-1 font-medium">{t('verify.attemptsLeft', { count: state.attemptsLeft })}</p>
                )}
                {(state.attemptsLeft ?? 1) <= 1 && (
                  <p className="mt-2 text-xs text-red-600">{t('verify.changeAvatarHint')}</p>
                )}
              </>
            )}
            {state.reason === 'unknown' && t('common.genericError')}
          </div>
        )}

        {state.status === 'limit_reached' && (
          <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <p>{t('verify.limitReached')}</p>
            {state.retryAfter && (
              <p className="mt-1 text-xs font-medium">
                {t('verify.retryAfter', { time: new Date(state.retryAfter).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
              </p>
            )}
            <p className="mt-2 text-xs">{t('verify.changeAvatarHint')}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white"
            >
              {t('verify.goChangeAvatar')}
            </button>
          </div>
        )}

        {/* Actions */}
        {(state.status === 'idle' || state.status === 'error') && (
          <button
            onClick={startCamera}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {t('verify.startCamera')}
          </button>
        )}

        {state.status === 'streaming' && (
          <button
            onClick={capture}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            {t('verify.takeSelfie')}
          </button>
        )}

        {state.status === 'captured' && (
          <div className="flex gap-3">
            <button
              onClick={retake}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              {t('verify.retake')}
            </button>
            <button
              onClick={submitVerification}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              {t('verify.submit')}
            </button>
          </div>
        )}

        {state.status === 'pending' && (
          <button disabled className="w-full rounded-lg bg-blue-400 px-4 py-2.5 text-sm font-medium text-white">
            {t('verify.verifying')}
          </button>
        )}

        {user && (
          <p className="mt-3 text-center text-xs text-gray-400">
            {user.email}
          </p>
        )}
      </div>
    </div>
  )
}
