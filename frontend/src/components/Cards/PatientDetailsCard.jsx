export default function PatientDetailsCard({ patient, editable = false, onEdit }) {
  return (
    <section style={card}>
      <header style={header}>
        <div>
          <h3 style={title}>Patient Details</h3>
          <p style={sub}>Demographics and contact</p>
        </div>
        {editable ? (
          <button style={link} onClick={onEdit}>Edit</button>
        ) : null}
      </header>
      {patient ? (
        <div style={grid}>
          <Field label="Full name" value={`${patient.demographics?.firstName || ''} ${patient.demographics?.lastName || ''}`.trim() || '-'} />
          <Field label="Phone" value={patient.demographics?.phone || '-'} />
          <Field label="Date of birth" value={patient.demographics?.dob ? new Date(patient.demographics.dob).toLocaleDateString() : '-'} />
          <Field label="Gender" value={patient.demographics?.gender || '-'} />
          <Field label="Address" value={patient.demographics?.address || '-'} />
          <Field label="Blood group" value={patient.demographics?.bloodGroup || '-'} />
          <Field label="Emergency contact" value={patient.demographics?.emergencyContact || '-'} />
        </div>
      ) : (
        <p style={{ color: '#64748b' }}>No data.</p>
      )}
    </section>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div>{value}</div>
    </div>
  )
}

const card = { background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 20px 40px rgba(15,23,42,0.08)' }
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }
const title = { margin: 0 }
const sub = { margin: 0, color: '#64748b' }
const link = { background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '9999px', padding: '0.35rem 0.75rem', cursor: 'pointer' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }

