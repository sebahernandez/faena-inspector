import { z } from 'zod'

export const userRoleSchema = z.enum(['inspector', 'supervisor', 'admin'])
export type UserRole = z.infer<typeof userRoleSchema>

export const sessionSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  orgId: z.string().min(1),
  fullName: z.string().min(1),
  jobTitle: z.string().nullable(),
  role: userRoleSchema,
})
export type Session = z.infer<typeof sessionSchema>

export const canApprove = (session: Session | null): boolean =>
  session?.role === 'supervisor' || session?.role === 'admin'

export const canPublishTemplates = (session: Session | null): boolean => session?.role === 'admin'
