import { supabase } from '@/modules/auth/infrastructure/supabase-client'
import {
  toReviewAnswer,
  toSummary,
  type AnswerRow,
  type SummaryRow,
} from '../application/row-mapping'
import { SupervisionUnavailableError, type SupervisionGateway } from '../application/ports'

export function createSupabaseSupervisionGateway(): SupervisionGateway {
  const client = () => {
    if (!supabase) throw new SupervisionUnavailableError()
    return supabase
  }

  return {
    isAvailable: () => supabase !== null,

    async listInspections(filter) {
      let query = client()
        .from('inspection_summaries')
        .select('*')
        .order('inspected_at', { ascending: false })

      if (filter !== 'all') query = query.eq('status', filter === 'pending' ? 'submitted' : 'approved')

      const { data, error } = await query.returns<SummaryRow[]>()
      if (error) throw new Error(error.message)
      return (data ?? []).map(toSummary)
    },

    async getInspection(id) {
      const db = client()

      const { data: summary, error } = await db
        .from('inspection_summaries')
        .select('*')
        .eq('id', id)
        .maybeSingle<SummaryRow>()
      if (error) throw new Error(error.message)
      if (!summary) return null

      const [{ data: answers }, { data: inspection }, { data: photos }] = await Promise.all([
        db
          .from('inspection_answers')
          .select('*')
          .eq('inspection_id', id)
          .order('section_position')
          .order('item_position')
          .returns<AnswerRow[]>(),
        db
          .from('inspections')
          .select('created_by, general_observations')
          .eq('id', id)
          .maybeSingle<{ created_by: string; general_observations: string | null }>(),
        db
          .from('answer_photos')
          .select('id, item_id, storage_path')
          .eq('inspection_id', id)
          .returns<{ id: string; item_id: string; storage_path: string }[]>(),
      ])

      // Signed URLs, not public ones: evidence is private to the organisation.
      const signed = await Promise.all(
        (photos ?? []).map(async (p) => {
          const { data } = await db.storage.from('evidence').createSignedUrl(p.storage_path, 3600)
          return { id: p.id, itemId: p.item_id, url: data?.signedUrl ?? '' }
        }),
      )

      return {
        summary: toSummary(summary),
        declaredByUserId: inspection?.created_by ?? null,
        generalObservations: inspection?.general_observations ?? null,
        answers: (answers ?? []).map(toReviewAnswer),
        photos: signed.filter((p) => p.url !== ''),
      }
    },

    async approve(id, signature) {
      const db = client()

      let path: string | null = null
      if (signature) {
        const { data: auth } = await db.auth.getUser()
        if (!auth.user) throw new SupervisionUnavailableError()

        path = `${auth.user.id}/${id}/approved.png`
        const { error } = await db.storage
          .from('signatures')
          .upload(path, signature, { contentType: 'image/png', upsert: true })
        if (error) throw new Error(error.message)
      }

      const { error } = await db.rpc('approve_inspection', {
        p_id: id,
        p_signature_path: path,
      })
      if (error) throw new Error(error.message)
    },
  }
}
