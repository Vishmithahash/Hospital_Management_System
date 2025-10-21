import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import apiClient from '../../app/apiClient.js'
import { useAuthStore } from '../../app/store.js'
import { toastError, toastSuccess, toastWarning } from '../../app/toastHelpers.js'

dayjs.extend(relativeTime)

export default function DoctorAppointmentsPage() {
  const { user } = useAuthStore()
  const doctorId = user?.profile?.doctorId
  const doctorName = useMemo(() => {
    const first = user?.profile?.firstName
    const last = user?.profile?.lastName
    if (!first && !last) return 'Doctor'
    return `Dr. ${[first, last].filter(Boolean).join(' ')}`
  }, [user])

  const [appointments, setAppointments] = useState([])
  const [selected, setSelected] = useState(null)
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(false)
  const [care, setCare] = useState({ test: '', diagnosis: '', plan: '' })
  const [editingCare, setEditingCare] = useState(null)

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await apiClient.get('/appointments', { skipErrorToast: true })
      const filtered = (Array.isArray(data) ? data : [])
        .filter((a) => ['CONFIRMED', 'APPROVED'].includes(a.status) && (!doctorId || a.doctorId === doctorId))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      setAppointments(filtered)
    } catch (err) {
      // ignore for now
    } finally {
      setLoading(false)
    }
  }, [doctorId])

  useEffect(() => {
    loadAppointments()
  }, [loadAppointments])

  useEffect(() => {
    async function loadPatient() {
      if (!selected?.patientId) {
        setPatient(null)
        setEditingCare(null)
        return
      }
      try {
        const { data } = await apiClient.get(`/patients/${selected.patientId}`)
        setPatient(data)
        setEditingCare(null)
      } catch (err) {
        setPatient(null)
        setEditingCare(null)
      }
    }
    loadPatient()
  }, [selected])

  const snapshotCare = () => {
    const current = patient?.care || {}
    return {
      tests: [...(current.tests || [])],
      diagnoses: [...(current.diagnoses || [])],
      plans: [...(current.plans || [])]
    }
  }

  const persistCare = async (nextCare, successMessage) => {
    if (!patient?._id) return
    try {
      const { data } = await apiClient.put(`/patients/${patient._id}`, { care: nextCare })
      setPatient(data)
      setEditingCare(null)
      toastSuccess(successMessage)
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to update care details')
    }
  }

  const appendCare = async () => {
    if (!patient?._id) return
    if (!care.test && !care.diagnosis && !care.plan) {
      toastWarning('Add at least one field before saving to the record')
      return
    }
    const tests = [...(patient.care?.tests || [])]
    const diagnoses = [...(patient.care?.diagnoses || [])]
    const plans = [...(patient.care?.plans || [])]
    if (care.test) tests.push(care.test)
    if (care.diagnosis) diagnoses.push(care.diagnosis)
    if (care.plan) plans.push(care.plan)
    await persistCare({ tests, diagnoses, plans }, 'Updated medical plan')
    setCare({ test: '', diagnosis: '', plan: '' })
  }

  const startEditCare = (kind, index, value) => {
    setEditingCare({ kind, index, value })
  }

  const cancelEditCare = () => {
    setEditingCare(null)
  }

  const submitEditCare = async () => {
    if (!editingCare || !patient?._id) return
    const trimmed = editingCare.value.trim()
    if (!trimmed) {
      toastWarning('Value cannot be empty')
      return
    }
    const next = snapshotCare()
    if (!Array.isArray(next[editingCare.kind])) return
    next[editingCare.kind][editingCare.index] = trimmed
    await persistCare(next, 'Updated consultation entry')
  }

  const removeCareItem = async (kind, index) => {
    if (!patient?._id) return
    const next = snapshotCare()
    if (!Array.isArray(next[kind])) return
    next[kind].splice(index, 1)
    await persistCare(next, 'Removed consultation entry')
  }

  // If doctorId missing (older accounts), auto-assign one silently
  useEffect(() => {
    async function ensureDoctorId() {
      if (!user || user.profile?.doctorId) return
      try {
        const rand = Math.random().toString(36).slice(2, 7)
        const { data } = await apiClient.put('/users/me/profile', { doctorId: `doctor-${rand}` }, { skipErrorToast: true })
        useAuthStore.getState().setUser(data.user)
      } catch (_) {}
    }
    ensureDoctorId()
  }, [user])

  return (
    <main style={layout}>
      <header style={topBar}>
        <div>
          <h2 style={{ margin: 0 }}>{doctorName}</h2>
          <p style={{ margin: 0, color: '#64748b' }}>{user?.profile?.specialty || 'Specialty not set'}</p>
        </div>
        <div style={pill}>ID: {doctorId || 'assigning...'}</div>
      </header>

      <div style={grid}>
        <section style={card}>
          <header style={listHeader}>
            <div>
              <h3 style={{ margin: 0 }}>Approved Appointments</h3>
              <p style={listSub}>Only confirmed visits assigned to you are shown here.</p>
            </div>
            <span style={countPill}>{appointments.length}</span>
          </header>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <ul style={list}>
              {appointments.length === 0 ? (
                <li style={emptyRow}>No approved appointments scheduled.</li>
              ) : (
                appointments.map((a) => (
                  <li key={a._id} style={row(a._id === selected?._id)} onClick={() => setSelected(a)}>
                    <div style={rowMain}>
                      <div style={timeBlock}>
                        <div style={timeText}>{dayjs(a.startsAt).format('ddd')}</div>
                        <div style={timeStrong}>{dayjs(a.startsAt).format('DD')}</div>
                        <div style={timeText}>{dayjs(a.startsAt).format('MMM')}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={slotLine}>{dayjs(a.startsAt).format('hh:mm A')} – {dayjs(a.endsAt).format('hh:mm A')}</div>
                        <div style={slotMeta}>Patient ID: {a.patientId}</div>
                        <div style={slotMeta}>Status: <span style={statusBadge}>Approved</span></div>
                      </div>
                    </div>
                    <footer style={rowFooter}>
                      <span>{dayjs(a.startsAt).fromNow()}</span>
                      <span style={pillOutline}>{a.department || 'General'}</span>
                    </footer>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>

        <aside style={card}>
          <h3 style={{ marginTop: 0 }}>Consultation</h3>
          {patient ? (
            <>
              <div style={{ marginBottom: '0.75rem', color: '#64748b' }}>
                {patient.demographics?.firstName} {patient.demographics?.lastName}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                <label style={label}>Test<input style={input} value={care.test} onChange={(e) => setCare((s) => ({ ...s, test: e.target.value }))} /></label>
                <label style={label}>Diagnosis<input style={input} value={care.diagnosis} onChange={(e) => setCare((s) => ({ ...s, diagnosis: e.target.value }))} /></label>
                <label style={label}>Plan<input style={input} value={care.plan} onChange={(e) => setCare((s) => ({ ...s, plan: e.target.value }))} /></label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <button style={primary} onClick={appendCare}>Save to record</button>
              </div>
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={smallTitle}>Tests</div>
                  <ul style={careList}>
                    {(patient.care?.tests || []).map((t, i) => {
                      const isEditing = editingCare && editingCare.kind === 'tests' && editingCare.index === i
                      return (
                        <li key={i} style={careItem}>
                          {isEditing ? (
                            <>
                              <input
                                style={editInput}
                                value={editingCare.value}
                                onChange={(e) => setEditingCare((prev) => ({ ...prev, value: e.target.value }))}
                              />
                              <div style={careActions}>
                                <button style={saveBtn} onClick={submitEditCare}>Save</button>
                                <button style={ghostBtn} onClick={cancelEditCare}>Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span style={careText}>{t}</span>
                              <div style={careActions}>
                                <button style={ghostBtn} onClick={() => startEditCare('tests', i, t)}>Edit</button>
                                <button style={deleteBtn} onClick={() => removeCareItem('tests', i)}>Delete</button>
                              </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                    {(patient.care?.tests || []).length === 0 ? <li style={emptyCare}>No tests recorded.</li> : null}
                  </ul>
                </div>
                <div>
                  <div style={smallTitle}>Diagnoses</div>
                  <ul style={careList}>
                    {(patient.care?.diagnoses || []).map((d, i) => {
                      const isEditing = editingCare && editingCare.kind === 'diagnoses' && editingCare.index === i
                      return (
                        <li key={i} style={careItem}>
                          {isEditing ? (
                            <>
                              <input
                                style={editInput}
                                value={editingCare.value}
                                onChange={(e) => setEditingCare((prev) => ({ ...prev, value: e.target.value }))}
                              />
                              <div style={careActions}>
                                <button style={saveBtn} onClick={submitEditCare}>Save</button>
                                <button style={ghostBtn} onClick={cancelEditCare}>Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span style={careText}>{d}</span>
                              <div style={careActions}>
                                <button style={ghostBtn} onClick={() => startEditCare('diagnoses', i, d)}>Edit</button>
                                <button style={deleteBtn} onClick={() => removeCareItem('diagnoses', i)}>Delete</button>
                              </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                    {(patient.care?.diagnoses || []).length === 0 ? <li style={emptyCare}>No diagnoses recorded.</li> : null}
                  </ul>
                </div>
                <div>
                  <div style={smallTitle}>Plans</div>
                  <ul style={careList}>
                    {(patient.care?.plans || []).map((p, i) => {
                      const isEditing = editingCare && editingCare.kind === 'plans' && editingCare.index === i
                      return (
                        <li key={i} style={careItem}>
                          {isEditing ? (
                            <>
                              <input
                                style={editInput}
                                value={editingCare.value}
                                onChange={(e) => setEditingCare((prev) => ({ ...prev, value: e.target.value }))}
                              />
                              <div style={careActions}>
                                <button style={saveBtn} onClick={submitEditCare}>Save</button>
                                <button style={ghostBtn} onClick={cancelEditCare}>Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span style={careText}>{p}</span>
                              <div style={careActions}>
                                <button style={ghostBtn} onClick={() => startEditCare('plans', i, p)}>Edit</button>
                                <button style={deleteBtn} onClick={() => removeCareItem('plans', i)}>Delete</button>
                              </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                    {(patient.care?.plans || []).length === 0 ? <li style={emptyCare}>No plans recorded.</li> : null}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <p>Select an appointment to begin a consultation.</p>
          )}
        </aside>
      </div>
    </main>
  )
}

const layout = { padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }
const topBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: '1rem', padding: '1rem 1.25rem', boxShadow: '0 10px 20px rgba(15,23,42,0.06)' }
const pill = { alignSelf: 'flex-start', padding: '0.35rem 0.6rem', borderRadius: '9999px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }
const card = { background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 20px 40px rgba(15,23,42,0.08)' }
const listHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }
const listSub = { margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }
const countPill = { background: '#0ea5e9', color: '#fff', borderRadius: '9999px', padding: '0.35rem 0.9rem', fontWeight: 600 }
const list = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }
const row = (active) => ({ border: active ? '2px solid #0ea5e9' : '1px solid #e2e8f0', borderRadius: '0.85rem', padding: '0.85rem', cursor: 'pointer', background: active ? 'rgba(14,165,233,0.07)' : '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.75rem' })
const rowMain = { display: 'flex', gap: '0.85rem', alignItems: 'center' }
const timeBlock = { width: 60, minWidth: 60, background: '#0ea5e9', color: '#fff', borderRadius: '0.75rem', padding: '0.5rem 0', textAlign: 'center', display: 'grid', gap: '0.25rem' }
const timeText = { fontSize: '0.75rem', letterSpacing: 0.5 }
const timeStrong = { fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }
const slotLine = { fontWeight: 600, color: '#0f172a', fontSize: '1rem' }
const slotMeta = { color: '#475569', fontSize: '0.85rem', marginTop: '0.25rem' }
const rowFooter = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }
const pillOutline = { border: '1px solid #0ea5e9', borderRadius: '9999px', padding: '0.2rem 0.75rem', color: '#0ea5e9', fontWeight: 600 }
const statusBadge = { display: 'inline-block', background: '#dcfce7', color: '#166534', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem' }
const emptyRow = { padding: '0.75rem', border: '1px dashed #cbd5f5', borderRadius: '0.75rem', color: '#64748b', textAlign: 'center', background: '#f8fafc' }
const label = { display: 'flex', flexDirection: 'column', gap: '0.35rem' }
const input = { border: '1px solid #cbd5f5', borderRadius: '0.65rem', padding: '0.5rem 0.75rem' }
const primary = { border: 'none', borderRadius: '9999px', padding: '0.5rem 1.25rem', background: '#0ea5e9', color: '#fff', cursor: 'pointer' }
const smallTitle = { fontWeight: 600, marginBottom: '0.5rem' }
const careList = { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const careItem = { display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', background: '#f1f5f9', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }
const careText = { flex: 1, color: '#0f172a' }
const careActions = { display: 'flex', gap: '0.4rem' }
const ghostBtn = { border: '1px solid #cbd5f5', background: '#fff', color: '#0f172a', borderRadius: '0.6rem', padding: '0.25rem 0.65rem', cursor: 'pointer', fontSize: '0.82rem' }
const deleteBtn = { ...ghostBtn, border: '1px solid #fecaca', color: '#dc2626' }
const saveBtn = { ...ghostBtn, background: '#0ea5e9', border: '1px solid #0ea5e9', color: '#fff' }
const editInput = { flex: 1, border: '1px solid #cbd5f5', borderRadius: '0.6rem', padding: '0.35rem 0.6rem' }
const emptyCare = { color: '#94a3b8', fontStyle: 'italic', padding: '0.35rem 0', fontSize: '0.85rem' }
