interface Props {
  answered: number
  total: number
}

export function ProgressBar({ answered, total }: Props) {
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100)

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-slate-600">
        <span>
          {answered} de {total} ítems
        </span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="h-full bg-slate-900 transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
