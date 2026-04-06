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
            className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm transition active:scale-95 ${
              isActive
                ? 'bg-blue-600'
                : 'bg-white/95'
            }`}
          >
            <span className="text-lg leading-none">{cat.emoji}</span>
          </button>
        )
      })}
    </div>
  )
}
