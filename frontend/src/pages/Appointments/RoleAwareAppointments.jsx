import { useAuthStore } from '../../app/store.js'
import AppointmentsPage from './AppointmentsPage.jsx'
import PatientAppointmentsPage from './PatientAppointmentsPage.jsx'
import StaffAppointmentsPage from './StaffAppointmentsPage.jsx'
import DoctorAppointmentsPage from './DoctorAppointmentsPage.jsx'
import EmptyState from '../../components/EmptyState.jsx'

export default function RoleAwareAppointments() {
  const { user, token } = useAuthStore()

  if (!user) {
    if (!token) {
      return (
        <main style={{ padding: '2rem' }}>
          <EmptyState title="Access restricted" message="Please sign in to view appointments." />
        </main>
      )
    }

    return (
      <main style={{ padding: '2rem' }}>
        <p>Loading your account...</p>
      </main>
    )
  }

  if (user.role === 'patient') {
    return <PatientAppointmentsPage />
  }

  if (user.role === 'staff') {
    return <StaffAppointmentsPage />
  }
  if (user.role === 'doctor') {
    return <DoctorAppointmentsPage />
  }

  return <AppointmentsPage />
}
