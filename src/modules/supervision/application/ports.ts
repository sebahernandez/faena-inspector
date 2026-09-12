import type { InspectionSummary, ReviewAnswer } from '../domain/review'

export interface InspectionDetail {
  summary: InspectionSummary
  declaredByUserId: string | null
  generalObservations: string | null
  answers: ReviewAnswer[]
  photos: { id: string; itemId: string; url: string }[]
}

export class SupervisionUnavailableError extends Error {
  constructor() {
    super('El panel necesita conexión y una sesión iniciada.')
    this.name = 'SupervisionUnavailableError'
  }
}

/**
 * The panel's window onto the server.
 *
 * Unlike the inspector side, these calls are allowed — expected — to fail when
 * there is no network. The panel is the online half of the app and says so.
 */
export interface SupervisionGateway {
  isAvailable(): boolean
  listInspections(filter: 'pending' | 'approved' | 'all'): Promise<InspectionSummary[]>
  getInspection(id: string): Promise<InspectionDetail | null>
  approve(id: string, signature: Blob | null): Promise<void>
}
