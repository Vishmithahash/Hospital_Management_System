import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import apiClient from '../../app/apiClient.js'
import { appointmentSlotSchema } from '../../lib/validators.js'
import { toastError } from '../../app/toastHelpers.js'

const doctorOptions = [
  { id: 'doctor-1', name: 'Dr. Rivera' },
  { id: 'doctor-2', name: 'Dr. Patel' },
  { id: 'doctor-3', name: 'Dr. Gomez' }
]

export default function SlotPicker({ onBook }) {
  const [doctorId, setDoctorId] = useState(doctorOptions[0].id)
  const [day, setDay] = useState(dayjs().format('YYYY-MM-DD'))
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [patientId, setPatientId] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchSlots = useMemo(() => {
    return async (doctor, date) => {
      if (!doctor || !date) {
        setSlots([])
        setSelectedSlot(null)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const { data } = await apiClient.get(`/appointments/${doctor}/slots`, {
          params: { day: date },
          skipErrorToast: true
        })
        setSlots(data)

        const firstAvailable = data.find((slot) => slot.available)
        setSelectedSlot(firstAvailable || null)
      } catch (err) {
        setSlots([])
        setSelectedSlot(null)
        const message = err.response?.data?.message || 'Unable to load availability'
        setError(message)
        toastError(message)
      } finally {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchSlots(doctorId, day)
  }, [doctorId, day, fetchSlots])

  const handleSubmit = (event) => {
    event.preventDefault()
    setError(null)

    if (!selectedSlot) {
      setError('Select a slot first')
      return
    }

    if (!selectedSlot.available) {
      setError('Slot is no longer available')
      return
    }

    if (!patientId) {
      setError('Patient ID required to book')
      return
    }

    const payload = {
      patientId,
      doctorId,
      startsAt: selectedSlot.startsAt,
      endsAt: selectedSlot.endsAt,
      reason
    }

    const validation = appointmentSlotSchema.safeParse(payload)

    if (!validation.success) {
      setError(validation.error.errors[0]?.message || 'Slot details invalid')
      return
    }

    onBook?.(payload)
    setReason('')
  }

  return (
    <form style={form} onSubmit={handleSubmit}>
      <div style={row}>
        <label style={label}>
          Patient ID
          <input
            style={input}
            placeholder="patient id"
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
          />
        </label>
        <label style={label}>
          Doctor
          <select style={input} value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
            {doctorOptions.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          Day
          <input
            style={input}
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
      </div>

      <div style={slotList}>
        {loading ? (
          <p>Loading slots…</p>
        ) : slots.length ? (
          slots.map((slot, index) => (
            <button
              type="button"
              key={`${slot.startsAt}-${index}`}
              style={slotButton(selectedSlot?.startsAt === slot.startsAt, slot.available)}
              disabled={!slot.available}
              onClick={() => setSelectedSlot(slot)}
            >
              <span>{dayjs(slot.startsAt).format('MMM D, HH:mm')}</span>
              <small>{slot.available ? 'Available' : 'Booked'}</small>
            </button>
          ))
        ) : (
          <p>No availability for this day.</p>
        )}
      </div>

      <label style={label}>
        Reason (optional)
        <textarea
          style={textarea}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      {error ? <p style={errorText}>{error}</p> : null}

      <button type="submit" style={primaryButton} disabled={!selectedSlot || !selectedSlot.available}>
        Book appointment
      </button>
    </form>
  )
}

const form = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const row = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '1rem'
}

const label = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
}

const input = {
  height: '2.5rem',
  borderRadius: '0.75rem',
  border: '1px solid #dbeafe',
  padding: '0 0.75rem'
}

const slotList = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '0.75rem'
}

const slotButton = (active, available) => ({
  borderRadius: '0.85rem',
  border: active ? '2px solid #0ea5e9' : '1px solid #cbd5f5',
  padding: '0.75rem',
  cursor: available ? 'pointer' : 'not-allowed',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  background: available
    ? active
      ? 'rgba(14, 165, 233, 0.1)'
      : '#fff'
    : 'rgba(226, 232, 240, 0.6)',
  color: available ? '#0f172a' : '#94a3b8'
})

const textarea = {
  borderRadius: '0.75rem',
  border: '1px solid #cbd5f5',
  padding: '0.75rem'
}

const primaryButton = {
  alignSelf: 'flex-start',
  background: '#0ea5e9',
  color: '#fff',
  border: 'none',
  borderRadius: '9999px',
  padding: '0.6rem 1.5rem',
  cursor: 'pointer'
}

const errorText = {
  color: '#ef4444'
}
