const dayjs = require('dayjs');
const { z } = require('zod');

const demographicsSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(100).optional(),
    lastName: z.string().trim().min(1, 'Last name is required').max(100).optional(),
    dob: z
      .coerce
      .date({ invalid_type_error: 'Date of birth must be a valid date' })
      .optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{7,20}$/, 'Phone number is invalid')
      .optional(),
    email: z.string().trim().email('Email address is invalid').optional(),
    address: z.string().trim().max(500).optional(),
    bloodGroup: z
      .string()
      .trim()
      .regex(/^(A|B|AB|O)[+-]$/i, 'Blood group must be like A+, O-, AB+')
      .optional(),
    emergencyContact: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{7,20}$/, 'Emergency contact number is invalid')
      .optional()
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one demographic field must be provided'
  )
  .optional();

const insuranceSchema = z
  .object({
    provider: z.string().trim().min(1, 'Insurance provider is required'),
    policyNo: z.string().trim().min(1, 'Policy number is required'),
    validUntil: z
      .coerce
      .date({ invalid_type_error: 'validUntil must be a valid date' })
      .refine(
        (date) => dayjs(date).isAfter(dayjs(), 'day'),
        'Policy must be valid in the future'
      )
  })
  .optional();

const careSchema = z
  .object({
    tests: z.array(z.string().trim().min(1)).max(20).optional(),
    diagnoses: z.array(z.string().trim().min(1)).max(20).optional(),
    plans: z.array(z.string().trim().min(1)).max(50).optional()
  })
  .optional()

const patientUpdateSchema = z
  .object({
    demographics: demographicsSchema,
    insurance: insuranceSchema,
    care: careSchema
  })
  .refine(
    (value) => value.demographics || value.insurance || value.care,
    'No changes provided'
  );

function validatePatientUpdate(body) {
  return patientUpdateSchema.parse(body);
}

module.exports = {
  patientUpdateSchema,
  validatePatientUpdate
};
