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
}

export function CreateActivitySheet({ lat, lng, pinnedCategories, onClose }: Props) {
  const create = useCreateActivity()
  useBackButton(true, onClose)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: pinnedCategories[0] ?? 'walk',
      max_participants: 4,
      scheduled_at: toLocalDateTimeString(new Date(Date.now() + 60 * 60 * 1000)),
    },
  })

  async function onSubmit(data: FormValues) {
    await create.mutateAsync({
      ...data,
      description: data.description ?? '',
      location_name: data.location_name ?? '',
      lat,
      lng,
    })
    onClose()
  }

  return (
    <>
      <div className="absolute inset-0 z-[1001] bg-black/20" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0 z-[1002] max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-white shadow-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}><div className="p-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <h2 className="mb-4 text-lg font-bold text-gray-900">Nowa aktywność</h2>

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
            <div className="flex flex-wrap gap-2">
              {pinnedCategories.map((value) => {
                const cat = CATEGORY_MAP[value]
                return (
                  <label key={value} className="cursor-pointer">
                    <input {...register('category')} type="radio" value={value} className="peer hidden" />
                    <span className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700">
                      {cat.emoji} {cat.label}
                    </span>
                  </label>
                )
              })}
            </div>
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
              disabled={create.isPending}
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
