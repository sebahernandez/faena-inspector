import type { AnswerValue } from '../../domain/inspection'

const OPTIONS: { value: AnswerValue; label: string; active: string }[] = [
  { value: 'YES', label: 'SÍ', active: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'NO', label: 'NO', active: 'bg-red-600 text-white border-red-600' },
  { value: 'NA', label: 'N/A', active: 'bg-slate-600 text-white border-slate-600' },
]

interface Props {
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  disabled?: boolean
}

/**
 * One tap, three states. Targets are deliberately large: this is used standing
 * next to a truck, outdoors, often with gloves on.
 */
export function AnswerToggle({ value, onChange, disabled = false }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group">
      {OPTIONS.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-12 rounded-lg border-2 text-base font-semibold transition-colors disabled:opacity-40 ${
              selected
                ? option.active
                : 'border-slate-300 bg-white text-slate-600 active:bg-slate-100'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
