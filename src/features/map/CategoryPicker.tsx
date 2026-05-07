import { useTranslation } from 'react-i18next'
import type { ActivityCategory } from '@/lib/database.types'
import { ALL_CATEGORIES } from '@/lib/categories'
import { useBackButton } from '@/hooks/useBackButton'

const MAX_PINNED = 5

interface Props {
  pinned: ActivityCategory[]
  onChange: (pinned: ActivityCategory[]) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CategoryPicker({ pinned, onChange, isOpen, onOpenChange }: Props) {
  const { t } = useTranslation()
  useBackButton(isOpen, () => onOpenChange(false))

  function toggle(value: ActivityCategory) {
    if (pinned.includes(value)) {
      onChange(pinned.filter((c) => c !== value))
    } else if (pinned.length < MAX_PINNED) {
      onChange([...pinned, value])
    }
  }

  return (
    <>
      <button
        onClick={() => onOpenChange(true)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-fresh-border bg-white/95 text-xl shadow-md transition hover:bg-fresh-surface active:scale-95"
        aria-label={t('map.categoryPickerLabel')}
      >
        🗂️
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[1002] flex flex-col bg-white" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 0.5rem)', paddingBottom: '1rem' }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-fresh-border bg-fresh-surface px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-fresh-plum">{t('map.chooseCategories')}</h2>
              <p className="text-xs text-fresh-muted">{t('map.maxPinned')}</p>
            </div>
            <span className="text-sm font-semibold text-fresh-sky">{pinned.length}/{MAX_PINNED}</span>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-3">
              {ALL_CATEGORIES.map((cat) => {
                const isPinned = pinned.includes(cat.value)
                const isDisabled = !isPinned && pinned.length >= MAX_PINNED
                return (
                  <button
                    key={cat.value}
                    onClick={() => toggle(cat.value)}
                      disabled={isDisabled}
                      className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 transition active:scale-95 ${
                        isPinned
                        ? 'fresh-selected'
                        : isDisabled
                          ? 'border-fresh-border/60 bg-fresh-surface/60 text-fresh-muted/50'
                          : 'border-fresh-border bg-white text-fresh-plum hover:bg-fresh-surface'
                    }`}
                  >
                    <span className="text-2xl leading-none">{cat.emoji}</span>
                    <span className="text-[10px] font-medium leading-tight text-center px-1">{t(`category.${cat.value}`)}</span>
                    {isPinned && (
                      <span className="absolute right-1.5 top-1.5 text-xs text-fresh-garden">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Done button */}
          <div className="border-t border-fresh-border px-5 py-4">
            <button
              onClick={() => onOpenChange(false)}
              className="fresh-primary w-full rounded-2xl py-3.5 text-sm font-semibold active:scale-[0.98]"
            >
              {t('common.done')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
