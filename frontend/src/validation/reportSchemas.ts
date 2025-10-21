import { z } from 'zod'

export const ReportTypeEnum = z.enum(['DAILY_VISITS', 'APPT_LOAD', 'PEAK_HOURS', 'PAYMENT_SUMMARY'])

export const RangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

export const FiltersSchema = z.object({
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
  doctorId: z.string().optional(),
  paymentMethod: z.enum(['CARD', 'CASH', 'GOVERNMENT']).optional()
})

export const GenerateSchema = z.object({
  type: ReportTypeEnum,
  range: RangeSchema,
  filters: FiltersSchema.optional(),
  preview: z.boolean().optional()
})

export type GeneratePayload = z.infer<typeof GenerateSchema>

