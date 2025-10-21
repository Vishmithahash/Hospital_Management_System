import { Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import { getDefaultPathForRole } from './rolePaths'

export default function RoleLandingRedirect() {
  const { token, user } = useAuthStore()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!user) {
    return null
  }

  const target = getDefaultPathForRole(user.role)
  return <Navigate to={target} replace />
}
