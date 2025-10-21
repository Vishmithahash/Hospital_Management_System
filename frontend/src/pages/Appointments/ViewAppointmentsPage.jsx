import { useCallback, useEffect, useState } from 'react'
import apiClient from '../../app/apiClient.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import RescheduleDialog from './RescheduleDialog.jsx'
import { formatDateTime } from '../../lib/formatters.js'
import { toastError, toastInfo, toastSuccess, toastWarning } from '../../app/toastHelpers.js'

export default function ViewAppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const [rescheduleTarget, setRescheduleTarget] = useState(null)
  const [rescheduleError, setRescheduleError] = useState('')
  const [rescheduling, setRescheduling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiClient.get('/appointments', { skipErrorToast: true })
      setAppointments(Array.isArray(data) ? data : [])
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load appointments'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const handleCancel = async () => {
    try {
      const { data } = await apiClient.patch(`/appointments/${cancelId}/cancel`, null, { skipErrorToast: true })
      setAppointments((prev) => prev.map((item) => (item._id === data._id ? data : item)).filter((a) => new Date(a.startsAt).getTime() > Date.now()))
      toastInfo('Slot released for others', 'Appointment cancelled')
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to cancel appointment'
      toastError(message, 'Cancel failed')
    } finally {
      setCancelId(null)
    }
  }

  const handleReschedule = async (payload) => {
    if (!rescheduleTarget?._id) return
    setRescheduleError('')
    setRescheduling(true)
    try {
      const { data } = await apiClient.patch(`/appointments/${rescheduleTarget._id}/reschedule`, payload, { skipErrorToast: true })
      setAppointments((prev) => prev.map((item) => (item._id === data._id ? data : item)))
      toastSuccess(`New time: ${formatDateTime(data.startsAt)}`, 'Appointment moved')
      setRescheduleTarget(null)
    } catch (err) {
      if (err.response?.status === 409) {
        const message = 'That slot was not available.'
        setRescheduleError(message)
        toastWarning(message, 'Conflict')
      } else {
        const message = err.response?.data?.message || 'Failed to reschedule appointment'
        setRescheduleError(message)
        toastError(message, 'Reschedule failed')
      }
    } finally {
      setRescheduling(false)
    }
  }

  return (
    <main style={layout}>
      <header>
        <h2 style={{ marginBottom: '0.5rem' }}>Your Appointments</h2>
        <p style={{ color: '#64748b' }}>Manage upcoming bookings. Past entries are hidden automatically.</p>
      </header>

      {error ? <div style={errorBanner}>{error}</div> : null}

      {loading ? (
        <p>Loading...</p>
      ) : appointments.length ? (
        <ul style={list}>
          {appointments.map((a) => (
            <li key={a._id} style={item}>
              <div>
                <strong>{formatDateTime(a.startsAt)}</strong>
                <div style={sub}>Doctor: {a.doctorId || '-'}</div>
                <div style={status(a.status)}>{label(a.status)}</div>
              </div>
              <div style={actions}>
                <button
                  style={link}
                  disabled={['CONFIRMED','APPROVED'].includes(a.status) || a.status === 'CANCELLED'}
                  onClick={() => {
                    setRescheduleError('')
                    setRescheduleTarget(a)
                  }}
                >
                  Reschedule
                </button>
                <button style={danger} disabled={['CONFIRMED','APPROVED'].includes(a.status) || a.status === 'CANCELLED'} onClick={() => setCancelId(a._id)}>Cancel</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No upcoming appointments.</p>
      )}

      <ConfirmDialog
        open={Boolean(cancelId)}
        title="Cancel appointment?"
        message="This slot will become available for others."
        confirmText="Cancel appointment"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />

      <RescheduleDialog
        open={Boolean(rescheduleTarget)}
        appointment={rescheduleTarget}
        submitting={rescheduling}
        errorMessage={rescheduleError}
        onSubmit={handleReschedule}
        onClose={() => {
          setRescheduleTarget(null)
          setRescheduleError('')
        }}
      />
    </main>
  )
}

const layout = { padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }
const list = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }
const item = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.85rem' }
const sub = { color: '#64748b', marginTop: '0.25rem' }
const status = (s) => ({ display: 'inline-block', marginTop: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', background: s === 'CANCELLED' ? '#fee2e2' : '#dbeafe', color: s === 'CANCELLED' ? '#b91c1c' : '#1d4ed8', fontSize: '0.75rem' })
const actions = { display: 'flex', gap: '0.5rem' }
const link = { background: 'transparent', border: '1px solid #93c5fd', color: '#0ea5e9', borderRadius: '9999px', padding: '0.25rem 0.75rem', cursor: 'pointer' }
const danger = { ...link, border: '1px solid #fecaca', color: '#ef4444' }
const errorBanner = { padding: '0.75rem 1rem', background: 'rgba(254, 226, 226, 0.9)', border: '1px solid #f87171', borderRadius: '0.75rem', color: '#7f1d1d' }
const label = (s) => (s === 'BOOKED' ? 'PENDING' : ['CONFIRMED','APPROVED'].includes(s) ? 'APPROVED' : s === 'CANCELLED' ? 'REJECTED' : s)
