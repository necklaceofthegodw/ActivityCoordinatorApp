import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  title: z.string().min(3, 'activity.titleMin').max(80, 'activity.titleMax'),
  description: z.string().max(400, 'activity.descriptionMax').optional(),
  category: z.enum(allCategoryValues),
  location_name: z.string().max(100).optional(),
  scheduled_at: z.string().refine((val) => {
    const d = new Date(val)
    return d > now && d <= maxDate
  }, 'activity.timeInvalid'),
  max_participants: z.coerce.number().int().min(2).max(50),
  is_private: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function buildLocationName(data: {
  name?: string
  address?: Record<string, string>
}): string {
  const { name, address = {} } = data

  // Named POI (park, cafe, landmark, etc.) — skip if it looks like just a road name
  if (name && !address.road?.startsWith(name)) return name

  // Fallback: street + number, city
  const street = [address.road, address.house_number].filter(Boolean).join(' ')
  const city = address.city ?? address.town ?? address.village ?? address.county ?? ''
  return [street, city].filter(Boolean).join(', ')
}

const SNAP_COLLAPSED = 2 / 3
const SNAP_EXPANDED = 0.92

function getAppHeight() {
  const val = document.documentElement.style.getPropertyValue('--app-height')
  return val ? parseFloat(val) : window.innerHeight
}

interface Props {
  lat: number
  lng: number
  pinnedCategories: ActivityCategory[]
  onClose: () => void
  isAtLimit: boolean
}

export function CreateActivitySheet({ lat, lng, pinnedCategories, onClose, isAtLimit }: Props) {
  const { t, i18n } = useTranslation()
  const create = useCreateActivity()
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false)
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(true)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null)

  useBackButton(true, onClose)
  useBackButton(isCategoryPickerOpen, () => setIsCategoryPickerOpen(false))

  const acceptLang = i18n.language === 'pl' ? 'pl' : 'en'

  // Reverse geocode pin location
  useEffect(() => {
    let cancelled = false
    setIsGeocodingLocation(true)

    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${acceptLang}`,
      { headers: { 'Accept-Language': acceptLang } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const name = buildLocationName(data)
        if (name) setValue('location_name', name)
      })
      .catch(() => { /* leave field empty on error */ })
      .finally(() => { if (!cancelled) setIsGeocodingLocation(false) })

    return () => { cancelled = true }
  }, [lat, lng])

  // Set initial height in px so drag calculations work
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.style.height = `${getAppHeight() * SNAP_COLLAPSED}px`
    }
  }, [])

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const sheet = sheetRef.current
    if (!sheet) return
    dragState.current = { startY: e.clientY, startHeight: sheet.offsetHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current || !sheetRef.current) return
    const delta = dragState.current.startY - e.clientY
    const appH = getAppHeight()
    const newH = Math.min(appH * 0.95, Math.max(appH * 0.25, dragState.current.startHeight + delta))
    sheetRef.current.style.transition = 'none'
    sheetRef.current.style.height = `${newH}px`
  }

  function handlePointerUp() {
    if (!dragState.current || !sheetRef.current) return
    const appH = getAppHeight()
    const currentH = sheetRef.current.offsetHeight
    const targetH = appH * (currentH > appH * 0.75 ? SNAP_EXPANDED : SNAP_COLLAPSED)
    sheetRef.current.style.transition = 'height 0.3s ease'
    sheetRef.current.style.height = `${targetH}px`
    dragState.current = null
  }

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: pinnedCategories[0] ?? 'walk',
      max_participants: 4,
      scheduled_at: toLocalDateTimeString(new Date(Date.now() + 60 * 60 * 1000)),
      is_private: false,
    },
  })

  const selectedCategory = watch('category')
  const isPrivate = watch('is_private')

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

  function handlePrivateToggle() {
    setValue('is_private', !isPrivate)
  }

  return (
    <>
      {isCategoryPickerOpen && (
        <div className="fixed inset-0 z-[1010] flex flex-col bg-white" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 0.5rem)', paddingBottom: '1rem' }}>
          <div className="flex items-center justify-between border-b border-fresh-border bg-fresh-surface px-5 py-4">
            <h2 className="text-lg font-bold text-fresh-plum">{t('activity.chooseCategory')}</h2>
            <button
              onClick={() => setIsCategoryPickerOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-fresh-muted hover:bg-fresh-soft"
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
                        ? 'fresh-selected'
                        : 'border-fresh-border bg-white text-fresh-plum hover:bg-fresh-surface'
                    }`}
                  >
                    <span className="text-2xl leading-none">{cat.emoji}</span>
                    <span className="px-1 text-center text-[10px] font-medium leading-tight">{t(`category.${cat.value}`)}</span>
                    {isSelected && <span className="absolute right-1.5 top-1.5 text-xs text-fresh-garden">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Transparent backdrop — map visible, click to close */}
      <div className="fixed inset-0 z-[1001]" onClick={onClose} />

      {/* Resizable sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[1002] flex flex-col rounded-t-2xl border-t border-fresh-border bg-white shadow-xl"
        style={{ height: `calc(var(--app-height, 100svh) * ${SNAP_COLLAPSED})`, paddingBottom: 'calc(var(--top-inset, 0px) + 1.25rem)' }}
      >
        {/* Drag handle */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center px-4 pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="h-1 w-10 rounded-full bg-fresh-border" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          <h2 className="mb-4 text-lg font-bold text-fresh-plum">{t('activity.new')}</h2>

          {isAtLimit && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('activity.limitReached')}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Title */}
            <div>
              <label className="mb-1 block text-sm font-medium text-fresh-plum">{t('activity.title')}</label>
              <input
                {...register('title')}
                className="fresh-input w-full rounded-lg px-3 py-2 text-sm"
                placeholder={t('activity.titlePlaceholder')}
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{t(errors.title.message!)}</p>}
            </div>

            {/* Category */}
            <div>
              <label className="mb-2 block text-sm font-medium text-fresh-plum">{t('activity.category')}</label>
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
                          ? 'fresh-selected'
                          : 'border-fresh-border text-fresh-plum hover:border-fresh-garden hover:bg-fresh-surface'
                      }`}
                    >
                      {cat.emoji} {t(`category.${value}`)}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setIsCategoryPickerOpen(true)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    selectedCategory && !pinnedCategories.includes(selectedCategory)
                      ? 'fresh-selected'
                      : 'border-dashed border-fresh-border text-fresh-muted hover:border-fresh-garden'
                  }`}
                >
                  {selectedCategory && !pinnedCategories.includes(selectedCategory)
                    ? `${CATEGORY_MAP[selectedCategory].emoji} ${t(`category.${selectedCategory}`)}`
                    : t('activity.more')}
                </button>
              </div>
              {errors.category && <p className="mt-1 text-xs text-red-500">{t(errors.category.message!)}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-fresh-plum">{t('activity.description')}</label>
              <textarea
                {...register('description')}
                rows={2}
                className="fresh-input w-full resize-none rounded-lg px-3 py-2 text-sm"
                placeholder={t('activity.descriptionPlaceholder')}
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-1 block text-sm font-medium text-fresh-plum">{t('activity.location')}</label>
              <div className="relative">
                <input
                  {...register('location_name')}
                  readOnly
                  className="w-full rounded-lg border border-fresh-border bg-fresh-surface px-3 py-2 text-sm text-fresh-muted outline-none"
                  placeholder={t('activity.locationLoading')}
                />
                {isGeocodingLocation && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-fresh-sky border-t-transparent" />
                  </div>
                )}
              </div>
            </div>

            {/* When */}
            <div>
              <label className="mb-1 block text-sm font-medium text-fresh-plum">{t('activity.when')}</label>
              <input
                {...register('scheduled_at')}
                type="datetime-local"
                min={toLocalDateTimeString(new Date(Date.now() + 5 * 60 * 1000))}
                max={toLocalDateTimeString(maxDate)}
                className="fresh-input w-full rounded-lg px-3 py-2 text-sm"
              />
              {errors.scheduled_at && <p className="mt-1 text-xs text-red-500">{t(errors.scheduled_at.message!)}</p>}
            </div>

            {/* Max participants */}
            <div>
              <label className="mb-1 block text-sm font-medium text-fresh-plum">{t('activity.maxParticipants')}</label>
              <input
                {...register('max_participants')}
                type="number"
                min={2}
                max={50}
                className="fresh-input w-full rounded-lg px-3 py-2 text-sm"
              />
              {errors.max_participants && <p className="mt-1 text-xs text-red-500">{errors.max_participants.message}</p>}
            </div>

            {/* Privacy */}
            <button
              type="button"
              onClick={handlePrivateToggle}
              className="flex w-full items-center justify-between rounded-xl border border-fresh-border px-4 py-3 text-left transition hover:bg-fresh-surface"
            >
              <div>
                <p className="text-sm font-medium text-fresh-plum">{t('activity.private')}</p>
                <p className="text-xs text-fresh-muted">{t('activity.privateDesc')}</p>
              </div>
              <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isPrivate ? 'bg-fresh-garden' : 'bg-fresh-border'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={create.isPending || isAtLimit}
                className="fresh-primary flex-1 rounded-xl py-3 text-sm font-medium"
              >
                {create.isPending ? t('activity.creating') : isPrivate ? t('activity.createPrivate') : t('activity.createPublic')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="fresh-secondary rounded-xl px-4 py-3 text-sm font-medium"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
