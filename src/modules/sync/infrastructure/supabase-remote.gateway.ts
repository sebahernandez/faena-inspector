import { supabase } from '@/modules/auth/infrastructure/supabase-client'
import { db as defaultDb, type FaenaDB } from '@/shared/db/db'
import { toBlob } from '@/modules/inspection/infrastructure/dexie-inspection.repository'
import type { SubmitPayload } from '@/modules/inspection/application/submit-payload'
import type { PhotoUpload, RemoteGateway } from '../application/ports'

/** Supabase returns errors instead of throwing; give them a shape retry.ts reads. */
const fail = (
  message: string,
  extra: { status?: number | undefined; code?: string | undefined } = {},
): never => {
  const error = new Error(message) as Error & { status?: number; code?: string }
  if (extra.status !== undefined) error.status = extra.status
  if (extra.code !== undefined) error.code = extra.code
  throw error
}

/** Supabase's storage error carries the HTTP status as a string. */
const statusOf = (error: unknown): number | undefined => {
  const raw = (error as { statusCode?: string | number } | null)?.statusCode
  const n = typeof raw === 'string' ? Number(raw) : raw
  return Number.isFinite(n) ? (n as number) : undefined
}

export function createSupabaseRemoteGateway(db: FaenaDB = defaultDb): RemoteGateway {
  return {
    async canSync() {
      if (!supabase) return false
      const { data } = await supabase.auth.getSession()
      return data.session !== null
    },

    /**
     * Storage first, then the row. If this succeeds and the RPC then fails, the
     * retry re-uploads to the same deterministic path and overwrites — no
     * orphans, no duplicates.
     */
    async uploadSignature(inspectionId: string) {
      const client = supabase
      if (!client) return fail('not authenticated')

      const row = await db.inspections.get(inspectionId)
      if (!row?.declaredSignature) return null

      const { data: auth } = await client.auth.getUser()
      const user = auth.user
      if (!user) return fail('not authenticated', { status: 401 })

      const path = `${user.id}/${inspectionId}/declared.png`
      const { error } = await client.storage
        .from('signatures')
        .upload(path, toBlob(row.declaredSignature), {
          contentType: 'image/png',
          upsert: true,
        })

      if (error) fail(error.message, { status: statusOf(error) })
      return path
    },

    /**
     * Storage first, then the row — and the row only through the RPC, because
     * answer_photos has no INSERT policy. Re-uploading to the same path
     * overwrites, so a retry leaves no orphan.
     */
    async uploadPhoto(photo: PhotoUpload) {
      const client = supabase
      if (!client) return fail('not authenticated')

      const { data: auth } = await client.auth.getUser()
      const user = auth.user
      if (!user) return fail('not authenticated', { status: 401 })

      const path = `${user.id}/${photo.inspectionId}/${photo.id}.jpg`
      const { error: uploadError } = await client.storage
        .from('evidence')
        .upload(path, photo.image, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) fail(uploadError.message, { status: statusOf(uploadError) })

      const { error } = await client.rpc('record_photo', {
        p_id: photo.id,
        p_inspection_id: photo.inspectionId,
        p_item_id: photo.itemId,
        p_storage_path: path,
      })
      if (error) fail(error.message, { code: error.code })

      return path
    },

    async submitInspection(payload: SubmitPayload) {
      const client = supabase
      if (!client) return fail('not authenticated')

      const { error } = await client.rpc('submit_inspection', {
        p_inspection: payload.inspection,
        p_answers: payload.answers,
      })

      if (error) fail(error.message, { code: error.code })
    },
  }
}
