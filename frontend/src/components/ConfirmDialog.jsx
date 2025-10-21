export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}) {
  if (!open) {
    return null
  }

  return (
    <div style={backdrop}>
      <div style={dialog}>
        {title ? <h3 style={heading}>{title}</h3> : null}
        <p style={body}>{message}</p>
        <div style={actions}>
          <button style={secondaryButton} onClick={onCancel}>
            {cancelText}
          </button>
          <button style={primaryButton} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

const backdrop = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
}

const dialog = {
  width: '360px',
  background: '#fff',
  padding: '1.5rem',
  borderRadius: '1rem',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)'
}

const heading = {
  margin: 0,
  marginBottom: '0.75rem',
  fontSize: '1.25rem'
}

const body = {
  margin: 0,
  marginBottom: '1.5rem',
  color: '#475569'
}

const actions = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem'
}

const primaryButton = {
  padding: '0.5rem 1rem',
  background: '#0ea5e9',
  borderRadius: '9999px',
  border: 'none',
  color: '#fff',
  cursor: 'pointer'
}

const secondaryButton = {
  ...primaryButton,
  background: '#cbd5f5',
  color: '#1e293b'
}
