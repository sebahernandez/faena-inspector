import { useEffect, useState } from 'react'
import type { TemplateItem } from '@/modules/template/domain/template'
import type { Answer, AnswerValue } from '../../domain/inspection'
import { AnswerToggle } from './AnswerToggle'
import { FindingFields } from './FindingFields'
import { EvidencePhotos } from './EvidencePhotos'
import type { EvidencePhoto } from '../../domain/evidence'

interface Props {
  item: TemplateItem
  answer: Answer | undefined
  photos: EvidencePhoto[]
  inspectionId: string
  disabled?: boolean
  onAnswer: (value: AnswerValue) => void
  onFindingChange: (patch: { observation?: string; responsible?: string; dueDate?: string }) => void
  onPhotosChanged: () => void
}

export function ItemRow({
  item,
  answer,
  photos,
  inspectionId,
  disabled,
  onAnswer,
  onFindingChange,
  onPhotosChanged,
}: Props) {
  // Local mirror so typing stays instant; the write is debounced by the parent.
  const [observation, setObservation] = useState(answer?.observation ?? '')
  const [responsible, setResponsible] = useState(answer?.responsible ?? '')
  const [dueDate, setDueDate] = useState(answer?.dueDate ?? '')

  useEffect(() => {
    setObservation(answer?.observation ?? '')
    setResponsible(answer?.responsible ?? '')
    setDueDate(answer?.dueDate ?? '')
  }, [answer?.inspectionId, answer?.itemId, answer?.observation, answer?.responsible, answer?.dueDate])

  const handleFinding = (patch: { observation?: string; responsible?: string; dueDate?: string }) => {
    if (patch.observation !== undefined) setObservation(patch.observation)
    if (patch.responsible !== undefined) setResponsible(patch.responsible)
    if (patch.dueDate !== undefined) setDueDate(patch.dueDate)
    onFindingChange(patch)
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 flex gap-2 text-base">
        <span className="shrink-0 font-mono text-sm text-slate-400">{item.code}</span>
        <span className="text-slate-900">{item.label}</span>
      </p>

      <AnswerToggle value={answer?.value} onChange={onAnswer} {...(disabled ? { disabled } : {})} />

      {answer?.value === 'NO' && (
        <>
          <FindingFields
            observation={observation}
            responsible={responsible}
            dueDate={dueDate}
            onChange={handleFinding}
            {...(disabled ? { disabled } : {})}
          />
          <EvidencePhotos
            inspectionId={inspectionId}
            itemId={item.id}
            photos={photos}
            onChanged={onPhotosChanged}
            {...(disabled ? { disabled } : {})}
          />
        </>
      )}
    </li>
  )
}
