import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import apiClient from '../../app/apiClient.js'
import { appointmentSlotSchema } from '../../lib/validators.js'
import { toastError } from '../../app/toastHelpers.js'
import { useAuthStore } from '../../app/store.js'
import { toastSuccess } from '../../app/toastHelpers.js'

export default function PatientSlotPicker({ onBook }) {
  const { user } = useAuthStore()
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const today = dayjs().startOf('day')
  const [day, setDay] = useState(today.format('YYYY-MM-DD'))
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
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
        // Filter out past times when date is today
        const filtered = data.filter((slot) => dayjs(slot.startsAt).isAfter(dayjs()))
        setSlots(filtered)

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
    async function loadDoctors() {
      try {
        const { data } = await apiClient.get('/users/doctors', { skipErrorToast: true })
        setDoctors(Array.isArray(data) ? data : [])
        setSpecialtyFilter('all')
      } catch (_) {
        setDoctors([])
      }
    }
    loadDoctors()
  }, [])

  const specialtyOptions = useMemo(() => {
    const map = new Map()
    doctors.forEach((doctor) => {
      const raw = doctor.specialty?.trim() || ''
      const key = raw.toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          value: raw ? raw : 'unspecified',
          label: raw || 'No specialty set'
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [doctors])

  const filteredDoctors = useMemo(() => {
    if (specialtyFilter === 'all') {
      return doctors
    }
    if (specialtyFilter === 'unspecified') {
      return doctors.filter((doctor) => !doctor.specialty || !doctor.specialty.trim())
    }
    const target = specialtyFilter.toLowerCase()
    return doctors.filter(
      (doctor) => doctor.specialty && doctor.specialty.trim().toLowerCase() === target
    )
  }, [doctors, specialtyFilter])

  useEffect(() => {
    if (!filteredDoctors.length) {
      setDoctorId('')
      setSlots([])
      setSelectedSlot(null)
      return
    }

    if (!doctorId || !filteredDoctors.some((doctor) => doctor.id === doctorId)) {
      setDoctorId(filteredDoctors[0].id)
    }
  }, [filteredDoctors, doctorId])

  useEffect(() => {
    if (doctorId) {
      fetchSlots(doctorId, day)
    } else {
      setSlots([])
      setSelectedSlot(null)
    }
  }, [doctorId, day, fetchSlots])

  const handleSubmit = async (event) => {
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

    let patientId = user?.linkedPatientId
    if (!patientId) {
      try {
        await apiClient.post('/users/link-patient', null, { skipErrorToast: true })
        const { data: me } = await apiClient.get('/auth/me', { skipErrorToast: true })
        useAuthStore.getState().setUser(me.user)
        patientId = me.user.linkedPatientId
        toastSuccess('Linked your account to a new patient record', 'Linked')
      } catch (err) {
        setError('Your account is not linked to a patient record')
        return
      }
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
          Specialty
          <select
            style={input}
            value={specialtyFilter}
            onChange={(event) => setSpecialtyFilter(event.target.value)}
          >
            <option value="all">All specialties</option>
            {specialtyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          Doctor
          <select
            style={input}
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            disabled={!filteredDoctors.length}
          >
            {filteredDoctors.length ? (
              filteredDoctors.map((doctor) => {
                const specialty = doctor.specialty?.trim()
                const description = specialty
                  ? `${doctor.name} (${specialty})`
                  : `${doctor.name} — No specialty set`
                return (
                  <option key={doctor.id} value={doctor.id}>
                    {description}
                  </option>
                )
              })
            ) : (
              <option value="">No doctors available</option>
            )}
          </select>
        </label>
        <label style={label}>
          Day
          <input
            style={input}
            type="date"
            value={day}
            min={today.format('YYYY-MM-DD')}
            onChange={(event) => {
              const value = event.target.value
              // prevent selecting a past day
              if (dayjs(value).isBefore(today)) {
                setDay(today.format('YYYY-MM-DD'))
              } else {
                setDay(value)
              }
            }}
          />
        </label>
      </div>

      <div style={slotList}>
        {loading ? (
          <p>Loading slots...</p>
        ) : slots.length ? (
          slots.map((slot, index) => (
            <button
              type="button"
              key={`${slot.startsAt}-${index}`}
              style={slotButton(selectedSlot?.startsAt === slot.startsAt, slot.available && dayjs(slot.startsAt).isAfter(dayjs()))}
              disabled={!slot.available || !dayjs(slot.startsAt).isAfter(dayjs())}
              onClick={() => setSelectedSlot(slot)}
            >
              <span>{dayjs(slot.startsAt).format('MMM D, HH:mm')}</span>
              <small>{slot.available && dayjs(slot.startsAt).isAfter(dayjs()) ? 'Available' : 'Unavailable'}</small>
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
  background: '#10b981',
  color: '#fff',
  border: 'none',
  borderRadius: '9999px',
  padding: '0.6rem 1.5rem',
  cursor: 'pointer'
}

const errorText = {
  color: '#ef4444'
}
