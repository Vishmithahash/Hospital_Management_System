import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '../../app/store.js'
import apiClient from '../../app/apiClient.js'
import { formatDateTime } from '../../lib/formatters.js'
import { toastError, toastSuccess, toastWarning } from '../../app/toastHelpers.js'

export default function DoctorDashboard() {
  const { user, setUser } = useAuthStore()
  const [doctorId, setDoctorId] = useState(user?.profile?.doctorId || '')
  const [specialty, setSpecialty] = useState(user?.profile?.specialty || '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [patient, setPatient] = useState(null)
  const [patientLoading, setPatientLoading] = useState(false)
  const [patientDirectory, setPatientDirectory] = useState({})

  const [appointments, setAppointments] = useState([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [rxPatientId, setRxPatientId] = useState('')
  const [imagePatientId, setImagePatientId] = useState('')

  const [rxNotes, setRxNotes] = useState('')
  const [medications, setMedications] = useState([{ name: '', dose: '', frequency: '', duration: '' }])
  const [savingRx, setSavingRx] = useState(false)
  const [imageCaption, setImageCaption] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageFileInputRef = useRef(null)
  const selectedPatientSyncRef = useRef('')

  useEffect(() => {
    setDoctorId(user?.profile?.doctorId || '')
    setSpecialty(user?.profile?.specialty || '')
  }, [user])

  const saveDoctorProfile = async () => {
    const nextDoctorId = doctorId.trim()
    const nextSpecialty = specialty.trim()

    if (!nextDoctorId || !nextSpecialty) {
      toastWarning('Doctor ID and specialty are required')
      return
    }
    setSavingProfile(true)
    try {
      const { data } = await apiClient.put('/users/me/profile', {
        doctorId: nextDoctorId,
        specialty: nextSpecialty
      })
      setUser(data.user)
      setDoctorId(nextDoctorId)
      setSpecialty(nextSpecialty)
      toastSuccess('Profile updated')
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update profile'
      toastError(message)
    } finally {
      setSavingProfile(false)
    }
  }

  const loadPatient = useCallback(async (id) => {
    if (!id) {
      setPatient(null)
      return
    }
    setPatientLoading(true)
    try {
      const { data } = await apiClient.get(`/patients/${id}`, { skipErrorToast: true })
      setPatient(data)
      setPatientDirectory((prev) => ({ ...prev, [id]: data }))
    } catch (error) {
      setPatient(null)
      if (error.response?.status === 403) {
        toastWarning('Access to that patient record is restricted')
      } else if (error.response?.status && error.response.status >= 500) {
        toastError('Unable to load patient details right now')
      }
    } finally {
      setPatientLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!doctorId) {
      setAppointments([])
      return
    }

    let cancelled = false

    ;(async () => {
      setAppointmentsLoading(true)
      try {
        const { data } = await apiClient.get('/appointments/doctor/me', {
          params: { range: 'all' },
          skipErrorToast: true
        })
        if (!cancelled) {
          setAppointments(Array.isArray(data) ? data : [])
        }
      } catch (_) {
        if (!cancelled) {
          setAppointments([])
        }
      } finally {
        if (!cancelled) {
          setAppointmentsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [doctorId])

  const sortedAppointments = useMemo(
    () => [...appointments].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [appointments]
  )

  const eligibleAppointments = useMemo(() => {
    const windowMs = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const minDate = now - windowMs
    const maxDate = now + windowMs
    const allowedStatuses = new Set(['BOOKED', 'CONFIRMED', 'APPROVED', 'ACCEPTED', 'RESCHEDULED'])

    return sortedAppointments.filter((appt) => {
      if (!appt || !appt.patientId) return false
      if (!allowedStatuses.has(appt.status)) return false
      const start = new Date(appt.startsAt).getTime()
      if (Number.isNaN(start)) return false
      return start >= minDate && start <= maxDate
    })
  }, [sortedAppointments])

  useEffect(() => {
    if (!sortedAppointments.length) {
      if (selectedAppointmentId) setSelectedAppointmentId('')
      if (selectedPatientId) setSelectedPatientId('')
      setPatient(null)
      return
    }

    const current = selectedAppointmentId
      ? sortedAppointments.find((appt) => appt._id === selectedAppointmentId)
      : null

    if (current) {
      if (selectedPatientId !== current.patientId) {
        setSelectedPatientId(current.patientId)
      }
      return
    }

    const fallback = sortedAppointments[0]
    setSelectedAppointmentId(fallback._id)
    setSelectedPatientId(fallback.patientId)
  }, [sortedAppointments, selectedAppointmentId, selectedPatientId])

  const patientsWithAppointments = useMemo(() => {
    const map = new Map()
    sortedAppointments.forEach((appt) => {
      if (!appt.patientId || appt.status === 'CANCELLED') return
      if (!map.has(appt.patientId)) {
        map.set(appt.patientId, {
          patientId: appt.patientId,
          appointments: [],
          latest: null
        })
      }
      const entry = map.get(appt.patientId)
      entry.appointments.push(appt)
      const startTs = new Date(appt.startsAt).getTime()
      if (!entry.latest || startTs > entry.latest.startTs) {
        entry.latest = { startTs, startsAt: appt.startsAt, status: appt.status }
      }
    })
    return Array.from(map.values()).sort((a, b) => (b.latest?.startTs || 0) - (a.latest?.startTs || 0))
  }, [sortedAppointments])

  const eligiblePatientOptions = useMemo(() => {
    const unique = new Map()
    eligibleAppointments.forEach((appt) => {
      if (!unique.has(appt.patientId)) {
        unique.set(appt.patientId, appt)
      }
    })

    return Array.from(unique.values()).map((appt) => {
      const summary = patientDirectory[appt.patientId]
      const nameParts = [summary?.demographics?.firstName, summary?.demographics?.lastName].filter(Boolean)
      const displayName = nameParts.length ? nameParts.join(' ') : appt.patientId
      return {
        patientId: appt.patientId,
        label: `${displayName} — ${formatDateTime(appt.startsAt)} (${appt.status})`
      }
    })
  }, [eligibleAppointments, patientDirectory])

  const appointmentsForSelectedPatient = useMemo(() => {
    if (!selectedPatientId) return []
    return sortedAppointments.filter((appt) => appt.patientId === selectedPatientId)
  }, [sortedAppointments, selectedPatientId])

  const selectedAppointment = useMemo(() => {
    if (!selectedAppointmentId) return null
    return sortedAppointments.find((appt) => appt._id === selectedAppointmentId) || null
  }, [sortedAppointments, selectedAppointmentId])

  const missingPatientIds = useMemo(() => {
    return patientsWithAppointments
      .map((entry) => entry.patientId)
      .filter((id) => !(id in patientDirectory))
  }, [patientsWithAppointments, patientDirectory])

  useEffect(() => {
    if (!eligiblePatientOptions.length) {
      if (rxPatientId) setRxPatientId('')
      if (imagePatientId) setImagePatientId('')
      return
    }

    const validIds = new Set(eligiblePatientOptions.map((entry) => entry.patientId))
    const fallbackId = eligiblePatientOptions[0].patientId
    const preferredId = selectedPatientId && validIds.has(selectedPatientId) ? selectedPatientId : fallbackId

    if (!rxPatientId || !validIds.has(rxPatientId)) {
      setRxPatientId(preferredId)
    }
    if (!imagePatientId || !validIds.has(imagePatientId)) {
      setImagePatientId(preferredId)
    }
  }, [eligiblePatientOptions, rxPatientId, imagePatientId, selectedPatientId])

  useEffect(() => {
    if (!selectedPatientId) {
      selectedPatientSyncRef.current = ''
      return
    }

    if (selectedPatientSyncRef.current === selectedPatientId) return
    selectedPatientSyncRef.current = selectedPatientId

    if (!eligiblePatientOptions.some((option) => option.patientId === selectedPatientId)) return

    setRxPatientId(selectedPatientId)
    setImagePatientId(selectedPatientId)
  }, [selectedPatientId, eligiblePatientOptions])

  useEffect(() => {
    if (!missingPatientIds.length) return

    let cancelled = false

    ;(async () => {
      const results = await Promise.all(
        missingPatientIds.map(async (id) => {
          try {
            const { data } = await apiClient.get(`/patients/${id}`, { skipErrorToast: true })
            return { id, data }
          } catch (_) {
            return { id, data: null }
          }
        })
      )

      if (cancelled) return

      setPatientDirectory((prev) => {
        const next = { ...prev }
        results.forEach(({ id, data }) => {
          if (!(id in next)) {
            next[id] = data
          }
        })
        return next
      })
    })()

    return () => {
      cancelled = true
    }
  }, [missingPatientIds])

  useEffect(() => {
    if (!selectedPatientId) {
      setPatient(null)
      return
    }
    loadPatient(selectedPatientId)
  }, [selectedPatientId, loadPatient])

  const handlePatientSelectionChange = useCallback((id) => {
    setSelectedPatientId(id)
    if (!id) {
      setSelectedAppointmentId('')
      return
    }
    const latestForPatient = sortedAppointments.find((appt) => appt.patientId === id)
    setSelectedAppointmentId(latestForPatient ? latestForPatient._id : '')
  }, [sortedAppointments])

  const handleMedicationChange = (index, field, value) => {
    setMedications((prev) =>
      prev.map((entry, idx) => (idx === index ? { ...entry, [field]: value } : entry))
    )
  }

  const addMedicationRow = () => {
    setMedications((prev) => [...prev, { name: '', dose: '', frequency: '', duration: '' }])
  }

  const removeMedicationRow = (index) => {
    setMedications((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, idx) => idx !== index)
    })
  }

  const handlePrescriptionSubmit = async (event) => {
    event.preventDefault()
    if (!rxPatientId) {
      toastWarning('Select a patient with an eligible appointment')
      return
    }

    const cleanedMedications = medications
      .map((entry) => ({
        name: entry.name?.trim(),
        dose: entry.dose?.trim(),
        frequency: entry.frequency?.trim(),
        duration: entry.duration?.trim()
      }))
      .filter((entry) => entry.name)

    if (!cleanedMedications.length) {
      toastWarning('Add at least one medication')
      return
    }

    setSavingRx(true)
    try {
      await apiClient.post('/prescriptions', {
        patientId: rxPatientId,
        medications: cleanedMedications,
        notes: rxNotes?.trim() || undefined
      })
      toastSuccess('Prescription created')
      setRxNotes('')
      setMedications([{ name: '', dose: '', frequency: '', duration: '' }])
    } finally {
      setSavingRx(false)
    }
  }

  const handleImageFileChange = (event) => {
    setImageFile(event.target.files?.[0] || null)
  }

  const handleImageSubmit = async (event) => {
    event.preventDefault()
    if (!imagePatientId) {
      toastWarning('Select a patient with an eligible appointment')
      return
    }
    if (!imageFile) {
      toastWarning('Choose an image file to upload')
      return
    }

    const formData = new FormData()
    formData.append('patientId', imagePatientId)
    if (imageCaption) {
      formData.append('caption', imageCaption)
    }
    formData.append('file', imageFile)

    setUploadingImage(true)
    try {
      await apiClient.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toastSuccess('Image uploaded')
      setImageCaption('')
      setImageFile(null)
      if (imageFileInputRef.current) {
        imageFileInputRef.current.value = ''
      }
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <main style={layout}>
      <section style={hero}>
        <div>
          <h1 style={{ margin: 0 }}>
            Welcome, {user?.profile?.firstName ? `Dr. ${user.profile.firstName}` : 'Doctor'}.
          </h1>
          <p style={{ margin: 0, color: '#64748b' }}>
            Specialty: {user?.profile?.specialty ?? 'Not set yet'}
          </p>
        </div>
      </section>

      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Professional Profile</h3>
        <p style={{ color: '#64748b' }}>
          Your doctor ID is used for scheduling, and the specialty helps patients find the right provider.
        </p>
        <div style={formGrid}>
          <label style={label}>
            Doctor ID
            <input
              style={input}
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              placeholder="e.g., doctor-1"
            />
          </label>
          <label style={label}>
            Specialty
            <input
              style={input}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g., Cardiology"
            />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem', gap: '0.5rem' }}>
          <button
            style={primary}
            onClick={saveDoctorProfile}
            disabled={savingProfile}
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </section>

      <section>
        <h2 style={{ marginBottom: '0.75rem' }}>Quick Actions</h2>
        <div style={actionsGrid}>
          <a style={actionCard('#e0f2fe')} href="/appointments">
            <div style={actionTitle}>Consultation Notes</div>
            <div style={actionSub}>Create and manage patient notes.</div>
            <div style={actionArrow}>➜</div>
          </a>
          <a style={actionCard('#dcfce7')} href="#prescription-form">
            <div style={actionTitle}>Prescriptions</div>
            <div style={actionSub}>Issue and track medications.</div>
            <div style={actionArrow}>➜</div>
          </a>
          <a style={actionCard('#ede9fe')} href="#image-upload">
            <div style={actionTitle}>Upload Medical Image</div>
            <div style={actionSub}>Add X-rays, scans, and more.</div>
            <div style={actionArrow}>➜</div>
          </a>
        </div>
      </section>

      <section id="prescription-form" style={card}>
        <h3 style={{ marginTop: 0 }}>Issue a Prescription</h3>
        <p style={{ color: '#64748b', marginTop: 0 }}>
          Doctors may prescribe only for patients with an accepted or booked appointment within the
          last 7 days or the next 7 days.
        </p>
        {appointmentsLoading ? (
          <p style={{ color: '#64748b' }}>Loading eligible patients…</p>
        ) : eligiblePatientOptions.length === 0 ? (
          <p style={{ color: '#ef4444' }}>
            No eligible appointments found. Patients must have a booked, confirmed, or rescheduled
            appointment within 7 days.
          </p>
        ) : (
          <form
            onSubmit={handlePrescriptionSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <label style={label}>
              Patient
              <select
                style={select}
                value={rxPatientId}
                onChange={(e) => setRxPatientId(e.target.value)}
                required
              >
                {eligiblePatientOptions.map((option) => (
                  <option key={option.patientId} value={option.patientId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Medications</span>
                <button type="button" style={secondary} onClick={addMedicationRow}>
                  Add medication
                </button>
              </div>
              <div style={medicationGrid}>
                {medications.map((entry, index) => (
                  <div key={index} style={medicationCard}>
                    <label style={label}>
                      Name
                      <input
                        style={input}
                        value={entry.name}
                        onChange={(e) => handleMedicationChange(index, 'name', e.target.value)}
                        placeholder="Medication name"
                        required
                      />
                    </label>
                    <label style={label}>
                      Dose
                      <input
                        style={input}
                        value={entry.dose}
                        onChange={(e) => handleMedicationChange(index, 'dose', e.target.value)}
                        placeholder="e.g., 500 mg"
                      />
                    </label>
                    <label style={label}>
                      Frequency
                      <input
                        style={input}
                        value={entry.frequency}
                        onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)}
                        placeholder="e.g., Twice daily"
                      />
                    </label>
                    <label style={label}>
                      Duration
                      <input
                        style={input}
                        value={entry.duration}
                        onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                        placeholder="e.g., 7 days"
                      />
                    </label>
                    {medications.length > 1 ? (
                      <button type="button" style={removeButton} onClick={() => removeMedicationRow(index)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <label style={label}>
              Notes (optional)
              <textarea
                style={textarea}
                value={rxNotes}
                onChange={(e) => setRxNotes(e.target.value)}
                placeholder="Add instructions or observations"
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="submit" style={primary} disabled={savingRx}>
                {savingRx ? 'Saving…' : 'Create prescription'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section id="image-upload" style={card}>
        <h3 style={{ marginTop: 0 }}>Upload a Medical Image</h3>
        <p style={{ color: '#64748b', marginTop: 0 }}>
          Upload scans, X-rays, or other diagnostic imagery. Only patients with an accepted or booked
          appointment in the last or next 7 days are eligible.
        </p>
        {appointmentsLoading ? (
          <p style={{ color: '#64748b' }}>Loading eligible patients…</p>
        ) : eligiblePatientOptions.length === 0 ? (
          <p style={{ color: '#ef4444' }}>
            No eligible appointments found. Uploads require a qualifying appointment within 7 days.
          </p>
        ) : (
          <form
            onSubmit={handleImageSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <label style={label}>
              Patient
              <select
                style={select}
                value={imagePatientId}
                onChange={(e) => setImagePatientId(e.target.value)}
                required
              >
                {eligiblePatientOptions.map((option) => (
                  <option key={option.patientId} value={option.patientId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={label}>
              Caption (optional)
              <input
                style={input}
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder="Describe the image (e.g., Chest X-ray)"
              />
            </label>

            <label style={label}>
              Image file
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                style={input}
                required
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="submit" style={primary} disabled={uploadingImage}>
                {uploadingImage ? 'Uploading…' : 'Upload image'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section style={gridTwo}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Patient Snapshot</h3>
            <select
              value={selectedPatientId}
              onChange={(e) => handlePatientSelectionChange(e.target.value)}
              style={select}
              disabled={!patientsWithAppointments.length}
            >
              {patientsWithAppointments.length ? (
                patientsWithAppointments.map((entry) => {
                  const summary = patientDirectory[entry.patientId]
                  const nameParts = [summary?.demographics?.firstName, summary?.demographics?.lastName].filter(Boolean)
                  const displayName = nameParts.length ? nameParts.join(' ') : entry.patientId
                  const appointmentLabel = entry.latest?.startsAt ? formatDateTime(entry.latest.startsAt) : 'No appointment date'
                  return (
                    <option key={entry.patientId} value={entry.patientId}>
                      {displayName} — {appointmentLabel}
                    </option>
                  )
                })
              ) : (
                <option value="">No patients with appointments</option>
              )}
            </select>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <PatientDetails patient={patient} loading={patientLoading} />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <h4 style={subHeading}>Appointments</h4>
            {appointmentsForSelectedPatient.length ? (
              <ul style={appointmentList}>
                {appointmentsForSelectedPatient.map((appt) => {
                  const isActive = appt._id === selectedAppointmentId
                  return (
                    <li key={appt._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAppointmentId(appt._id)}
                        style={appointmentChip(isActive)}
                      >
                        <span>{formatDateTime(appt.startsAt)}</span>
                        <span style={{ color: '#1e293b', fontWeight: 600 }}>{appt.status}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : selectedPatientId ? (
              <p style={{ color: '#64748b' }}>No appointments found for this patient.</p>
            ) : (
              <p style={{ color: '#64748b' }}>Select a patient to see their appointments.</p>
            )}
          </div>
        </div>
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>Visit Overview</h3>
          {selectedAppointment ? (
            <div>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>Scheduled:</strong> {formatDateTime(selectedAppointment.startsAt)}
              </p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>Status:</strong> {selectedAppointment.status}
              </p>
              {selectedAppointment.reason ? (
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <strong>Reason:</strong> {selectedAppointment.reason}
                </p>
              ) : null}
              {selectedAppointment.notes ? (
                <p style={{ margin: 0 }}>
                  <strong>Notes:</strong> {selectedAppointment.notes}
                </p>
              ) : null}
            </div>
          ) : (
            <p style={{ color: '#64748b' }}>Select an appointment to see visit details.</p>
          )}
          <div style={{ marginTop: '1rem' }}>
            <h4 style={subHeading}>Insurance</h4>
            <InsuranceDetails insurance={patient?.insurance} loading={patientLoading} />
          </div>
        </div>
      </section>
    </main>
  )
}

const layout = { padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }
const hero = { background: '#fff', borderRadius: '1rem', padding: '1.25rem 1.5rem', boxShadow: '0 10px 20px rgba(15,23,42,0.06)' }
const card = { background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 10px 20px rgba(15,23,42,0.06)' }
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }
const label = { display: 'flex', flexDirection: 'column', gap: '0.35rem' }
const input = { border: '1px solid #cbd5f5', borderRadius: '0.65rem', padding: '0.5rem 0.75rem' }
const primary = { border: 'none', borderRadius: '9999px', padding: '0.5rem 1.25rem', background: '#0ea5e9', color: '#fff', cursor: 'pointer' }
const actionsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }
const actionCard = (bg) => ({ display: 'block', background: '#fff', borderRadius: '1rem', padding: '1rem', boxShadow: '0 10px 20px rgba(15,23,42,0.06)', borderLeft: `6px solid ${bg}`, textDecoration: 'none', color: '#0f172a' })
const actionTitle = { fontWeight: 700, marginBottom: '0.25rem' }
const actionSub = { color: '#64748b' }
const actionArrow = { marginTop: '0.75rem', fontWeight: 700, color: '#2563eb' }
const select = { ...input }
const textarea = { ...input, minHeight: '100px', resize: 'vertical' }
const secondary = { border: '1px solid #0ea5e9', borderRadius: '9999px', padding: '0.4rem 1rem', background: 'transparent', color: '#0ea5e9', cursor: 'pointer' }
const medicationGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }
const medicationCard = { display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.75rem', background: '#f8fafc' }
const removeButton = { border: 'none', alignSelf: 'flex-start', borderRadius: '9999px', padding: '0.35rem 0.75rem', background: '#ef4444', color: '#fff', cursor: 'pointer' }
const gridTwo = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }
const subHeading = { margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#0f172a' }
const appointmentList = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const appointmentChip = (active) => ({
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderRadius: '0.75rem',
  border: `1px solid ${active ? '#0ea5e9' : '#e2e8f0'}`,
  background: active ? '#e0f2fe' : '#f8fafc',
  padding: '0.55rem 0.75rem',
  cursor: 'pointer'
})

function PatientDetails({ patient, loading }) {
  if (loading) return <p style={{ color: '#64748b' }}>Loading patient details…</p>
  if (!patient) return <p style={{ color: '#64748b' }}>No patient loaded.</p>
  return (
    <ul style={{ margin: 0, paddingLeft: '1rem' }}>
      <li>
        <strong>Name:</strong>{' '}
        {(patient.demographics?.firstName || '') + ' ' + (patient.demographics?.lastName || '')}
      </li>
      <li>
        <strong>Phone:</strong> {patient.demographics?.phone || '-'}
      </li>
      <li>
        <strong>DOB:</strong>{' '}
        {patient.demographics?.dob ? new Date(patient.demographics.dob).toLocaleDateString() : '-'}
      </li>
      <li>
        <strong>Gender:</strong> {patient.demographics?.gender || '-'}
      </li>
    </ul>
  )
}

function InsuranceDetails({ insurance, loading }) {
  if (loading) return <p style={{ color: '#64748b' }}>Checking insurance…</p>
  if (!insurance) return <p style={{ color: '#64748b' }}>No insurance on file.</p>
  return (
    <ul style={{ margin: 0, paddingLeft: '1rem' }}>
      <li>
        <strong>Provider:</strong> {insurance.provider || '-'}
      </li>
      <li>
        <strong>Policy:</strong> {insurance.policyNo || '-'}
      </li>
      <li>
        <strong>Valid until:</strong>{' '}
        {insurance.validUntil ? new Date(insurance.validUntil).toLocaleDateString() : '-'}
      </li>
    </ul>
  )
}
