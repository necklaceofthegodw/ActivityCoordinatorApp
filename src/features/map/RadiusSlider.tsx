import { useTranslation } from 'react-i18next'

interface Props {
  value: number
  onChange: (km: number) => void
}

export function RadiusSlider({ value, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={1}
        max={20}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-blue-600"
      />
      <span className="w-8 shrink-0 text-right text-xs font-medium text-gray-700">
        {value} km
      </span>
    </div>
  )
}
