import type { ActivityCategory } from '@/lib/database.types'
import { ALL_CATEGORIES } from '@/lib/categories'

const MAX_PINNED = 5

interface Props {
  pinned: ActivityCategory[]
  onChange: (pinned: ActivityCategory[]) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CategoryPicker({ pinned, onChange, isOpen, onOpenChange }: Props) {

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
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-xl shadow-md transition active:scale-95"
        aria-label="Wybierz kategorie"
      >
        🗂️
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[1002] flex flex-col bg-white" style={{ paddingTop: 'calc(var(--top-inset, 0px) + 0.5rem)', paddingBottom: '1rem' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Wybierz kategorie</h2>
              <p className="text-xs text-gray-500">Zaznacz maksymalnie 5 widocznych w filtrach</p>
            </div>
            <span className="text-sm font-semibold text-blue-600">{pinned.length}/{MAX_PINNED}</span>
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
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : isDisabled
                          ? 'border-gray-100 bg-gray-50 text-gray-300'
                          : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <span className="text-2xl leading-none">{cat.emoji}</span>
                    <span className="text-[10px] font-medium leading-tight text-center px-1">{cat.label}</span>
                    {isPinned && (
                      <span className="absolute top-1.5 right-1.5 text-blue-600 text-xs">✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Done button */}
          <div className="px-5 py-4 border-t border-gray-100">
            <button
              onClick={() => onOpenChange(false)}
              className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              Gotowe
            </button>
          </div>
        </div>
      )}
    </>
  )
}
