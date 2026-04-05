interface Props {
  value: number
  onChange: (km: number) => void
}

export function RadiusSlider({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-xs text-gray-500">Zasięg</span>
      <input
        type="range"
        min={1}
        max={20}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-blue-600"
      />
      <span className="w-10 shrink-0 text-right text-xs font-medium text-gray-700">
        {value} km
      </span>
    </div>
  )
}
