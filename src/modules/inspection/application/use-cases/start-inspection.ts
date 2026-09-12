import type { Inspection } from '../../domain/inspection'
import type { Clock, IdGenerator, InspectionRepository } from '../ports'

export interface StartInspectionInput {
  templateId: string
  templateVersion: number
  plate: string
  vehicleType?: string | null
  brand?: string | null
  model?: string | null
  year?: number | null
  driverName?: string | null
  odometerKm?: number | null
}

export interface StartInspectionDeps {
  repository: InspectionRepository
  clock: Clock
  ids: IdGenerator
}

/**
 * Creates a local draft. Nothing leaves the device.
 *
 * The template version is copied in here and never refreshed: whatever the
 * checklist said today is what this inspection will always show.
 */
export async function startInspection(
  input: StartInspectionInput,
  deps: StartInspectionDeps,
): Promise<Inspection> {
  const now = deps.clock.now().toISOString()

  const inspection: Inspection = {
    id: deps.ids.next(),
    templateId: input.templateId,
    templateVersion: input.templateVersion,

    vehicleType: input.vehicleType ?? null,
    plate: input.plate.trim().toUpperCase(),
    brand: input.brand ?? null,
    model: input.model ?? null,
    year: input.year ?? null,
    driverName: input.driverName ?? null,
    odometerKm: input.odometerKm ?? null,
    inspectedAt: now,

    generalObservations: null,

    declaredByName: null,
    declaredByRole: null,
    declaredAt: null,
    approvedByName: null,
    approvedAt: null,

    status: 'draft',
    syncState: 'local',
    createdAt: now,
    updatedAt: now,
  }

  await deps.repository.create(inspection)
  return inspection
}
