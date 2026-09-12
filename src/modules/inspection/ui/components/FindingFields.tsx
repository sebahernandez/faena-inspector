interface Props {
  observation: string
  responsible: string
  dueDate: string
  onChange: (patch: { observation?: string; responsible?: string; dueDate?: string }) => void
  disabled?: boolean
}

/**
 * Shown only when the answer is NO.
 *
 * The source document puts Responsable and Fecha next to every item: a failure
 * is a task with an owner and a deadline, not a remark. These fields exist so
 * the supervisor's findings list is real work, not free text.
 */
export function FindingFields({ observation, responsible, dueDate, onChange, disabled }: Props) {
  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base disabled:bg-slate-50'

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Observación</span>
        <textarea
          rows={2}
          value={observation}
          disabled={disabled}
          onChange={(e) => onChange({ observation: e.target.value })}
          className={field}
          placeholder="Qué se encontró"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Responsable</span>
          <input
            type="text"
            value={responsible}
            disabled={disabled}
            onChange={(e) => onChange({ responsible: e.target.value })}
            className={field}
            placeholder="Quién lo corrige"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Fecha</span>
          <input
            type="date"
            value={dueDate}
            disabled={disabled}
            onChange={(e) => onChange({ dueDate: e.target.value })}
            className={field}
          />
        </label>
      </div>
    </div>
  )
}
