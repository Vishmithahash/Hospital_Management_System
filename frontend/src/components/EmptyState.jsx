export default function EmptyState({ title, message, action }) {
  return (
    <div style={wrapper}>
      <div style={icon}>☁️</div>
      {title ? <h3 style={heading}>{title}</h3> : null}
      {message ? <p style={text}>{message}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  )
}

const wrapper = {
  padding: '2rem',
  textAlign: 'center',
  border: '1px dashed #94a3b8',
  borderRadius: '1rem',
  background: 'rgba(241, 245, 249, 0.6)',
  color: '#334155'
}

const icon = {
  fontSize: '2.5rem',
  marginBottom: '0.5rem'
}

const heading = {
  margin: 0,
  marginBottom: '0.5rem'
}

const text = {
  margin: 0,
  marginBottom: '1rem'
}
