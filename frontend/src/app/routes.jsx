import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RecordsPage from '../pages/Records/RecordsPage.jsx'
import RoleAwareAppointments from '../pages/Appointments/RoleAwareAppointments.jsx'
import ManageAppointments from '../pages/Appointments/ManageAppointments.jsx'
import ViewAppointmentsPage from '../pages/Appointments/ViewAppointmentsPage.jsx'
import PatientDashboard from '../pages/Dashboard/PatientDashboard.jsx'
import DoctorDashboard from '../pages/Dashboard/DoctorDashboard.jsx'
import StaffDashboard from '../pages/Dashboard/StaffDashboard.jsx'
import PaymentsPage from '../pages/Payments/PaymentsPage.jsx'
import ReportsPage from '../pages/Reports/ReportsPage.jsx'
import ManagerDashboard from '../pages/manager/Dashboard.tsx'
import ManagerReports from '../pages/manager/Reports.tsx'
import ProfilePage from '../pages/Profile/ProfilePage.jsx'
import AuditPage from '../pages/Audit/AuditPage.jsx'
import LoginPage from '../pages/Auth/LoginPage.jsx'
import RegisterPage from '../pages/Auth/RegisterPage.jsx'
import NotFound from '../pages/Misc/NotFound.jsx'
import Layout from '../components/Layout.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import RoleLandingRedirect from './RoleLandingRedirect.jsx'
import { Toasts } from './toasts.jsx'

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<Layout />}>
          <Route element={<ProtectedRoute />}>
            <Route index element={<RoleLandingRedirect />} />

            <Route element={<ProtectedRoute allowedRoles={['doctor', 'staff', 'patient']} />}>
              <Route path="records/:id" element={<RecordsPage />} />
              <Route path="records/preview" element={<Navigate to="/dashboard" replace />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['doctor', 'staff', 'patient']} />}>
              <Route path="appointments" element={<RoleAwareAppointments />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
              <Route path="appointments/manage" element={<ManageAppointments />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
              <Route path="appointments/view" element={<ViewAppointmentsPage />} />
              <Route path="appointments/viewappointment" element={<ViewAppointmentsPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['patient']} />}>
              <Route path="dashboard" element={<PatientDashboard />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
              <Route path="doctor/dashboard" element={<DoctorDashboard />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['staff']} />}>
              <Route path="staff/dashboard" element={<StaffDashboard />} />
            </Route>

            <Route
              path="profile"
              element={
                <ProtectedRoute allowedRoles={['patient', 'doctor', 'staff', 'manager', 'admin']}>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            <Route element={<ProtectedRoute allowedRoles={['patient', 'doctor', 'staff', 'manager', 'admin']} />}>
              <Route path="audit" element={<AuditPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['patient', 'doctor', 'staff']} />}>
              <Route path="payments" element={<PaymentsPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['doctor', 'staff', 'manager', 'admin']} />}>
              <Route path="reports" element={<ReportsPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['manager']} />}>
              <Route path="manager" element={<ManagerDashboard />} />
              <Route path="manager/reports" element={<ManagerReports />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toasts />
    </BrowserRouter>
  )
}
