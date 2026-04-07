import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateActivity } from './useCreateActivity'
import { ALL_CATEGORIES, CATEGORY_MAP } from '@/lib/categories'
import type { ActivityCategory } from '@/lib/database.types'
import { useBackButton } from '@/hooks/useBackButton'

function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const now = new Date()
const maxDate = new Date(now.getTime() + 48 * 60 * 60 * 1000)

const allCategoryValues = ALL_CATEGORIES.map((c) => c.value) as [ActivityCategory, ...ActivityCategory[]]

const schema = z.object({
  title: z.string().min(3, 'Min. 3 znaki').max(80, 'Max. 80 znaków'),
  description: z.string().max(400, 'Max. 400 znaków').optional(),
  category: z.enum(allCategoryValues),
  location_name: z.string().max(100).optional(),
  scheduled_at: z.string().refine((val) => {
    const d = new Date(val)
    return d > now && d <= maxDate
  }, 'Czas musi być w ciągu najbliższych 48h'),
  max_participants: z.coerce.number().int().min(2).max(50),
})

type FormValues = z.infer<typeof schema>

interface Props {
  lat: number
  lng: number
  pinnedCategories: ActivityCategory[]
  onClose: () => void
  isAtLimit: boolean
}

export function CreateActivitySheet({ lat, lng, pinnedCategories, onClose, isAtLimit }: Props) {
  const create = useCreateActivity()
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false)
  useBackButton(true, onClose)
  useBackButton(isCategoryPickerOpen, () => setIsCategoryPickerOpen(false))

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: pinnedCategories[0] ?? 'walk',
      max_participants: 4,
      scheduled_at: toLocalDateTimeString(new Date(Date.now() + 60 * 60 * 1000)),
    },
  })

  const selectedCategory = watch('category')

  useEffect(() => {
    function scrollActiveIntoView() {
      const active = document.activeElement as HTMLElement | null
      if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) return
      active.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' })
    }
    window.visualViewport?.addEventListener('resize', scrollActiveIntoView)
    return () => window.visualViewport?.removeEventListener('resize', scrollActiveIntoView)
  }, [])

  async function onSubmit(data: FormValues) {
    await create.mutateAsync({
      ...data,
      description: data.description ?? '',
      location_name: data.location_name ?? '',
      scheduled_at: new Date(data.scheduled_at).toISOString(),
      lat,
      lng,
    })
    onClose()
  }

  return (
    <>
      {isCategoryPickerOpen && (
        <div className="fixed inset-0 z-[1010] flex flex-col bg-white" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 0.5rem)', paddingBottom: '1rem' }}>
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-lg font-bold text-gray-900">Wybierz kategorię</h2>
            <button
              onClick={() => setIsCategoryPickerOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-3">
              {ALL_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.value
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => { setValue('category', cat.value, { shouldValidate: true }); setIsCategoryPickerOpen(false) }}
                    className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 transition active:scale-95 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <span className="text-2xl leading-none">{cat.emoji}</span>
                    <span className="px-1 text-center text-[10px] font-medium leading-tight">{cat.label}</span>
                    {isSelected && <span className="absolute right-1.5 top-1.5 text-xs text-blue-600">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-[1001] bg-black/20" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-[1002] overflow-y-auto rounded-t-2xl bg-white shadow-xl" style={{ maxHeight: 'calc(var(--app-height, 100svh) * 0.92)', paddingBottom: 'calc(var(--top-inset, 0px) + 1.25rem)' }}><div className="p-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <h2 className="mb-4 text-lg font-bold text-gray-900">Nowa aktywność</h2>

        {isAtLimit && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Osiągnąłeś limit 3 aktywnych aktywności. Opuść lub poczekaj na zakończenie jednej z nich.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tytuł */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tytuł *</label>
            <input
              {...register('title')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="np. Poranny bieg w parku"
            />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
          </div>

          {/* Kategoria */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Kategoria *</label>
            <div className="flex flex-wrap items-center gap-2">
              {pinnedCategories.map((value) => {
                const cat = CATEGORY_MAP[value]
                const isSelected = selectedCategory === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setValue('category', value, { shouldValidate: true })}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setIsCategoryPickerOpen(true)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  selectedCategory && !pinnedCategories.includes(selectedCategory)
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-dashed border-gray-300 text-gray-500 hover:border-gray-400'
                }`}
              >
                {selectedCategory && !pinnedCategories.includes(selectedCategory)
                  ? `${CATEGORY_MAP[selectedCategory].emoji} ${CATEGORY_MAP[selectedCategory].label}`
                  : '＋ Więcej'}
              </button>
            </div>
            {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>}
          </div>

          {/* Opis */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Opis</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Dodaj szczegóły..."
            />
          </div>

          {/* Miejsce */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nazwa miejsca</label>
            <input
              {...register('location_name')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="np. Park Łazienkowski, wejście główne"
            />
          </div>

          {/* Czas */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Kiedy? *</label>
            <input
              {...register('scheduled_at')}
              type="datetime-local"
              min={toLocalDateTimeString(new Date(Date.now() + 5 * 60 * 1000))}
              max={toLocalDateTimeString(maxDate)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {errors.scheduled_at && <p className="mt-1 text-xs text-red-500">{errors.scheduled_at.message}</p>}
          </div>

          {/* Liczba osób */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Liczba osób *</label>
            <input
              {...register('max_participants')}
              type="number"
              min={2}
              max={50}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {errors.max_participants && <p className="mt-1 text-xs text-red-500">{errors.max_participants.message}</p>}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={create.isPending || isAtLimit}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {create.isPending ? 'Dodawanie...' : 'Dodaj na mapę'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Anuluj
            </button>
          </div>
        </form>
      </div></div>
    </>
  )
}
