import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import apiClient from '../../app/apiClient.js'
import PatientSlotPicker from './PatientSlotPicker.jsx'
import RescheduleDialog from './RescheduleDialog.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { formatDateTime } from '../../lib/formatters.js'
import { toastError, toastInfo, toastSuccess, toastWarning } from '../../app/toastHelpers.js'

export default function ManageAppointments() {
  const [tab, setTab] = useState('book')
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [reschedule, setReschedule] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const upcoming = useMemo(() => appointments.filter((a) => dayjs(a.startsAt).isAfter(dayjs())), [appointments])
  const past = useMemo(() => appointments.filter((a) => dayjs(a.startsAt).isBefore(dayjs())), [appointments])

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await apiClient.get('/appointments', { skipErrorToast: true })
      setAppointments(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onBooked = () => { load(); setTab('upcoming') }

  const handleCancel = async () => {
    try {
      await apiClient.post(`/appointments/${cancelId}/cancel`, null, { skipErrorToast: true })
      toastInfo('Appointment cancelled')
      load()
    } catch (err) {
      const status = err.response?.status
      if (status === 409) toastWarning('Past cutoff time', 'Late action')
      else toastError(err.response?.data?.message || 'Unable to cancel')
    } finally { setCancelId(null) }
  }

  const handleReschedule = async (payload) => {
    try {
      await apiClient.post(`/appointments/${reschedule._id}/reschedule`, payload, { skipErrorToast: true })
      toastSuccess('Appointment rescheduled')
      load()
    } catch (err) {
      const status = err.response?.status
      if (status === 409) toastWarning('Slot conflict or past cutoff')
      else toastError(err.response?.data?.message || 'Unable to reschedule')
    } finally { setReschedule(null) }
  }

  return (
    <main style={layout}>
      <header style={tabs}>
        <button style={tabBtn(tab==='book')} onClick={() => setTab('book')}>Book</button>
        <button style={tabBtn(tab==='upcoming')} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button style={tabBtn(tab==='past')} onClick={() => setTab('past')}>Past</button>
      </header>

      {tab === 'book' ? (
        <section style={panel}>
          <h3 style={{ marginTop: 0 }}>Find a slot</h3>
          <PatientSlotPicker onBook={onBooked} />
          {/* Waitlist helper if needed */}
          <WaitlistHelper />
        </section>
      ) : null}

      {tab === 'upcoming' ? (
        <section style={panel}>
          {loading ? <p>Loading...</p> : (
            <ul style={list}>
              {upcoming.map((a) => (
                <li key={a._id} style={row}>
                  <div>
                    <div><strong>{formatDateTime(a.startsAt)}</strong> - Doctor: {a.doctorId || '-'}</div>
                    <span style={badge(a.status)}>{mapStatus(a.status)}</span>
                  </div>
                  <div style={actions}>
                    <button style={link} onClick={() => setReschedule(a)} disabled={['CONFIRMED','APPROVED','CANCELLED'].includes(a.status)}>Reschedule</button>
                    <button style={danger} onClick={() => setCancelId(a._id)} disabled={['CONFIRMED','APPROVED','CANCELLED'].includes(a.status)}>Cancel</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'past' ? (
        <section style={panel}>
          <ul style={list}>
            {past.map((a) => (
              <li key={a._id} style={row}>
                <div>
                  <div><strong>{formatDateTime(a.startsAt)}</strong> - Doctor: {a.doctorId || '-'}</div>
                  <span style={badge(a.status)}>{mapStatus(a.status)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog open={Boolean(cancelId)} title="Cancel appointment?" message="This slot will become available for others." onConfirm={handleCancel} onCancel={() => setCancelId(null)} />
      <RescheduleDialog open={Boolean(reschedule)} appointment={reschedule} onSubmit={handleReschedule} onClose={() => setReschedule(null)} />
    </main>
  )
}

function WaitlistHelper() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [doctorId, setDoctorId] = useState('')
  useEffect(() => { // fetch doctors for simple selector
    apiClient.get('/users/doctors', { skipErrorToast: true }).then(({ data }) => setDoctorId(data?.[0]?.id || ''))
  }, [])
  const join = async () => {
    if (!doctorId || !date) return
    await apiClient.post('/waitlist', { doctorId, desiredDate: date }, { skipErrorToast: true })
  }
  return (
    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <span style={{ color: '#64748b' }}>No slots? Join waitlist for</span>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <button style={link} onClick={join}>Join Waitlist</button>
    </div>
  )
}

function mapStatus(s) { return s === 'BOOKED' ? 'PENDING' : ['CONFIRMED','APPROVED'].includes(s) ? 'APPROVED' : s }

const layout = { padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }
const tabs = { display: 'flex', gap: '0.5rem' }
const tabBtn = (active) => ({ border: '1px solid #e2e8f0', borderRadius: '9999px', padding: '0.4rem 1rem', background: active ? '#0ea5e9' : '#fff', color: active ? '#fff' : '#0f172a', cursor: 'pointer' })
const panel = { background: '#fff', borderRadius: '1rem', padding: '1rem', boxShadow: '0 20px 40px rgba(15,23,42,0.08)' }
const list = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const row = { border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const actions = { display: 'flex', gap: '0.5rem' }
const link = { border: '1px solid #cbd5f5', background: 'transparent', borderRadius: '9999px', padding: '0.35rem 0.75rem', color: '#0ea5e9', cursor: 'pointer' }
const danger = { ...link, border: '1px solid #fecaca', color: '#ef4444' }
const badge = (s) => ({ display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', background: s === 'CANCELLED' ? '#fee2e2' : ['CONFIRMED','APPROVED'].includes(s) ? '#dcfce7' : '#dbeafe', color: s === 'CANCELLED' ? '#b91c1c' : ['CONFIRMED','APPROVED'].includes(s) ? '#166534' : '#1d4ed8', fontSize: '0.75rem' })

