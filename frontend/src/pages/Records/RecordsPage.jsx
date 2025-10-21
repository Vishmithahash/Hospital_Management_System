import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import apiClient from '../../app/apiClient.js'
import { useAuthStore } from '../../app/store.js'
import EmptyState from '../../components/EmptyState.jsx'
import DoctorRecordsScreen from './DoctorRecordsScreen.jsx'
import StaffRecordsScreen from './StaffRecordsScreen.jsx'
import PatientRecordsScreen from './PatientRecordsScreen.jsx'
import { layout } from './recordStyles.js'

const ROLE_SCREENS = {
  doctor: DoctorRecordsScreen,
  staff: StaffRecordsScreen,
  patient: PatientRecordsScreen
}

export default function RecordsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuthStore()
  const [patient, setPatient] = useState(null)
  const [auditEntries, setAuditEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadAudit = useCallback(async () => {
    if (!id || id === 'preview') {
      setAuditEntries([])
      return
    }

    if (user?.role !== 'doctor' && user?.role !== 'staff') {
      setAuditEntries([])
      return
    }

    try {
      const { data } = await apiClient.get(`/patients/${id}/audit`, { skipErrorToast: true })
      setAuditEntries(data)
    } catch (err) {
      // ignore lack of permission
      setAuditEntries([])
    }
  }, [id, user])

  const loadPatient = useCallback(async () => {
    if (!id || id === 'preview') {
      setPatient(null)
      setAuditEntries([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [{ data: patientData }] = await Promise.all([
        apiClient.get(`/patients/${id}`)
      ])

      setPatient(patientData)
      await loadAudit()
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to load patient'
      setError(message)
      setPatient(null)
    } finally {
      setLoading(false)
    }
  }, [id, loadAudit])

  useEffect(() => {
    loadPatient()
  }, [loadPatient])

  useEffect(() => {
    if (user?.role === 'patient' && id === 'preview' && user.linkedPatientId) {
      navigate(`/records/${user.linkedPatientId}`, { replace: true })
    }
  }, [user, id, navigate])

  const handleUpdatedPatient = useCallback(
    (next) => {
      setPatient(next)
      loadAudit()
    },
    [loadAudit]
  )

  const pageState = useMemo(() => {
    if (!id || id === 'preview') {
      return 'empty'
    }

    if (loading) {
      return 'loading'
    }

    if (error) {
      return 'error'
    }

    if (!patient) {
      return 'empty'
    }

    return 'ready'
  }, [id, loading, error, patient])

  if (!user) {
    if (!token) {
      return (
        <main style={layout}>
          <EmptyState title="Access restricted" message="Please sign in to view patient records." />
        </main>
      )
    }

    return (
      <main style={layout}>
        <p>Loading your account...</p>
      </main>
    )
  }

  const ScreenComponent = ROLE_SCREENS[user.role]

  if (!ScreenComponent) {
    return (
      <main style={layout}>
        <EmptyState
          title="Access restricted"
          message="Your role is not permitted to view patient records."
        />
      </main>
    )
  }

  if (pageState === 'empty') {
    return (
      <main style={layout}>
        <EmptyState
          title="Select a patient"
          message="Choose a record from the list to start reviewing."
        />
      </main>
    )
  }

  return (
    <ScreenComponent
      layoutStyle={layout}
      patient={patient}
      auditEntries={auditEntries}
      loading={loading}
      error={error}
      onRetry={loadPatient}
      onPatientUpdated={handleUpdatedPatient}
    />
  )
}
