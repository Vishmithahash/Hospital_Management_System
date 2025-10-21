import EmptyState from '../../components/EmptyState.jsx'
import { formatDateTime } from '../../lib/formatters.js'

export default function ChangeLogPanel({ entries = [], loading }) {
  if (loading) {
    return <p style={loadingStyle}>Loading…</p>
  }

  if (!entries.length) {
    return (
      <EmptyState
        title="No changes logged"
        message="Updates and corrections will appear here for audit purposes."
      />
    )
  }

  return (
    <ul style={list}>
      {entries.map((entry) => (
        <li key={entry._id || entry.at} style={item}>
          <div style={header}>
            <strong>{entry.action}</strong>
            <span>{formatDateTime(entry.at)}</span>
          </div>
          {Array.isArray(entry.diff) && entry.diff.length > 0 ? (
            <dl style={diffBlock}>
              {entry.diff.map((change, index) => (
                <div key={index} style={diffItem}>
                  <dt style={diffKey}>{change.path}</dt>
                  <dd style={diffValue}>
                    <span style={badge}>from</span> {renderValue(change.before)}
                    <span style={badge}>to</span> {renderValue(change.after)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function renderValue(value) {
  if (value === null || typeof value === 'undefined') {
    return <em>empty</em>
  }

  if (typeof value === 'object') {
    return <code style={code}>{JSON.stringify(value)}</code>
  }

  return String(value)
}

const loadingStyle = {
  color: '#64748b'
}

const list = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const item = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '1rem'
}

const header = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '0.75rem',
  color: '#475569'
}

const diffBlock = {
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem'
}

const diffItem = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: '0.5rem'
}

const diffKey = {
  margin: 0,
  fontWeight: 600
}

const diffValue = {
  margin: 0,
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  flexWrap: 'wrap'
}

const badge = {
  padding: '0.15rem 0.5rem',
  borderRadius: '9999px',
  background: '#e0f2fe',
  color: '#0369a1',
  fontSize: '0.75rem'
}

const code = {
  background: '#0f172a',
  color: '#e2e8f0',
  padding: '0.1rem 0.35rem',
  borderRadius: '0.35rem',
  fontSize: '0.8rem'
}
