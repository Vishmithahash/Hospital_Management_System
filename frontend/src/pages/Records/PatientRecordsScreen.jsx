import ErrorBanner from '../../components/ErrorBanner.jsx'
import ChangeLogPanel from './ChangeLogPanel.jsx'
import {
  layout as defaultLayout,
  twoColumnGrid,
  card,
  cardHeader,
  cardTitle,
  cardSubtitle
} from './recordStyles.js'

export default function PatientRecordsScreen({
  layoutStyle,
  patient,
  auditEntries,
  loading,
  error,
  onRetry
}) {
  return (
    <main style={layoutStyle || defaultLayout}>
      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}
      <div style={twoColumnGrid}>
        <section style={card}>
          <header style={cardHeader}>
            <div>
              <h2 style={cardTitle}>Your profile</h2>
              <p style={cardSubtitle}>Review the personal details we have on file.</p>
            </div>
          </header>
          {loading ? (
            <p>Loading your information...</p>
          ) : patient ? (
            <div style={detailsGrid}>
              <Detail label="First name" value={patient.demographics?.firstName} />
              <Detail label="Last name" value={patient.demographics?.lastName} />
              <Detail
                label="Date of birth"
                value={formatDate(patient.demographics?.dob)}
              />
              <Detail label="Gender" value={capitalize(patient.demographics?.gender)} />
              <Detail label="Contact email" value={patient.demographics?.email} />
              <Detail label="Phone" value={patient.demographics?.phone} />
            </div>
          ) : (
            <p>No profile data available.</p>
          )}
        </section>
        <aside style={card}>
          <header style={cardHeader}>
            <div>
              <h3 style={cardTitle}>Insurance</h3>
              <p style={cardSubtitle}>Coverage details provided to the clinic.</p>
            </div>
          </header>
          {loading ? (
            <p>Loading insurance...</p>
          ) : patient?.insurance ? (
            <div style={detailsGrid}>
              <Detail label="Provider" value={patient.insurance?.provider} />
              <Detail label="Policy number" value={patient.insurance?.policyNo} />
              <Detail label="Valid until" value={formatDate(patient.insurance?.validUntil)} />
            </div>
          ) : (
            <p>No insurance on file.</p>
          )}
        </aside>
      </div>

      <section style={card}>
        <header style={cardHeader}>
          <div>
            <h3 style={cardTitle}>Recent changes</h3>
            <p style={cardSubtitle}>Updates made by clinic staff.</p>
          </div>
        </header>
        <ChangeLogPanel entries={auditEntries} loading={loading} />
      </section>
    </main>
  )
}

function formatDate(value) {
  if (!value) {
    return '--'
  }

  const date = new Date(value)

  if (Number.isNaN(date.valueOf())) {
    return '--'
  }

  return date.toLocaleDateString()
}

function capitalize(value) {
  if (typeof value !== 'string' || !value.length) {
    return '--'
  }

  return value[0].toUpperCase() + value.slice(1)
}

function Detail({ label, value }) {
  return (
    <div style={detailItem}>
      <span style={detailLabel}>{label}</span>
      <span style={detailValue}>{value ?? '--'}</span>
    </div>
  )
}

const detailsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '1.25rem'
}

const detailItem = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  padding: '0.5rem 0'
}

const detailLabel = {
  fontSize: '0.85rem',
  color: '#64748b',
  textTransform: 'uppercase'
}

const detailValue = {
  fontSize: '1rem',
  color: '#0f172a'
}
