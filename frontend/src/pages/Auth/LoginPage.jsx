import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../app/apiClient.js'
import { getDefaultPathForRole } from '../../app/rolePaths.js'
import { useAuthStore } from '../../app/store.js'
import { toastError, toastSuccess } from '../../app/toastHelpers.js'

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

export default function LoginPage() {
  const navigate = useNavigate()
  const { token, user, setToken, setUser } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  useEffect(() => {
    let isActive = true

    if (token && !user) {
      apiClient
        .get('/auth/me', { skipErrorToast: true })
        .then((response) => {
          if (isActive) {
            setUser(response.data.user)
          }
        })
        .catch(() => {})
    }

    return () => {
      isActive = false
    }
  }, [token, user, setUser])

  useEffect(() => {
    if (token && user) {
      navigate(getDefaultPathForRole(user.role), { replace: true })
    }
  }, [token, user, navigate])

  const onSubmit = async (values) => {
    try {
      const { data } = await apiClient.post('/auth/login', values, { skipErrorToast: true })
      setToken(data.token)
      setUser(data.user)

      let finalUser = data.user
      try {
        const response = await apiClient.get('/auth/me', { skipErrorToast: true })
        finalUser = response.data.user || data.user
      } catch (fetchError) {
        // ignore sync failure, keep using login payload
        console.error('Failed to refresh user profile', fetchError)
      }

      setUser(finalUser)
      toastSuccess('Welcome back!')
      navigate(getDefaultPathForRole(finalUser?.role), { replace: true })
    } catch (error) {
      toastError(error.response?.data?.message || 'Login failed')
    }
  }

  return (
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleSubmit(onSubmit)}>
        <h1 style={styles.title}>Sign in</h1>
        <p style={styles.subtitle}>Access patient records and schedules securely.</p>

        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            type="email"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email ? <span style={styles.error}>{errors.email.message}</span> : null}
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password ? <span style={styles.error}>{errors.password.message}</span> : null}
        </label>

        <button type="submit" style={styles.primary} disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>

        <p style={styles.footer}>
          Need an account?{' '}
          <button type="button" style={styles.linkButton} onClick={() => navigate('/register')}>
            Register
          </button>
        </p>
      </form>
    </div>
  )
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)'
  },
  card: {
    background: '#fff',
    padding: '2.5rem',
    borderRadius: '1.25rem',
    width: '360px',
    boxShadow: '0 30px 60px rgba(15, 23, 42, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  title: {
    margin: 0,
    fontSize: '1.75rem'
  },
  subtitle: {
    margin: 0,
    color: '#64748b'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    fontSize: '0.9rem'
  },
  input: {
    borderRadius: '0.85rem',
    border: '1px solid #dbeafe',
    padding: '0.6rem 0.85rem',
    fontSize: '1rem'
  },
  error: {
    color: '#ef4444',
    fontSize: '0.8rem'
  },
  primary: {
    marginTop: '0.5rem',
    borderRadius: '9999px',
    border: 'none',
    padding: '0.75rem 1.25rem',
    background: '#0ea5e9',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  footer: {
    marginTop: '0.5rem',
    color: '#475569',
    fontSize: '0.9rem'
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0
  }
}
