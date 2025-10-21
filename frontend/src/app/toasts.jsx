import { useEffect } from 'react'
import { useToastStore } from './store.js'

const TYPE_COLORS = {
  info: '#0ea5e9',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444'
}

export function Toasts() {
  const { toasts, removeToast } = useToastStore()

  useEffect(() => {
    if (!toasts.length) {
      return
    }

    const timers = toasts.map((toast) =>
      setTimeout(() => removeToast(toast.id), toast.timeout ?? 4000)
    )

    return () => timers.forEach((id) => clearTimeout(id))
  }, [toasts, removeToast])

  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <div key={toast.id} style={{ ...styles.toast, borderLeftColor: TYPE_COLORS[toast.type] }}>
          {toast.title ? <strong style={styles.title}>{toast.title}</strong> : null}
          <span>{toast.message}</span>
          <button style={styles.dismiss} onClick={() => removeToast(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

const styles = {
  container: {
    position: 'fixed',
    top: '1rem',
    right: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    zIndex: 9999
  },
  toast: {
    position: 'relative',
    minWidth: '240px',
    maxWidth: '320px',
    padding: '0.75rem 2.5rem 0.75rem 1rem',
    borderRadius: '0.75rem',
    borderLeftWidth: '6px',
    borderLeftStyle: 'solid',
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    color: '#f9fafb',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.25)',
    fontSize: '0.9rem',
    lineHeight: 1.4
  },
  title: {
    display: 'block',
    marginBottom: '0.25rem'
  },
  dismiss: {
    position: 'absolute',
    top: '0.35rem',
    right: '0.5rem',
    border: 'none',
    background: 'transparent',
    color: '#f9fafb',
    cursor: 'pointer',
    fontSize: '1.25rem'
  }
}
