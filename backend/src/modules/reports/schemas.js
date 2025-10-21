const { z } = require('zod');

const REPORT_TYPES = ['DAILY_VISITS', 'APPT_LOAD', 'PEAK_HOURS', 'PAYMENT_SUMMARY'];

const RangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/g, 'Expected YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/g, 'Expected YYYY-MM-DD')
});

const FiltersSchema = z
  .object({
    departmentId: z.string().trim().optional(),
    branchId: z.string().trim().optional(),
    doctorId: z.string().trim().optional(),
    paymentMethod: z.enum(['CARD', 'CASH', 'GOVERNMENT']).optional()
  })
  .optional();

const GenerateSchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    range: RangeSchema,
    filters: FiltersSchema,
    preview: z.boolean().optional(),
    regenerate: z.boolean().optional()
  })
  .superRefine((val, ctx) => {
    const from = new Date(val.range.from + 'T00:00:00');
    const to = new Date(val.range.to + 'T00:00:00');
    if (from.getTime() > to.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid range: from > to', path: ['range', 'from'] });
    }
    const today = new Date();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    if (to.getTime() > endOfToday.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Range cannot be in the future', path: ['range', 'to'] });
    }
  });

module.exports = {
  REPORT_TYPES,
  RangeSchema,
  FiltersSchema,
  GenerateSchema
};

