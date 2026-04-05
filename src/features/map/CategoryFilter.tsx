import type { ActivityCategory } from '@/lib/database.types'
import { CATEGORY_MAP } from '@/lib/categories'

interface Props {
  pinned: ActivityCategory[]
  selected: ActivityCategory[]
  onChange: (categories: ActivityCategory[]) => void
}

export function CategoryFilter({ pinned, selected, onChange }: Props) {
  function toggle(category: ActivityCategory) {
    if (selected.includes(category)) {
      onChange(selected.filter((c) => c !== category))
    } else {
      onChange([...selected, category])
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {pinned.map((value) => {
        const cat = CATEGORY_MAP[value]
        const isActive = selected.includes(value)
        return (
          <button
            key={value}
            onClick={() => toggle(value)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition active:scale-95 ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-white/95 text-gray-700'
            }`}
          >
            <span className="text-base leading-none">{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        )
      })}
    </div>
  )
}
