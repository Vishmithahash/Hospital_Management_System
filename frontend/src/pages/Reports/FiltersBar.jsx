import dayjs from 'dayjs'

export default function FiltersBar({ filters, onChange }) {
  const applyPreset = (days) => {
    onChange({
      ...filters,
      from: dayjs().subtract(days, 'day').format('YYYY-MM-DD'),
      to: dayjs().format('YYYY-MM-DD')
    })
  }

  return (
    <div style={container}>
      <span style={label}>Range</span>
      <div style={chipGroup}>
        <button style={chip} onClick={() => applyPreset(7)}>
          Last 7 days
        </button>
        <button style={chip} onClick={() => applyPreset(30)}>
          Last 30 days
        </button>
        <button style={chip} onClick={() => applyPreset(90)}>
          Last quarter
        </button>
      </div>
      <label style={dateLabel}>
        From
        <input
          type="date"
          style={dateInput}
          value={filters.from || ''}
          onChange={(event) => onChange({ ...filters, from: event.target.value })}
        />
      </label>
      <label style={dateLabel}>
        To
        <input
          type="date"
          style={dateInput}
          value={filters.to || ''}
          onChange={(event) => onChange({ ...filters, to: event.target.value })}
        />
      </label>
    </div>
  )
}

const container = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(226, 232, 240, 0.6)'
}

const label = {
  fontWeight: 600,
  color: '#475569'
}

const chipGroup = {
  display: 'flex',
  gap: '0.5rem'
}

const chip = {
  borderRadius: '9999px',
  border: '1px solid #cbd5f5',
  background: '#fff',
  padding: '0.35rem 0.9rem',
  cursor: 'pointer'
}

const dateLabel = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.9rem'
}

const dateInput = {
  borderRadius: '0.75rem',
  border: '1px solid #cbd5f5',
  padding: '0.35rem 0.75rem'
}
