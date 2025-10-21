import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../app/apiClient.js'
import { toastError, toastSuccess } from '../../app/toastHelpers.js'

const ROLE_OPTIONS = [
  { value: 'patient', label: 'Patient' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' }
]

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{7,20}$/i, 'Phone is invalid'),
    email: z.string().trim().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8),
    role: z.enum(['patient', 'doctor', 'staff', 'manager'])
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword']
  })

export default function RegisterPage() {
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'patient'
    }
  })

  const onSubmit = async (values) => {
    try {
      await apiClient.post(
        '/auth/register',
        {
          name: values.name,
          phone: values.phone,
          email: values.email,
          password: values.password,
          role: values.role
        },
        { skipErrorToast: true }
      )
      toastSuccess('Account created. Please sign in.')
      navigate('/login', { replace: true })
    } catch (error) {
      toastError(error.response?.data?.message || 'Registration failed')
    }
  }

  return (
    <div style={styles.wrapper}>
      <form style={styles.card} onSubmit={handleSubmit(onSubmit)}>
        <h1 style={styles.title}>Create account</h1>
        <p style={styles.subtitle}>Provide your details and role to request access.</p>

        <label style={styles.label}>
          Name
          <input style={styles.input} {...register('name')} />
          {errors.name ? <span style={styles.error}>{errors.name.message}</span> : null}
        </label>

        <label style={styles.label}>
          Phone
          <input style={styles.input} {...register('phone')} />
          {errors.phone ? <span style={styles.error}>{errors.phone.message}</span> : null}
        </label>

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
            autoComplete="new-password"
            {...register('password')}
          />
          {errors.password ? <span style={styles.error}>{errors.password.message}</span> : null}
        </label>

        <label style={styles.label}>
          Role
          <select style={styles.input} {...register('role')}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.role ? <span style={styles.error}>{errors.role.message}</span> : null}
        </label>

        <label style={styles.label}>
          Confirm password
          <input
            style={styles.input}
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword ? (
            <span style={styles.error}>{errors.confirmPassword.message}</span>
          ) : null}
        </label>

        <button type="submit" style={styles.primary} disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>

        <p style={styles.footer}>
          Already have access?{' '}
          <button type="button" style={styles.linkButton} onClick={() => navigate('/login')}>
            Sign in
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
    background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)'
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
    border: '1px solid #cbd5f5',
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
