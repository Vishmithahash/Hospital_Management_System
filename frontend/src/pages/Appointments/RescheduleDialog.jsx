import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

export default function RescheduleDialog({
  open,
  appointment,
  onSubmit,
  onClose,
  errorMessage = '',
  submitting = false,
  doctorOptions = []
}) {
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (appointment) {
      setStartsAt(dayjs(appointment.startsAt).format('YYYY-MM-DDTHH:mm'))
      setEndsAt(dayjs(appointment.endsAt).format('YYYY-MM-DDTHH:mm'))
      setDoctorId(appointment.doctorId || '')
      setLocalError('')
    }
  }, [appointment])

  useEffect(() => {
    if (!open) {
      setLocalError('')
    }
  }, [open])

  if (!open) {
    return null
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setLocalError('')

    const startDate = dayjs(startsAt)
    const endDate = dayjs(endsAt)

    if (!startDate.isValid()) {
      setLocalError('Enter a valid start time')
      return
    }

    if (!endDate.isValid()) {
      setLocalError('Enter a valid end time')
      return
    }

    if (!endDate.isAfter(startDate)) {
      setLocalError('End time must be after the start time')
      return
    }

    if (doctorOptions.length) {
      const chosen = (doctorId || '').trim()
      if (!chosen) {
        setLocalError('Select a doctor for this appointment')
        return
      }
    }

    const payload = {
      startsAt: startDate.toDate().toISOString(),
      endsAt: endDate.toDate().toISOString()
    }

    if (doctorOptions.length) {
      payload.doctorId = doctorId
    }

    onSubmit?.(payload)
  }

  return (
    <div style={backdrop}>
      <form style={dialog} onSubmit={handleSubmit}>
        <h3 style={title}>Reschedule appointment</h3>
        <p style={subtitle}>
          Current: {dayjs(appointment?.startsAt).format('MMM D, HH:mm')} →{' '}
          {dayjs(appointment?.endsAt).format('HH:mm')}
        </p>
        <label style={label}>
          New start
          <input
            type="datetime-local"
            style={input}
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
            disabled={submitting}
          />
        </label>
        <label style={label}>
          New end
          <input
            type="datetime-local"
            style={input}
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
            disabled={submitting}
          />
        </label>
        {doctorOptions.length ? (
          <label style={label}>
            Doctor
            <select
              style={select}
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              disabled={submitting}
              required
            >
              <option value="">Select a doctor</option>
              {doctorOptions.map((doctor) => (
                <option key={doctor.value} value={doctor.value}>
                  {doctor.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {(localError || errorMessage) ? (
          <div style={errorBox}>{localError || errorMessage}</div>
        ) : null}
        <div style={actions}>
          <button type="button" style={secondary} onClick={onClose} disabled={submitting}>
            Close
          </button>
          <button type="submit" style={primary} disabled={submitting}>
            {submitting ? 'Rescheduling…' : 'Reschedule'}
          </button>
        </div>
      </form>
    </div>
  )
}

const backdrop = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}

const dialog = {
  background: '#fff',
  padding: '2rem',
  borderRadius: '1rem',
  width: '420px',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  boxShadow: '0 30px 60px rgba(15, 23, 42, 0.25)'
}

const title = {
  margin: 0
}

const subtitle = {
  margin: 0,
  color: '#64748b'
}

const label = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
}

const input = {
  borderRadius: '0.75rem',
  border: '1px solid #dbeafe',
  padding: '0.5rem 0.75rem'
}

const actions = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem'
}

const primary = {
  border: 'none',
  borderRadius: '9999px',
  padding: '0.5rem 1.5rem',
  background: '#0ea5e9',
  color: '#fff',
  cursor: 'pointer'
}

const secondary = {
  ...primary,
  background: '#e2e8f0',
  color: '#0f172a'
}

const errorBox = {
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  color: '#991b1b',
  borderRadius: '0.75rem',
  padding: '0.5rem 0.75rem'
}

const select = {
  ...input
}
