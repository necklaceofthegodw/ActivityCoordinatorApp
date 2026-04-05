import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

const reasonSchema = z.string().min(10, 'Min. 10 znaków').max(500, 'Max. 500 znaków')

interface Props {
  reportedUserId: string
  reportedNickname: string
  onClose: () => void
}

export function ReportUserDialog({ reportedUserId, reportedNickname, onClose }: Props) {
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
        toast.error('Już zgłosiłeś tego użytkownika')
      } else {
        toast.error('Nie udało się wysłać zgłoszenia')
      }
      return
    }

    toast.success('Zgłoszenie zostało wysłane')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-base font-bold text-gray-900">Zgłoś użytkownika</h3>
        <p className="mb-4 text-sm text-gray-500">
          Zgłaszasz: <span className="font-medium text-gray-800">{reportedNickname}</span>
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Powód zgłoszenia *
        </label>
        <textarea
          value={reason}
          onChange={(e) => { setReason(e.target.value); setError(null) }}
          rows={4}
          placeholder="Opisz dlaczego zgłaszasz tego użytkownika (min. 10 znaków)..."
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {isSubmitting ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  )
}
