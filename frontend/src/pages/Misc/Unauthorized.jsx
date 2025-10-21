import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../app/store'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const handleBack = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.code}>403</h1>
      <p style={styles.message}>You don&apos;t have access to that screen.</p>
      <button style={styles.button} onClick={handleBack}>
        Back to login
      </button>
    </div>
  )
}

const styles = {
  wrapper: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '4rem 1rem',
    textAlign: 'center'
  },
  code: {
    fontSize: '4rem',
    marginBottom: '0.5rem',
    color: '#f97316'
  },
  message: {
    marginBottom: '1.5rem',
    color: '#475569'
  },
  button: {
    display: 'inline-block',
    padding: '0.6rem 1.25rem',
    borderRadius: '9999px',
    background: '#f97316',
    color: '#fff',
    border: 'none',
    cursor: 'pointer'
  }
}
