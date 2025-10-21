import { useEffect, useState } from 'react'
import { useAuthStore } from '../../app/store.js'
import apiClient from '../../app/apiClient.js'
import { formatDateTime } from '../../lib/formatters.js'
import PatientDetailsCard from '../../components/Cards/PatientDetailsCard.jsx'
import InsuranceDetailsCard from '../../components/Cards/InsuranceDetailsCard.jsx'

export default function PatientDashboard() {
  const { user } = useAuthStore()
  const [upcoming, setUpcoming] = useState(null)
  const [patient, setPatient] = useState(null)
  const [insProvider, setInsProvider] = useState('')
  const [insPolicy, setInsPolicy] = useState('')
  const [insValidUntil, setInsValidUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [corrOpen, setCorrOpen] = useState(false)
  const [corrField, setCorrField] = useState('firstName')
  const [corrValue, setCorrValue] = useState('')
  const [corrSending, setCorrSending] = useState(false)
  const [prescriptions, setPrescriptions] = useState([])
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false)
  const [images, setImages] = useState([])
  const [imagesLoading, setImagesLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data } = await apiClient.get('/appointments', { skipErrorToast: true })
        if (!cancelled) {
          setUpcoming(Array.isArray(data) && data.length ? data[0] : null)
        }
      } catch (_) {
        if (!cancelled) {
          setUpcoming(null)
        }
      }

      if (user?.linkedPatientId) {
        try {
          const { data: p } = await apiClient.get(`/patients/${user.linkedPatientId}`, { skipErrorToast: true })
          if (!cancelled) {
            setPatient(p)
            setInsProvider(p?.insurance?.provider || '')
            setInsPolicy(p?.insurance?.policyNo || '')
            setInsValidUntil(p?.insurance?.validUntil ? new Date(p.insurance.validUntil).toISOString().slice(0, 10) : '')
          }
        } catch (_) {}

        if (cancelled) return

        setPrescriptionsLoading(true)
        setImagesLoading(true)

        const [rxResult, imgResult] = await Promise.allSettled([
          apiClient.get('/prescriptions', { skipErrorToast: true }),
          apiClient.get('/images', { skipErrorToast: true })
        ])

        if (cancelled) return

        if (rxResult.status === 'fulfilled') {
          const items = Array.isArray(rxResult.value?.data) ? rxResult.value.data : []
          setPrescriptions(items)
        } else {
          setPrescriptions([])
        }

        if (imgResult.status === 'fulfilled') {
          const items = Array.isArray(imgResult.value?.data) ? imgResult.value.data : []
          setImages(items)
        } else {
          setImages([])
        }

        setPrescriptionsLoading(false)
        setImagesLoading(false)
      } else if (!cancelled) {
        setPrescriptions([])
        setImages([])
        setPrescriptionsLoading(false)
        setImagesLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  // Refresh patient details when tab becomes visible to reflect staff updates
  useEffect(() => {
    let cancelled = false

    const handler = async () => {
      if (document.visibilityState !== 'visible' || !user?.linkedPatientId) return

      try {
        const { data: p } = await apiClient.get(`/patients/${user.linkedPatientId}`, { skipErrorToast: true })
        if (!cancelled) {
          setPatient(p)
          setInsProvider(p?.insurance?.provider || '')
          setInsPolicy(p?.insurance?.policyNo || '')
          setInsValidUntil(p?.insurance?.validUntil ? new Date(p.insurance.validUntil).toISOString().slice(0, 10) : '')
        }
      } catch (_) {}

      setPrescriptionsLoading(true)
      setImagesLoading(true)

      const [rxResult, imgResult] = await Promise.allSettled([
        apiClient.get('/prescriptions', { skipErrorToast: true }),
        apiClient.get('/images', { skipErrorToast: true })
      ])

      if (cancelled) return

      if (rxResult.status === 'fulfilled') {
        const items = Array.isArray(rxResult.value?.data) ? rxResult.value.data : []
        setPrescriptions(items)
      } else {
        setPrescriptions([])
      }

      if (imgResult.status === 'fulfilled') {
        const items = Array.isArray(imgResult.value?.data) ? imgResult.value.data : []
        setImages(items)
      } else {
        setImages([])
      }

      setPrescriptionsLoading(false)
      setImagesLoading(false)
    }

    document.addEventListener('visibilitychange', handler)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handler)
    }
  }, [user])

  const saveInsurance = async () => {
    if (!user?.linkedPatientId) return
    setSaving(true)
    try {
      const payload = { insurance: { provider: insProvider, policyNo: insPolicy, validUntil: insValidUntil } }
      const { data } = await apiClient.put(`/patients/${user.linkedPatientId}`, payload, { skipErrorToast: true })
      setPatient(data)
    } finally {
      setSaving(false)
    }
  }

  const sendCorrection = async () => {
    if (!user?.linkedPatientId) return
    setCorrSending(true)
    try {
      const fields = { [corrField]: corrValue }
      await apiClient.post(`/patients/${user.linkedPatientId}/corrections`, { fields }, { skipErrorToast: true })
      setCorrOpen(false)
      setCorrValue('')
    } finally {
      setCorrSending(false)
    }
  }

  return (
    <main style={layout}>
      <section style={hero}>
        <div>
          <h1 style={{ margin: 0 }}>Welcome, {user?.profile?.firstName || user?.email}!</h1>
          <p style={{ margin: 0, color: '#64748b' }}>Here's a summary of your health dashboard.</p>
        </div>
        <div>
          <a href="/records/preview" style={cta}>
            View Medical Records
          </a>
        </div>
      </section>

      <section style={twoCol}>
        <div>
          <PatientDetailsCard patient={patient} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button style={primary} onClick={() => setCorrOpen(true)}>Request change</button>
          </div>
        </div>
        <InsuranceDetailsCard insurance={patient?.insurance} />
      </section>

      <section style={cardLike}>
        <h3 style={{ marginTop: 0 }}>Insurance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <label style={formLabel}>
            Provider
            <input style={input} value={insProvider} onChange={(e) => setInsProvider(e.target.value)} />
          </label>
          <label style={formLabel}>
            Policy number
            <input style={input} value={insPolicy} onChange={(e) => setInsPolicy(e.target.value)} />
          </label>
          <label style={formLabel}>
            Valid until
            <input style={input} type="date" value={insValidUntil} onChange={(e) => setInsValidUntil(e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button style={primary} onClick={saveInsurance} disabled={saving}>
            {saving ? 'Saving…' : 'Save insurance'}
          </button>
        </div>
      </section>

      {corrOpen ? (
        <div style={backdrop} onClick={() => setCorrOpen(false)}>
          <div style={dialog} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Request a correction</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <label style={formLabel}>
                Field
                <select style={input} value={corrField} onChange={(e) => setCorrField(e.target.value)}>
                  <option value="firstName">First name</option>
                  <option value="lastName">Last name</option>
                  <option value="phone">Phone</option>
                  <option value="address">Address</option>
                </select>
              </label>
              <label style={formLabel}>
                New value
                <input style={input} value={corrValue} onChange={(e) => setCorrValue(e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button style={linkBtn} onClick={() => setCorrOpen(false)}>Cancel</button>
              <button style={primary} onClick={sendCorrection} disabled={corrSending || !corrValue}>{corrSending ? 'Sending…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      ) : null}

      <section style={cardLike}>
        <h3 style={{ marginTop: 0 }}>Your Medical Records</h3>
        {patient?.care ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={tileTitle}>Tests</div>
              <ul style={list}>{(patient.care.tests || []).map((t, i) => (<li key={i}>{t}</li>))}</ul>
            </div>
            <div>
              <div style={tileTitle}>Diagnoses</div>
              <ul style={list}>{(patient.care.diagnoses || []).map((d, i) => (<li key={i}>{d}</li>))}</ul>
            </div>
            <div>
              <div style={tileTitle}>Plans</div>
              <ul style={list}>{(patient.care.plans || []).map((p, i) => (<li key={i}>{p}</li>))}</ul>
            </div>
          </div>
        ) : (
          <p style={{ color: '#64748b' }}>Your doctor will add tests, diagnoses, and plans after consultations.</p>
        )}
      </section>

      <section style={cardLike}>
        <h3 style={{ marginTop: 0 }}>Doctor Prescriptions</h3>
        {prescriptionsLoading ? (
          <p style={{ color: '#64748b' }}>Loading prescriptions…</p>
        ) : prescriptions.length ? (
          <div style={recordStack}>
            {prescriptions.map((item, idx) => {
              const key = item?._id || item?.id || idx
              return (
                <div key={key} style={recordCard}>
                  <div style={recordHeader}>
                    <span style={recordTitle}>Issued {formatDateTime(item?.createdAt)}</span>
                    <span style={recordMeta}>Doctor ID: {item?.doctorId || 'Unavailable'}</span>
                  </div>
                  {item?.notes ? <p style={recordNotes}>{item.notes}</p> : null}
                  {Array.isArray(item?.medications) && item.medications.length ? (
                    <ul style={list}>
                      {item.medications.map((med, mIdx) => {
                        const details = [med?.dose, med?.frequency, med?.duration].filter(Boolean).join(' • ')
                        return (
                          <li key={mIdx}>
                            <strong>{med?.name}</strong>
                            {details ? <span> — {details}</span> : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p style={{ color: '#64748b', margin: 0 }}>No medications listed.</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ color: '#64748b' }}>No prescriptions recorded yet.</p>
        )}
      </section>

      <section style={cardLike}>
        <h3 style={{ marginTop: 0 }}>Medical Images</h3>
        {imagesLoading ? (
          <p style={{ color: '#64748b' }}>Loading medical images…</p>
        ) : images.length ? (
          <div style={recordStack}>
            {images.map((image, idx) => {
              const key = image?._id || image?.id || idx
              return (
                <div key={key} style={recordCard}>
                  <div style={recordHeader}>
                    <span style={recordTitle}>{image?.caption || 'Image upload'}</span>
                    <span style={recordMeta}>{formatDateTime(image?.createdAt)}</span>
                  </div>
                  <div style={recordLinkRow}>
                    <span style={recordMeta}>Doctor ID: {image?.doctorId || 'Unavailable'}</span>
                    {image?.url ? (
                      <a style={inlineLink} href={image.url} target="_blank" rel="noreferrer">
                        View image
                      </a>
                    ) : (
                      <span style={recordMeta}>No file available</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ color: '#64748b' }}>No medical images uploaded yet.</p>
        )}
      </section>
    </main>
  )
}

const layout = { padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }
const hero = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 20px 40px rgba(15,23,42,0.08)' }
const cta = { display: 'inline-block', padding: '0.8rem 1.2rem', borderRadius: '0.75rem', background: '#2563eb', color: '#fff', textDecoration: 'none', fontWeight: 600 }
const twoCol = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }
const tile = { background: '#fff', borderRadius: '1rem', padding: '1rem', boxShadow: '0 10px 20px rgba(15,23,42,0.06)' }
const tileTitle = { fontWeight: 600, marginBottom: '0.5rem' }
const tileBody = { color: '#0f172a' }
const cardLike = { background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 10px 20px rgba(15,23,42,0.06)' }
const formLabel = { display: 'flex', flexDirection: 'column', gap: '0.35rem' }
const input = { border: '1px solid #cbd5f5', borderRadius: '0.65rem', padding: '0.5rem 0.75rem' }
const primary = { border: 'none', borderRadius: '9999px', padding: '0.6rem 1.25rem', background: '#0ea5e9', color: '#fff', cursor: 'pointer' }
const list = { margin: 0, paddingLeft: '1rem' }
const backdrop = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const dialog = { width: 520, background: '#fff', borderRadius: '1rem', padding: '1rem', boxShadow: '0 30px 60px rgba(15,23,42,0.25)' }
const linkBtn = { background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '9999px', padding: '0.5rem 1rem', cursor: 'pointer' }
const recordStack = { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }
const recordCard = { border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem 1rem', background: '#f8fafc' }
const recordHeader = { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }
const recordTitle = { fontWeight: 600, color: '#0f172a' }
const recordMeta = { color: '#64748b', fontSize: '0.9rem' }
const recordNotes = { color: '#0f172a', margin: '0 0 0.5rem 0' }
const recordLinkRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
const inlineLink = { color: '#2563eb', textDecoration: 'none', fontWeight: 600 }
