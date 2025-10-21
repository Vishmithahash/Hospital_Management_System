export default function InsuranceDetailsCard({ insurance, status, editable = false, onEdit }) {
  const validText = status || (insurance?.validUntil && new Date(insurance.validUntil) > new Date() ? 'VALID' : 'EXPIRED')
  return (
    <section style={card}>
      <header style={header}>
        <div>
          <h3 style={title}>Insurance Details</h3>
          <p style={sub}>Policy and validity</p>
        </div>
        {editable ? (
          <button style={link} onClick={onEdit}>Edit</button>
        ) : null}
      </header>
      {insurance ? (
        <div style={grid}>
          <Field label="Provider" value={insurance.provider || '-'} />
          <Field label="Policy number" value={insurance.policyNo || insurance.policyNumber || '-'} />
          <Field label="Valid until" value={dateOrDash(insurance.validUntil || insurance.validTo)} />
          <div>
            <div style={{ color: '#64748b', marginBottom: 4 }}>Status</div>
            <span style={badge(validText)}>{validText}</span>
          </div>
        </div>
      ) : (
        <p style={{ color: '#64748b' }}>No insurance on file.</p>
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

function dateOrDash(value) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.valueOf()) ? '-' : d.toLocaleDateString()
}

const badge = (s) => ({ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: s === 'VALID' ? '#dcfce7' : s === 'INVALID' ? '#fee2e2' : '#fef3c7', color: s === 'VALID' ? '#166534' : s === 'INVALID' ? '#991b1b' : '#92400e', fontWeight: 600 })
const card = { background: '#fff', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 20px 40px rgba(15,23,42,0.08)' }
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }
const title = { margin: 0 }
const sub = { margin: 0, color: '#64748b' }
const link = { background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '9999px', padding: '0.35rem 0.75rem', cursor: 'pointer' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }
