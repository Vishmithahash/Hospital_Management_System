const ROLE_DEFAULT_PATHS = {
  patient: '/dashboard',
  doctor: '/doctor/dashboard',
  staff: '/staff/dashboard',
  manager: '/manager',
  admin: '/reports'
}

export function getDefaultPathForRole(role) {
  if (!role) {
    return '/dashboard'
  }

  return ROLE_DEFAULT_PATHS[role] || '/dashboard'
}
