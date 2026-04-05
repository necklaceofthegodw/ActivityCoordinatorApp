import type { ActivityCategory } from '@/lib/database.types'

const CATEGORIES: { value: ActivityCategory; label: string; emoji: string }[] = [
  { value: 'walk', label: 'Spacer', emoji: '🚶' },
  { value: 'coffee', label: 'Kawa', emoji: '☕' },
  { value: 'squash', label: 'Squash', emoji: '🎾' },
  { value: 'running', label: 'Bieganie', emoji: '🏃' },
  { value: 'language', label: 'Język', emoji: '📚' },
]

interface Props {
  selected: ActivityCategory[]
  onChange: (categories: ActivityCategory[]) => void
}

export function CategoryFilter({ selected, onChange }: Props) {
  function toggle(category: ActivityCategory) {
    if (selected.includes(category)) {
      onChange(selected.filter((c) => c !== category))
    } else {
      onChange([...selected, category])
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {CATEGORIES.map((cat) => {
        const isActive = selected.includes(cat.value)
        return (
          <button
            key={cat.value}
            onClick={() => toggle(cat.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 shadow-sm hover:bg-gray-50'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        )
      })}
    </div>
  )
}
