import { card, cardHeader, cardTitle, cardSubtitle } from './recordStyles.js'

function normalizeNotes(patient) {
  if (!patient) {
    return []
  }

  const candidate = patient.doctorNotes || patient.clinicalNotes || patient.notes

  if (!candidate) {
    return []
  }

  if (Array.isArray(candidate)) {
    return candidate
  }

  return [candidate]
}

function formatNoteText(note) {
  if (!note) {
    return ''
  }

  if (typeof note === 'string') {
    return note
  }

  if (typeof note === 'object') {
    if (note.text) {
      return note.text
    }
    if (note.note) {
      return note.note
    }
  }

  return JSON.stringify(note)
}

export default function DoctorNotesCard({ patient, loading }) {
  const notes = normalizeNotes(patient)

  return (
    <section style={card}>
      <header style={cardHeader}>
        <div>
          <h3 style={cardTitle}>Doctor notes</h3>
          <p style={cardSubtitle}>Clinical-only annotations</p>
        </div>
      </header>
      {loading ? (
        <p>Loading notes...</p>
      ) : notes.length ? (
        <ul style={listStyle}>
          {notes.map((note, index) => (
            <li key={note.id || note._id || index} style={noteItem}>
              <p style={noteText}>{formatNoteText(note)}</p>
              {note.author ? <span style={noteMeta}>By {note.author}</span> : null}
              {note.createdAt ? (
                <span style={noteMeta}>
                  {new Date(note.createdAt).toLocaleString(undefined, {
                    hour12: false
                  })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>No doctor notes recorded yet.</p>
      )}
    </section>
  )
}

const listStyle = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const noteItem = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '0.85rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  background: '#f8fafc'
}

const noteText = {
  margin: 0,
  color: '#0f172a',
  lineHeight: 1.5
}

const noteMeta = {
  color: '#64748b',
  fontSize: '0.8rem'
}
