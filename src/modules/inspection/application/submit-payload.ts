/**
 * Translates a local inspection into the payload `submit_inspection` expects.
 *
 * This is a contract, not infrastructure: it imports nothing from Supabase and
 * builds a plain object. It lives in the application layer so the sync module
 * can depend on the shape without depending on an implementation.
 *
 * Deliberately dumb and total: every field is mapped explicitly so a renamed
 * column fails at compile time rather than silently dropping data from a legal
 * document.
 */
import type { Answer, Inspection } from '../domain/inspection'

export interface SubmitPayload {
  inspection: {
    id: string
    template_id: string
    template_version: number
    vehicle_type: string | null
    plate: string
    brand: string | null
    model: string | null
    year: number | null
    driver_name: string | null
    odometer_km: number | null
    inspected_at: string
    general_observations: string | null
    declared_by_name: string
    declared_by_role: string | null
    declared_signature_path: string | null
    declared_at: string
  }
  answers: {
    item_id: string
    value: Answer['value']
    observation: string | null
    responsible: string | null
    due_date: string | null
  }[]
}

export class UnsignedInspectionError extends Error {
  constructor(id: string) {
    super(`Inspection ${id} has not been signed and cannot be uploaded`)
    this.name = 'UnsignedInspectionError'
  }
}

export function toSubmitPayload(
  inspection: Inspection,
  answers: readonly Answer[],
  signaturePath: string | null,
): SubmitPayload {
  // The server column is NOT NULL: an unsigned draft has no business here.
  if (!inspection.declaredByName || !inspection.declaredAt) {
    throw new UnsignedInspectionError(inspection.id)
  }

  return {
    inspection: {
      id: inspection.id,
      template_id: inspection.templateId,
      template_version: inspection.templateVersion,
      vehicle_type: inspection.vehicleType,
      plate: inspection.plate,
      brand: inspection.brand,
      model: inspection.model,
      year: inspection.year,
      driver_name: inspection.driverName,
      odometer_km: inspection.odometerKm,
      inspected_at: inspection.inspectedAt,
      general_observations: inspection.generalObservations,
      declared_by_name: inspection.declaredByName,
      declared_by_role: inspection.declaredByRole,
      declared_signature_path: signaturePath,
      declared_at: inspection.declaredAt,
    },
    // org_id, created_by and status are NOT sent: the server stamps those from
    // the caller's identity. A client must never get to choose its own org.
    answers: answers.map((a) => ({
      item_id: a.itemId,
      value: a.value,
      observation: a.observation,
      responsible: a.responsible,
      due_date: a.dueDate,
    })),
  }
}
