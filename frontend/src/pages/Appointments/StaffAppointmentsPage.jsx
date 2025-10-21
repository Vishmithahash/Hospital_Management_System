import { useCallback, useEffect, useMemo, useState } from 'react'
import apiClient from '../../app/apiClient.js'
import { formatDateTime } from '../../lib/formatters.js'
import { toastError, toastInfo, toastSuccess, toastWarning } from '../../app/toastHelpers.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import RescheduleDialog from './RescheduleDialog.jsx'

export default function StaffAppointmentsPage() {
  const [appointments, setAppointments] = useState([])
  const [selected, setSelected] = useState(null)
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const [doctorDirectory, setDoctorDirectory] = useState({})
  const [doctorOptions, setDoctorOptions] = useState([])
  const [patientLoading, setPatientLoading] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState(null)
  const [rescheduleError, setRescheduleError] = useState('')
  const [rescheduling, setRescheduling] = useState(false)

  const sortAppointments = useCallback((list) => {
    return [...list].sort((a, b) => {
      const aCreated = new Date(a.createdAt || a.startsAt).getTime()
      const bCreated = new Date(b.createdAt || b.startsAt).getTime()
      if (Number.isFinite(bCreated - aCreated) && bCreated !== aCreated) {
        return bCreated - aCreated
      }
      return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
    })
  }, [])

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiClient.get('/appointments/admin', { skipErrorToast: true })
      const list = Array.isArray(data) ? data : []
      setAppointments(sortAppointments(list))
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load appointments'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [sortAppointments])
  useEffect(() => {
    async function loadDoctors() {
      try {
        const { data } = await apiClient.get('/users/doctors', { skipErrorToast: true })
        if (Array.isArray(data)) {
          const mapping = {}
          const options = []
          data.forEach((doctor) => {
            if (!doctor?.id) return
            const baseName = [doctor.name].filter(Boolean).join(' ').trim() || doctor.id
            const label = /^dr\.?/i.test(baseName) ? baseName : `Dr. ${baseName}`
            mapping[doctor.id] = label
            options.push({
              value: doctor.id,
              label: doctor.specialty ? `${label} — ${doctor.specialty}` : label
            })
          })
          options.sort((a, b) => a.label.localeCompare(b.label))
          setDoctorDirectory(mapping)
          setDoctorOptions(options)
        }
      } catch (_) {
        // ignore
      }
    }
    loadDoctors()
  }, [])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  const cancelTarget = useMemo(
    () => appointments.find((a) => a._id === cancelId),
    [appointments, cancelId]
  )

  const dialogDoctorOptions = useMemo(() => {
    if (!rescheduleTarget?.doctorId) {
      return doctorOptions
    }

    if (doctorOptions.some((option) => option.value === rescheduleTarget.doctorId)) {
      return doctorOptions
    }

    const rawName = doctorDirectory[rescheduleTarget.doctorId] || rescheduleTarget.doctorId
    const trimmed = (rawName || '').trim()
    const normalized = trimmed ? (/^dr\.?/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`) : rescheduleTarget.doctorId
    return [
      ...doctorOptions,
      {
        value: rescheduleTarget.doctorId,
        label: normalized
      }
    ]
  }, [doctorOptions, rescheduleTarget, doctorDirectory])

  useEffect(() => {
    async function loadPatient() {
      if (!selected?.patientId) {
        setPatient(null)
        setPatientLoading(false)
        return
      }
      setPatientLoading(true)
      try {
        const { data } = await apiClient.get(`/patients/${selected.patientId}`, { skipErrorToast: true })
        setPatient(data)
      } catch (err) {
        setPatient(null)
      } finally {
        setPatientLoading(false)
      }
    }
    loadPatient()
  }, [selected])

  const handleApprove = async (id) => {
    try {
      const { data } = await apiClient.patch(`/appointments/${id}/approve`, null, { skipErrorToast: true })
      setAppointments((prev) => sortAppointments(prev.map((a) => (a._id === data._id ? data : a))))
      setSelected((prev) => (prev && prev._id === data._id ? data : prev))
      toastSuccess('Appointment approved')
    } catch (err) {
      toastError(err.response?.data?.message || 'Approve failed')
    }
  }

  const handleReject = async (id) => {
    try {
      const { data } = await apiClient.patch(`/appointments/${id}/reject`, null, { skipErrorToast: true })
      setAppointments((prev) => sortAppointments(prev.map((a) => (a._id === data._id ? data : a))))
      setSelected((prev) => (prev && prev._id === data._id ? data : prev))
      toastInfo('Appointment rejected')
    } catch (err) {
      toastError(err.response?.data?.message || 'Reject failed')
    }
  }

  const handleCancel = async () => {
    if (!cancelId) return
    try {
      const { data } = await apiClient.patch(`/appointments/${cancelId}/cancel`, null, {
        skipErrorToast: true
      })
      setAppointments((prev) => {
        const updated = prev
          .map((a) => (a._id === data._id ? data : a))
          .filter((a) => a.status !== 'CANCELLED')
        return sortAppointments(updated)
      })
      setSelected((prev) => (prev && prev._id === data._id ? null : prev))
      toastInfo('Appointment cancelled')
    } catch (err) {
      const status = err.response?.status
      const message = err.response?.data?.message || 'Cancel failed'
      if (status === 400 || status === 409) {
        toastWarning(message)
      } else {
        toastError(message)
      }
    } finally {
      setCancelId(null)
    }
  }

  const handleReschedule = async (payload) => {
    if (!rescheduleTarget?._id) return
    setRescheduleError('')
    setRescheduling(true)
    try {
      const { data } = await apiClient.patch(`/appointments/${rescheduleTarget._id}/reschedule`, payload, {
        skipErrorToast: true
      })
      setAppointments((prev) => sortAppointments(prev.map((a) => (a._id === data._id ? data : a))))
      setSelected((prev) => (prev && prev._id === data._id ? data : prev))
      toastSuccess('Appointment rescheduled')
      setRescheduleTarget(null)
    } catch (err) {
      const status = err.response?.status
      const fallback = err.response?.data?.message || 'Reschedule failed'
      if (status === 409) {
        const message = 'That time slot has already been booked.'
        setRescheduleError(message)
        toastWarning(message)
      } else {
        setRescheduleError(fallback)
        toastError(fallback)
      }
    } finally {
      setRescheduling(false)
    }
  }

  return (
    <main style={layout}>
      <header>
        <h2 style={{ marginBottom: '0.25rem' }}>Review Appointments</h2>
        <p style={{ color: '#64748b' }}>Approve or reject pending bookings and view patient details.</p>
      </header>

      {error ? <div style={errorBanner}>{error}</div> : null}

      <div style={grid}>
        <section style={card}>
          <h3 style={title}>Appointments</h3>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ul style={list}>
              {appointments.map((a) => {
                const doctorDisplay = getDoctorDisplay(a.doctorId, doctorDirectory)
                return (
                  <li
                    key={a._id}
                    style={row(a._id === selected?._id)}
                    onClick={() => {
                      setSelected(a)
                    }}
                  >
                    <div>
                      <div style={doctorLine}>{doctorDisplay.label}</div>
                      <strong>{formatDateTime(a.startsAt)}</strong>
                      <div style={sub}>Patient ID: {a.patientId || '-'}</div>
                      <div style={badge(a.status)}>{statusLabel(a.status)}</div>
                    </div>
                    <div style={rowActions}>
                      <button
                        style={approve}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleApprove(a._id)
                        }}
                      >
                        Approve
                      </button>
                      <button
                        style={reject}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleReject(a._id)
                        }}
                      >
                        Reject
                      </button>
                      <button
                        style={{
                          ...rescheduleBtn,
                          ...(a.status === 'CANCELLED' ? disabledButton : {})
                        }}
                        disabled={a.status === 'CANCELLED'}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(a)
                          setRescheduleError('')
                          setRescheduleTarget(a)
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        style={cancel}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(a)
                          setCancelId(a._id)
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside style={card}>
          <h3 style={title}>Patient Details</h3>
          {selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{getDoctorDisplay(selected.doctorId, doctorDirectory).label}</div>
                <div style={{ color: '#0f172a' }}>{formatDateTime(selected.startsAt)}</div>
                <div style={badge(selected.status)}>{statusLabel(selected.status)}</div>
              </div>
              {patientLoading ? (
                <p style={{ color: '#64748b' }}>Loading patient…</p>
              ) : patient ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                  <DetailRow label="Name" value={`${patient.demographics?.firstName || ''} ${patient.demographics?.lastName || ''}`.trim() || '-'} />
                  <DetailRow label="DOB" value={patient.demographics?.dob ? new Date(patient.demographics.dob).toLocaleDateString() : '-'} />
                  <DetailRow label="Phone" value={patient.demographics?.phone || '-'} />
                  <DetailRow label="Email" value={patient.demographics?.email || '-'} />
                  <DetailRow label="Insurance" value={patient.insurance?.provider || 'Not on file'} />
                </div>
              ) : (
                <p style={{ color: '#64748b' }}>Patient details unavailable.</p>
              )}
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>Select an appointment to view patient information.</p>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(cancelId)}
        title="Cancel appointment?"
        message={
          cancelTarget
            ? `Release the slot scheduled for ${formatDateTime(cancelTarget.startsAt)}?`
            : 'Release this slot so it becomes available to others.'
        }
        confirmText="Cancel appointment"
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />

      <RescheduleDialog
        open={Boolean(rescheduleTarget)}
        appointment={rescheduleTarget}
        doctorOptions={dialogDoctorOptions}
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
const grid = { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }
const card = { background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 20px 40px rgba(15,23,42,0.08)' }
const title = { marginTop: 0 }
const list = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }
const row = (active) => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: active ? '2px solid #0ea5e9' : '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.85rem', cursor: 'pointer', background: active ? 'rgba(14,165,233,0.06)' : '#fff' })
const doctorLine = { fontWeight: 600, marginBottom: '0.25rem', color: '#0f172a' }
const sub = { color: '#64748b', marginTop: '0.25rem' }
const badge = (s) => ({ display: 'inline-block', marginTop: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '9999px', background: s === 'CANCELLED' ? '#fee2e2' : ['CONFIRMED','APPROVED'].includes(s) ? '#dcfce7' : '#dbeafe', color: s === 'CANCELLED' ? '#b91c1c' : ['CONFIRMED','APPROVED'].includes(s) ? '#166534' : '#1d4ed8', fontSize: '0.75rem' })
const rowActions = { display: 'flex', gap: '0.5rem' }
const approve = { border: 'none', borderRadius: '0.75rem', padding: '0.45rem 0.9rem', background: '#22c55e', color: '#fff', cursor: 'pointer' }
const reject = { ...approve, background: '#ef4444' }
const rescheduleBtn = { ...approve, background: '#2563eb' }
const cancel = { ...approve, background: '#f97316' }
const pair = { display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px dashed #e2e8f0' }
const keyText = { color: '#64748b', marginRight: '0.75rem' }
const errorBanner = { padding: '0.75rem 1rem', background: 'rgba(254, 226, 226, 0.9)', border: '1px solid #f87171', borderRadius: '0.75rem', color: '#7f1d1d' }
const disabledButton = { opacity: 0.55, cursor: 'not-allowed' }

function statusLabel(s) {
  if (s === 'BOOKED') return 'PENDING'
  if (['CONFIRMED','APPROVED'].includes(s)) return 'APPROVED'
  if (s === 'CANCELLED') return 'REJECTED'
  return s
}

function getDoctorDisplay(doctorId, directory) {
  if (!doctorId) {
    return { label: 'Doctor: Unassigned', name: 'Unassigned' }
  }
  const raw = directory[doctorId]
  const base = (raw || '').trim() || doctorId
  const prefixed = /^dr\.?/i.test(base) ? base : `Dr. ${base}`
  return {
    label: `Doctor: ${prefixed}`,
    name: prefixed
  }
}

function DetailRow({ label, value }) {
  return (
    <div style={pair}>
      <span style={keyText}>{label}</span>
      <span>{value}</span>
    </div>
  )
}
