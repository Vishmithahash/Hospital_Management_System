import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import apiClient from '../../app/apiClient.js'
import { toastError, toastSuccess, toastWarning } from '../../app/toastHelpers.js'

export default function PatientWaitlistPanel() {
  const [doctors, setDoctors] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [desiredDate, setDesiredDate] = useState(dayjs().add(1, 'day').format('YYYY-MM-DD'))

  const doctorDirectory = useMemo(() => {
    const map = new Map()
    doctors.forEach((doc) => {
      map.set(doc.id, {
        label: doc.name,
        specialty: doc.specialty?.trim() || null
      })
    })
    return map
  }, [doctors])

  const loadDoctors = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/users/doctors', { skipErrorToast: true })
      const list = Array.isArray(data) ? data : []
      setDoctors(list)
      if (list.length && !selectedDoctor) {
        setSelectedDoctor(list[0].id)
      }
    } catch (err) {
      setDoctors([])
    }
  }, [selectedDoctor])

  const loadWaitlist = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await apiClient.get('/waitlist', { skipErrorToast: true })
      const entries = Array.isArray(data) ? data : []
      entries.sort((a, b) => new Date(a.desiredDate).getTime() - new Date(b.desiredDate).getTime())
      setWaitlist(entries)
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to load waitlist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDoctors()
  }, [loadDoctors])

  useEffect(() => {
    loadWaitlist()
  }, [loadWaitlist])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedDoctor) {
      toastWarning('Select a doctor before joining the waitlist')
      return
    }
    if (!desiredDate) {
      toastWarning('Pick a target date before joining the waitlist')
      return
    }
    const target = dayjs(desiredDate)
    if (!target.isValid()) {
      toastWarning('Chosen date is invalid')
      return
    }
    if (target.isBefore(dayjs(), 'day')) {
      toastWarning('Waitlist date cannot be in the past')
      setDesiredDate(dayjs().format('YYYY-MM-DD'))
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post(
        '/waitlist',
        {
          doctorId: selectedDoctor,
          desiredDate: target.startOf('day').toISOString()
        },
        { skipErrorToast: true }
      )
      toastSuccess('Added to the waitlist')
      await loadWaitlist()
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to join the waitlist'
      toastError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (id) => {
    try {
      await apiClient.delete(`/waitlist/${id}`, { skipErrorToast: true })
      toastSuccess('Removed from waitlist')
      setWaitlist((prev) => prev.filter((entry) => entry._id !== id))
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to remove waitlist entry'
      toastError(message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <h3 style={{ margin: 0 }}>Join the waitlist</h3>
        <p style={{ margin: 0, color: '#64748b' }}>
          No slots that work for you? Choose a doctor and a preferred day and we will notify you when a matching slot opens up.
        </p>
      </header>

      <form style={form} onSubmit={handleSubmit}>
        <label style={label}>
          Doctor
          <select
            style={input}
            value={selectedDoctor}
            onChange={(event) => setSelectedDoctor(event.target.value)}
            disabled={!doctors.length}
          >
            {doctors.length ? (
              doctors.map((doctor) => {
                const specialty = doctor.specialty?.trim()
                const descriptor = specialty ? `${doctor.name} (${specialty})` : doctor.name
                return (
                  <option key={doctor.id} value={doctor.id}>
                    {descriptor}
                  </option>
                )
              })
            ) : (
              <option value="">No doctors available</option>
            )}
          </select>
        </label>

        <label style={label}>
          Desired day
          <input
            style={input}
            type="date"
            value={desiredDate}
            min={dayjs().format('YYYY-MM-DD')}
            onChange={(event) => setDesiredDate(event.target.value)}
          />
        </label>

        <button type="submit" style={primaryButton} disabled={submitting || !selectedDoctor}>
          {submitting ? 'Joining…' : 'Join waitlist'}
        </button>
      </form>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h4 style={{ margin: 0 }}>Your requests</h4>
        {loading ? (
          <p style={{ color: '#64748b' }}>Loading waitlist…</p>
        ) : waitlist.length ? (
          <ul style={list}>
            {waitlist.map((entry) => {
              const doctorInfo = doctorDirectory.get(entry.doctorId)
              const name = doctorInfo?.label || entry.doctorId
              const specialty = doctorInfo?.specialty
              return (
                <li key={entry._id} style={item}>
                  <div>
                    <div style={doctorLine}>{name}</div>
                    {specialty ? <div style={sub}>{specialty}</div> : null}
                    <div style={sub}>Preferred day: {dayjs(entry.desiredDate).format('MMM D, YYYY')}</div>
                    <div style={meta}>Requested {dayjs(entry.createdAt).fromNow()}</div>
                  </div>
                  <button style={removeButton} onClick={() => handleRemove(entry._id)}>
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div style={emptyCard}>
            <p style={{ margin: 0, color: '#64748b' }}>You have no active waitlist requests.</p>
          </div>
        )}
      </section>
    </div>
  )
}

const form = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem',
  alignItems: 'end'
}

const label = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem'
}

const input = {
  height: '2.5rem',
  borderRadius: '0.75rem',
  border: '1px solid #dbeafe',
  padding: '0 0.75rem'
}

const primaryButton = {
  border: 'none',
  borderRadius: '9999px',
  padding: '0.6rem 1.5rem',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  justifySelf: 'flex-start'
}

const list = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
}

const item = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid #e2e8f0',
  borderRadius: '0.85rem',
  padding: '0.85rem',
  background: '#f8fafc'
}

const doctorLine = {
  fontWeight: 600,
  color: '#0f172a'
}

const sub = {
  color: '#475569',
  fontSize: '0.85rem'
}

const meta = {
  color: '#94a3b8',
  fontSize: '0.8rem',
  marginTop: '0.35rem'
}

const removeButton = {
  border: '1px solid #fecaca',
  borderRadius: '9999px',
  padding: '0.4rem 0.9rem',
  background: '#fff',
  color: '#dc2626',
  cursor: 'pointer'
}

const emptyCard = {
  border: '1px dashed #cbd5f5',
  borderRadius: '0.85rem',
  padding: '0.75rem',
  background: '#f8fafc'
}
