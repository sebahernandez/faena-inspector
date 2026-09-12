import { v7 as uuidv7 } from 'uuid'

/**
 * UUID v7: time-ordered, so it indexes well and sorts by creation.
 *
 * Generated on the DEVICE, never by the server. That is what makes uploads
 * idempotent: retrying a submission a hundred times still yields one row,
 * because the id travelled with it from the start.
 */
export const newId = (): string => uuidv7()
