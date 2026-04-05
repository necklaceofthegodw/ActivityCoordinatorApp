import { useState } from 'react'
import type { ActivityCategory } from '@/lib/database.types'
import { ALL_CATEGORIES } from '@/lib/categories'

const MAX_PINNED = 5

interface Props {
  pinned: ActivityCategory[]
  onChange: (pinned: ActivityCategory[]) => void
}

export function CategoryPicker({ pinned, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false)

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
        onClick={() => setIsOpen(true)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-xl shadow-md transition active:scale-95"
        aria-label="Wybierz kategorie"
      >
        🗂️
      </button>

      {isOpen && (
        <>
          <div
            className="absolute inset-0 z-[1001] bg-black/20"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-[1002] rounded-t-2xl bg-white p-5 shadow-xl" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Wybierz kategorie</h2>
              <span className="text-sm text-gray-400">{pinned.length}/{MAX_PINNED}</span>
            </div>
            <p className="mb-4 text-xs text-gray-500">Zaznacz maksymalnie 5 kategorii widocznych w filtrach.</p>

            <div className="grid grid-cols-2 gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const isPinned = pinned.includes(cat.value)
                const isDisabled = !isPinned && pinned.length >= MAX_PINNED
                return (
                  <button
                    key={cat.value}
                    onClick={() => toggle(cat.value)}
                    disabled={isDisabled}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition active:scale-95 ${
                      isPinned
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : isDisabled
                          ? 'border-gray-100 bg-gray-50 text-gray-300'
                          : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    <span className="text-base leading-none">{cat.emoji}</span>
                    <span className="truncate">{cat.label}</span>
                    {isPinned && <span className="ml-auto text-blue-600">✓</span>}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Gotowe
            </button>
          </div>
        </>
      )}
    </>
  )
}
