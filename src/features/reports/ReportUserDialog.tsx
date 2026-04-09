import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const reasonSchema = z.string().min(10, 'report.reasonMin').max(500, 'report.reasonMax')

interface Props {
  reportedUserId: string
  reportedNickname: string
  onClose: () => void
}

export function ReportUserDialog({ reportedUserId, reportedNickname, onClose }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const result = reasonSchema.safeParse(reason)
    if (!result.success) {
      setError(result.error.errors[0].message)
      return
    }

    if (!user) return
    setIsSubmitting(true)
    setError(null)

    const { error: dbError } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      reason,
    })

    setIsSubmitting(false)

    if (dbError) {
      if (dbError.code === '23505') {
        toast.error(t('report.alreadyReported'))
      } else {
        toast.error(t('report.sendFailed'))
      }
      return
    }

    toast.success(t('report.sent'))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-base font-bold text-gray-900">{t('report.title')}</h3>
        <p className="mb-4 text-sm text-gray-500">
          {t('report.reporting')} <span className="font-medium text-gray-800">{reportedNickname}</span>
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('report.reason')}
        </label>
        <textarea
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(null) }}
          rows={4}
          placeholder={t('report.reasonPlaceholder')}
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
        />
        {error && <p className="mt-1 text-xs text-red-500">{t(error)}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {isSubmitting ? t('report.sending') : t('report.send')}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
