import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../app/store'
import NotificationsDropdown from './NotificationsDropdown.jsx'
import apiClient from '../app/apiClient'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', roles: ['patient'] },
  { to: '/doctor/dashboard', label: 'Dashboard', roles: ['doctor'] },
  { to: '/records/preview', label: 'Records', roles: ['doctor'] },
  { to: '/staff/dashboard', label: 'Dashboard', roles: ['staff'] },
  { to: '/manager', label: 'Dashboard', roles: ['manager'] },
  { to: '/appointments', label: 'Appointments', roles: ['doctor', 'staff', 'patient'] },
  { to: '/payments', label: 'Payments', roles: ['staff', 'patient', 'doctor'] },
  { to: '/reports', label: 'Reports', roles: ['doctor', 'staff', 'manager', 'admin'] },
  { to: '/audit', label: 'Audit', roles: ['patient', 'doctor', 'staff', 'manager', 'admin'] },
  { to: '/profile', label: 'Profile', roles: ['patient', 'doctor', 'staff', 'manager', 'admin'] }
]

export default function Layout() {
  const navigate = useNavigate()
  const { user, token, setUser, logout } = useAuthStore()

  useEffect(() => {
    if (token && !user) {
      apiClient
        .get('/auth/me', { skipErrorToast: true })
        .then((response) => setUser(response.data.user))
        .catch(() => {})
    }
  }, [token, user, setUser])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div>
          <strong style={styles.brand}>HospitalMS</strong>
        </div>
        <nav style={styles.nav}>
          {navItems
            .filter((item) => {
              if (!item.roles || item.roles.length === 0) {
                return true
              }
              return user?.role ? item.roles.includes(user.role) : false
            })
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  ...styles.link,
                  backgroundColor: isActive ? '#0ea5e9' : 'transparent',
                  color: isActive ? '#fff' : '#0f172a'
                })}
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div style={styles.userSection}>
          <NotificationsDropdown />
          {user ? (
            <>
              {user.profile?.imageUrl ? (
                <img src={user.profile.imageUrl} alt="avatar" style={styles.avatar} />
              ) : null}
              <span style={styles.badge}>{user.role}</span>
              <span style={styles.userEmail}>{user.email}</span>
              <button style={styles.logout} onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <button style={styles.logout} onClick={() => navigate('/login')}>
              Log in
            </button>
          )}
        </div>
      </header>
      <main style={styles.content}>
        <Outlet />
      </main>
      <footer style={styles.footer}>HospitalMS Internal - For training use only</footer>
    </div>
  )
}

const styles = {
  shell: {
    minHeight: '100vh',
    background: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0'
  },
  brand: {
    fontSize: '1.25rem',
    color: '#0f172a'
  },
  nav: {
    display: 'flex',
    gap: '0.75rem'
  },
  link: {
    padding: '0.45rem 1rem',
    borderRadius: '9999px',
    textDecoration: 'none',
    fontWeight: 500,
    transition: 'background 0.2s ease'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem'
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '9999px',
    objectFit: 'cover'
  },
  badge: {
    padding: '0.25rem 0.65rem',
    borderRadius: '9999px',
    background: '#e0f2fe',
    color: '#0369a1',
    fontSize: '0.8rem',
    textTransform: 'capitalize'
  },
  userEmail: {
    color: '#475569',
    fontSize: '0.9rem'
  },
  logout: {
    border: 'none',
    borderRadius: '9999px',
    padding: '0.4rem 1rem',
    background: '#0ea5e9',
    color: '#fff',
    cursor: 'pointer'
  },
  content: {
    flex: 1
  },
  footer: {
    marginTop: 'auto',
    padding: '1rem 2rem',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.85rem'
  }
}
