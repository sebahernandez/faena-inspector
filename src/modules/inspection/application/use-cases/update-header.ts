import { isEditable, type Inspection } from '../../domain/inspection'
import type { Clock, InspectionRepository } from '../ports'
import { InspectionNotEditableError, InspectionNotFoundError } from './answer-item'

/** Only the header fields the inspector may correct while the draft is open. */
export type HeaderPatch = Partial<
  Pick<
    Inspection,
    | 'vehicleType'
    | 'plate'
    | 'brand'
    | 'model'
    | 'year'
    | 'driverName'
    | 'odometerKm'
    | 'generalObservations'
  >
>

export interface UpdateHeaderDeps {
  repository: InspectionRepository
  clock: Clock
}

export async function updateHeader(
  inspectionId: string,
  patch: HeaderPatch,
  deps: UpdateHeaderDeps,
): Promise<void> {
  const inspection = await deps.repository.find(inspectionId)
  if (!inspection) throw new InspectionNotFoundError(inspectionId)
  if (!isEditable(inspection)) throw new InspectionNotEditableError(inspectionId)

  const normalised: HeaderPatch = {
    ...patch,
    ...(patch.plate === undefined ? {} : { plate: patch.plate.trim().toUpperCase() }),
  }

  await deps.repository.update(inspectionId, {
    ...normalised,
    updatedAt: deps.clock.now().toISOString(),
  })
}
