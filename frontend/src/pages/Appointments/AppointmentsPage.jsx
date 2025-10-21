import { useCallback, useEffect, useState } from 'react'
import apiClient from '../../app/apiClient.js'
import EmptyState from '../../components/EmptyState.jsx'
import ErrorBanner from '../../components/ErrorBanner.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import SlotPicker from './SlotPicker.jsx'
import RescheduleDialog from './RescheduleDialog.jsx'
import { formatDateTime } from '../../lib/formatters.js'
import { toastError, toastInfo, toastSuccess, toastWarning } from '../../app/toastHelpers.js'

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [cancelId, setCancelId] = useState(null)
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
      const message = err.response?.data?.message || 'Failed to load appointments'
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
        throw err
      }
    }
  }

  const handleCancel = async () => {
    try {
      const { data } = await apiClient.patch(`/appointments/${cancelId}/cancel`, null, {
        skipErrorToast: true
      })
      setAppointments((prev) => prev.map((item) => (item._id === data._id ? data : item)))
      toastInfo('Slot released for others', 'Appointment cancelled')
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to cancel appointment'
      toastError(message, 'Cancel failed')
    } finally {
      setCancelId(null)
    }
  }

  const handleReschedule = async (payload) => {
    if (!selectedAppointment) return

    try {
      const { data } = await apiClient.patch(
        `/appointments/${selectedAppointment._id}/reschedule`,
        payload,
        { skipErrorToast: true }
      )
      setAppointments((prev) => prev.map((item) => (item._id === data._id ? data : item)))
      toastSuccess(`New time: ${formatDateTime(data.startsAt)}`, 'Appointment moved')
    } catch (err) {
      if (err.response?.status === 409) {
        toastWarning('That slot was not available.', 'Conflict')
      } else {
        const message = err.response?.data?.message || 'Failed to reschedule appointment'
        toastError(message, 'Reschedule failed')
      }
    } finally {
      setSelectedAppointment(null)
    }
  }

  return (
    <main style={layout}>
      <header>
        <h2 style={{ marginBottom: '0.5rem' }}>Appointments</h2>
        <p style={{ color: '#64748b' }}>
          Book new slots, manage cancellations, and reschedule with policy guardrails.
        </p>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadAppointments} /> : null}

      <section style={grid}>
        <div style={card}>
          <h3 style={cardTitle}>Upcoming</h3>
          {loading ? (
            <p>Loading...</p>
          ) : appointments.length ? (
            <ul style={list}>
              {appointments.map((appointment) => (
                <li key={appointment._id} style={item}>
                  <div>
                    <strong>{formatDateTime(appointment.startsAt)}</strong>
                    <p style={subText}>Doctor: {appointment.doctorId || '-'}</p>
                    <p style={statusBadge(appointment.status)}>{appointment.status}</p>
                  </div>
                  <div style={itemActions}>
                    <button style={linkButton} onClick={() => setSelectedAppointment(appointment)}>
                      Reschedule
                    </button>
                    <button style={dangerButton} onClick={() => setCancelId(appointment._id)}>
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No upcoming slots" message="Book a new appointment to get started." />
          )}
        </div>
        <div style={card}>
          <h3 style={cardTitle}>Book new slot</h3>
          <SlotPicker onBook={handleBook} />
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(cancelId)}
        title="Cancel appointment?"
        message={`This slot will become available for others. Cancellations are blocked within ${policy.cancelCutoffHours} hours of the appointment.`}
        confirmText="Cancel appointment"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />

      <RescheduleDialog
        open={Boolean(selectedAppointment)}
        appointment={selectedAppointment}
        onSubmit={handleReschedule}
        onClose={() => setSelectedAppointment(null)}
      />
    </main>
  )
}

const layout = {
  padding: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
}

const grid = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 1fr',
  gap: '1.5rem'
}

const card = {
  background: '#fff',
  borderRadius: '1rem',
  padding: '1.5rem',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const cardTitle = {
  margin: 0
}

const list = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const item = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '1rem'
}

const subText = {
  margin: '0.25rem 0',
  color: '#64748b'
}

const itemActions = {
  display: 'flex',
  gap: '0.75rem'
}

const linkButton = {
  background: 'transparent',
  border: 'none',
  color: '#0ea5e9',
  cursor: 'pointer',
  fontSize: '0.95rem'
}

const dangerButton = {
  ...linkButton,
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
