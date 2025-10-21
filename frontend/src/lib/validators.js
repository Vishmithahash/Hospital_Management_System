import { z } from 'zod'

export const patientFormSchema = z.object({
  demographics: z.object({
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    dob: z.string().min(1, 'Date of birth is required'),
    gender: z.enum(['male', 'female', 'other'], {
      errorMap: () => ({ message: 'Gender is required' })
    }),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{7,20}$/, 'Phone number is invalid')
      .optional()
      .or(z.literal('')),
    email: z.string().trim().email('Email address is invalid').optional().or(z.literal('')),
    address: z.string().trim().max(500, 'Address is too long').optional().or(z.literal('')),
    bloodGroup: z
      .string()
      .trim()
      .regex(/^(A|B|AB|O)[+-]$/i, 'Blood group must be like A+, O-, AB+')
      .optional()
      .or(z.literal('')),
    emergencyContact: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{7,20}$/, 'Emergency contact number is invalid')
      .optional()
      .or(z.literal(''))
  }),
  insurance: z
    .object({
      provider: z.string().trim().min(1, 'Provider is required'),
      policyNo: z.string().trim().min(1, 'Policy number is required'),
      validUntil: z.string().trim().min(1, 'Valid until is required')
    })
    .partial()
})

export const appointmentSlotSchema = z.object({
  patientId: z.string().trim().min(1, 'Patient is required'),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  doctorId: z.string().min(1, 'Doctor is required')
})

export const insurancePaymentSchema = z.object({
  provider: z.string().trim().min(1),
  policyNo: z.string().trim().min(1),
  validUntil: z.string().trim().min(1)
})

export const cardPaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero')
})
