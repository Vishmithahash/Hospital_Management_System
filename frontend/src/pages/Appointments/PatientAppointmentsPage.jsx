import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../app/apiClient.js'
import { useAuthStore } from '../../app/store.js'
import EmptyState from '../../components/EmptyState.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import PatientSlotPicker from './PatientSlotPicker.jsx'
import PatientWaitlistPanel from './PatientWaitlistPanel.jsx'
import { formatDateTime } from '../../lib/formatters.js'
import { layout as defaultLayout, card, cardHeader, cardTitle } from '../Records/recordStyles.js'
import { toastError, toastInfo, toastSuccess, toastWarning } from '../../app/toastHelpers.js'

export default function PatientAppointmentsPage({ layoutStyle }) {
  const { user, token } = useAuthStore()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [policy, setPolicy] = useState({ cancelCutoffHours: 12 })

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data } = await apiClient
        .get('/appointments', { skipErrorToast: true })
        .catch((err) => {
          if (err.response?.status === 404) {
            return { data: [] }
          }
          throw err
        })

      setAppointments(Array.isArray(data) ? data : [])
    } catch (err) {
      const status = err.response?.status
      const message = err.response?.data?.message || 'Failed to load appointments'
      if (status === 403 && /not linked/i.test(message || '')) {
        try {
          await apiClient.post('/users/link-patient', null, { skipErrorToast: true })
          const { data: me } = await apiClient.get('/auth/me', { skipErrorToast: true })
          useAuthStore.getState().setUser(me.user)
          // retry once after linking
          const { data } = await apiClient.get('/appointments', { skipErrorToast: true })
          setAppointments(Array.isArray(data) ? data : [])
          setError(null)
          return
        } catch (_) {}
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPolicy = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/appointments/policy', { skipErrorToast: true })
      setPolicy(data)
    } catch (err) {
      console.error('Failed to load policy', err)
    }
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  useEffect(() => {
    loadPolicy()
  }, [loadPolicy])

  const handleBook = async (slot) => {
    try {
      const { data } = await apiClient.post('/appointments', slot, { skipErrorToast: true })
      setAppointments((prev) => [...prev, data])
      toastSuccess(`Scheduled for ${formatDateTime(data.startsAt)}`, 'Appointment booked')
    } catch (err) {
      if (err.response?.status === 409) {
        toastWarning('That time was just taken. Try another slot.', 'Slot taken')
      } else {
        const message = err.response?.data?.message || 'Unable to book appointment'
        toastError(message, 'Book failed')
      }
    }
  }

  // Reschedule/Cancel actions moved to View Appointments page

  const pageState = useMemo(() => {
    if (!user) {
      if (!token) return 'unauthorized'
      return 'loadingUser'
    }
    return 'ready'
  }, [user, token])

  if (pageState === 'unauthorized') {
    return (
      <main style={defaultLayout}>
        <EmptyState title="Access restricted" message="Please sign in to manage your appointments." />
      </main>
    )
  }

  if (pageState === 'loadingUser') {
    return (
      <main style={defaultLayout}>
        <p>Loading your account...</p>
      </main>
    )
  }

  return (
    <main style={layoutStyle || defaultLayout}>
      <header>
        <h2 style={{ marginBottom: '0.25rem' }}>Manage Appointments</h2>
        <p style={{ color: '#64748b' }}>
          Book, reschedule, or cancel your upcoming appointments.
        </p>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadAppointments} /> : null}

      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={cardTitle}>Book an appointment</h3>
          <button
            type="button"
            style={{ border: 'none', borderRadius: '9999px', padding: '0.5rem 1rem', background: '#0ea5e9', color: '#fff', cursor: 'pointer' }}
            onClick={() => navigate('/appointments/viewappointment')}
          >
            View appointments
          </button>
        </div>
        <PatientSlotPicker onBook={handleBook} />
      </section>

      <section style={card}>
        <PatientWaitlistPanel />
      </section>

      {/* Actions & logs removed per requirements; use View appointments for management */}
    </main>
  )
}

const list = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
}

const item = (active) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: active ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '0.85rem',
  background: active ? 'rgba(14, 165, 233, 0.06)' : '#fff',
  cursor: 'pointer'
})

const miniActions = {
  display: 'flex',
  gap: '0.5rem'
}

const subText = {
  margin: '0.25rem 0',
  color: '#64748b'
}

const linkButton = {
  background: 'transparent',
  border: '1px solid #93c5fd',
  color: '#0ea5e9',
  borderRadius: '9999px',
  padding: '0.25rem 0.75rem',
  cursor: 'pointer',
  fontSize: '0.9rem'
}

const dangerButton = {
  ...linkButton,
  border: '1px solid #fecaca',
  color: '#ef4444'
}

const statusBadge = (status) => ({
  display: 'inline-block',
  marginTop: '0.25rem',
  padding: '0.2rem 0.5rem',
  borderRadius: '9999px',
  background: status === 'CANCELLED' ? '#fee2e2' : '#dbeafe',
  color: status === 'CANCELLED' ? '#b91c1c' : '#1d4ed8',
  fontSize: '0.75rem'
})

const approveButton = {
  border: 'none',
  borderRadius: '0.75rem',
  padding: '0.6rem 1rem',
  background: '#22c55e',
  color: '#fff',
  cursor: 'pointer'
}

const rejectButton = {
  ...approveButton,
  background: '#ef4444'
}

const noteBox = {
  padding: '0.75rem',
  border: '1px dashed #f59e0b',
  borderRadius: '0.75rem',
  background: 'rgba(254, 243, 199, 0.5)',
  color: '#92400e',
  fontSize: '0.9rem'
}

const logList = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
}

const logDot = (color) => ({
  display: 'inline-block',
  width: '8px',
  height: '8px',
  borderRadius: '9999px',
  background: color,
  marginRight: '0.5rem'
})

const logMeta = {
  color: '#64748b',
  fontSize: '0.8rem'
}
