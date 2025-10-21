export default function ErrorBanner({ message, onRetry }) {
  if (!message) {
    return null
  }

  return (
    <div style={container}>
      <span>{message}</span>
      {onRetry ? (
        <button style={button} onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}

const container = {
  padding: '0.75rem 1rem',
  background: 'rgba(254, 226, 226, 0.9)',
  border: '1px solid #f87171',
  borderRadius: '0.75rem',
  color: '#7f1d1d',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem'
}

const button = {
  background: '#ef4444',
  color: '#fff',
  border: 'none',
  borderRadius: '9999px',
  padding: '0.35rem 0.9rem',
  cursor: 'pointer'
}
