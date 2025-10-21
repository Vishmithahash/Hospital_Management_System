import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import apiClient from '../../app/apiClient.js'
import { patientFormSchema } from '../../lib/validators.js'
import { formatDate } from '../../lib/formatters.js'
import { toastSuccess, toastWarning } from '../../app/toastHelpers.js'

function toDefaultValues(patient) {
  if (!patient) {
    return {
      demographics: {
        firstName: '',
        lastName: '',
        dob: '',
        gender: 'male',
        phone: '',
        email: '',
        address: '',
        bloodGroup: '',
        emergencyContact: ''
      },
      insurance: {
        provider: '',
        policyNo: '',
        validUntil: ''
      }
    }
  }

  return {
    demographics: {
      firstName: patient.demographics?.firstName || '',
      lastName: patient.demographics?.lastName || '',
      dob: patient.demographics?.dob ? formatDate(patient.demographics.dob) : '',
      gender: patient.demographics?.gender || 'male',
      phone: patient.demographics?.phone || '',
      email: patient.demographics?.email || '',
      address: patient.demographics?.address || '',
      bloodGroup: patient.demographics?.bloodGroup || '',
      emergencyContact: patient.demographics?.emergencyContact || ''
    },
    insurance: {
      provider: patient.insurance?.provider || '',
      policyNo: patient.insurance?.policyNo || '',
      validUntil: patient.insurance?.validUntil ? formatDate(patient.insurance.validUntil) : ''
    }
  }
}

export default function RecordEditForm({ patient, loading, onUpdated }) {
  const defaultValues = useMemo(() => toDefaultValues(patient), [patient])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch
  } = useForm({
    resolver: zodResolver(patientFormSchema),
    defaultValues
  })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const insuranceValues = watch('insurance')

  const onSubmit = async (values) => {
    if (!patient?._id) {
      toastWarning('Select a patient before saving changes.', 'No patient loaded')
      return
    }

    const payload = {
      demographics: {
        ...values.demographics,
        phone: values.demographics.phone || undefined,
        email: values.demographics.email || undefined
      }
    }

    const hasInsurance =
      values.insurance?.provider && values.insurance?.policyNo && values.insurance?.validUntil

    if (hasInsurance) {
      payload.insurance = values.insurance
    }

    try {
      const { data } = await apiClient.put(`/patients/${patient._id}`, payload, {
        headers: {
          'If-Match': patient.__v
        }
      })

      toastSuccess('Record saved successfully', 'Patient updated')

      onUpdated?.(data)
    } catch (error) {
      if (error.response?.status === 409) {
        toastWarning('The record was updated by someone else. Refresh and try again.', 'Version mismatch')
      } else {
        throw error
      }
    }
  }

  return (
    <form style={form} onSubmit={handleSubmit(onSubmit)}>
      <fieldset style={fieldset} disabled={loading || isSubmitting || !patient}>
        <legend style={legend}>Demographics</legend>
        <div style={grid}>
          <label style={label}>
            First name
            <input style={input} {...register('demographics.firstName')} />
            {errors.demographics?.firstName ? (
              <span style={errorText}>{errors.demographics.firstName.message}</span>
            ) : null}
          </label>
          <label style={label}>
            Last name
            <input style={input} {...register('demographics.lastName')} />
            {errors.demographics?.lastName ? (
              <span style={errorText}>{errors.demographics.lastName.message}</span>
            ) : null}
          </label>
        </div>
        <div style={grid}>
          <label style={label}>
            Date of birth
            <input type="date" style={input} {...register('demographics.dob')} />
            {errors.demographics?.dob ? (
              <span style={errorText}>{errors.demographics.dob.message}</span>
            ) : null}
          </label>
          <label style={label}>
            Gender
            <select style={input} {...register('demographics.gender')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {errors.demographics?.gender ? (
              <span style={errorText}>{errors.demographics.gender.message}</span>
            ) : null}
          </label>
        </div>
        <div style={grid}>
          <label style={label}>
            Phone
            <input style={input} {...register('demographics.phone')} />
            {errors.demographics?.phone ? (
              <span style={errorText}>{errors.demographics.phone.message}</span>
            ) : null}
          </label>
          <label style={label}>
            Email
            <input style={input} type="email" {...register('demographics.email')} />
            {errors.demographics?.email ? (
              <span style={errorText}>{errors.demographics.email.message}</span>
            ) : null}
          </label>
        </div>
        <div style={grid}>
          <label style={label}>
            Address
            <input style={input} {...register('demographics.address')} />
            {errors.demographics?.address ? (
              <span style={errorText}>{errors.demographics.address.message}</span>
            ) : null}
          </label>
          <label style={label}>
            Blood group
            <input style={input} placeholder="e.g., A+" {...register('demographics.bloodGroup')} />
            {errors.demographics?.bloodGroup ? (
              <span style={errorText}>{errors.demographics.bloodGroup.message}</span>
            ) : null}
          </label>
        </div>
        <div style={grid}>
          <label style={label}>
            Emergency contact
            <input style={input} {...register('demographics.emergencyContact')} />
            {errors.demographics?.emergencyContact ? (
              <span style={errorText}>{errors.demographics.emergencyContact.message}</span>
            ) : null}
          </label>
        </div>
      </fieldset>

      <fieldset style={fieldset} disabled={loading || isSubmitting || !patient}>
        <legend style={legend}>Insurance</legend>
        <div style={grid}>
          <label style={label}>
            Provider
            <input style={input} {...register('insurance.provider')} />
            {errors.insurance?.provider ? (
              <span style={errorText}>{errors.insurance.provider.message}</span>
            ) : null}
          </label>
          <label style={label}>
            Policy number
            <input style={input} {...register('insurance.policyNo')} />
            {errors.insurance?.policyNo ? (
              <span style={errorText}>{errors.insurance.policyNo.message}</span>
            ) : null}
          </label>
        </div>
        <div style={grid}>
          <label style={label}>
            Valid until
            <input type="date" style={input} {...register('insurance.validUntil')} />
            {errors.insurance?.validUntil ? (
              <span style={errorText}>{errors.insurance.validUntil.message}</span>
            ) : null}
          </label>
        </div>
        {!insuranceValues?.provider && !insuranceValues?.policyNo ? (
          <p style={hint}>Leave blank if the patient does not have insurance on file.</p>
        ) : null}
      </fieldset>

      <div style={actions}>
        <button type="submit" style={primaryButton} disabled={loading || isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

const form = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
}

const fieldset = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '1rem 1.25rem'
}

const legend = {
  padding: '0 0.5rem',
  fontWeight: 600
}

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem'
}

const label = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.9rem'
}

const input = {
  height: '2.5rem',
  padding: '0 0.75rem',
  borderRadius: '0.65rem',
  border: '1px solid #cbd5f5',
  fontSize: '1rem',
  background: '#f8fafc'
}

const errorText = {
  color: '#ef4444',
  fontSize: '0.8rem'
}

const hint = {
  marginTop: '0.5rem',
  fontSize: '0.85rem',
  color: '#64748b'
}

const actions = {
  display: 'flex',
  justifyContent: 'flex-end'
}

const primaryButton = {
  padding: '0.6rem 1.5rem',
  borderRadius: '9999px',
  background: '#0ea5e9',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem'
}
