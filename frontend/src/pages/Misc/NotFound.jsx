import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={styles.wrapper}>
      <h1 style={styles.code}>404</h1>
      <p style={styles.message}>We couldn&apos;t find that page.</p>
      <Link to="/dashboard" style={styles.link}>
        Back to dashboard
      </Link>
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
    color: '#0ea5e9'
  },
  message: {
    marginBottom: '1.5rem',
    color: '#475569'
  },
  link: {
    display: 'inline-block',
    padding: '0.6rem 1.25rem',
    borderRadius: '9999px',
    background: '#0ea5e9',
    color: '#fff',
    textDecoration: 'none'
  }
}
