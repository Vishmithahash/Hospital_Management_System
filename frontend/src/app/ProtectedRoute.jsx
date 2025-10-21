import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store'
import EmptyState from '../components/EmptyState.jsx'

export default function ProtectedRoute({ roles, allowedRoles, children }) {
  const { token, user } = useAuthStore()
  const roleList = allowedRoles || roles

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (roleList && !user) {
    return null
  }

  if (roleList && user && !roleList.includes(user.role)) {
    return (
      <main style={restrictionLayout}>
        <EmptyState
          title="Access restricted"
          message="You don't have permission to view this section."
        />
      </main>
    )
  }

  if (children) {
    return children
  }

  return <Outlet />
}

const restrictionLayout = {
  padding: '2rem',
  display: 'flex',
  justifyContent: 'center'
}
