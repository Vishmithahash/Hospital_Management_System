import ErrorBanner from '../../components/ErrorBanner.jsx'
import ChangeLogPanel from './ChangeLogPanel.jsx'
import RecordEditForm from './RecordEditForm.jsx'
import DoctorNotesCard from './DoctorNotesCard.jsx'
import {
  layout as defaultLayout,
  twoColumnGrid,
  card,
  cardHeader,
  cardTitle,
  cardSubtitle,
  sectionStack
} from './recordStyles.js'

export default function DoctorRecordsScreen({
  layoutStyle,
  patient,
  auditEntries,
  loading,
  error,
  onRetry,
  onPatientUpdated
}) {
  return (
    <main style={layoutStyle || defaultLayout}>
      {error ? <ErrorBanner message={error} onRetry={onRetry} /> : null}
      <div style={twoColumnGrid}>
        <section style={card}>
          <header style={cardHeader}>
            <div>
              <h2 style={cardTitle}>
                {patient?.demographics?.firstName} {patient?.demographics?.lastName}
              </h2>
              <p style={cardSubtitle}>Patient profile & insurance</p>
            </div>
          </header>
          <RecordEditForm patient={patient} loading={loading} onUpdated={onPatientUpdated} />
        </section>
        <aside style={sectionStack}>
          <section style={card}>
            <header style={cardHeader}>
              <div>
                <h3 style={cardTitle}>Change log</h3>
                <p style={cardSubtitle}>Recent updates and corrections</p>
              </div>
            </header>
            <ChangeLogPanel entries={auditEntries} loading={loading} />
          </section>
          <DoctorNotesCard patient={patient} loading={loading} />
        </aside>
      </div>
    </main>
  )
}
