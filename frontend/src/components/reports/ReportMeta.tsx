export default function ReportMeta({ meta }: { meta?: any }) {
  if (!meta) return null
  return (
    <div style={wrap}>
      <div>
        <div style={label}>Report Type</div>
        <div style={value}>{meta.type}</div>
      </div>
      <div>
        <div style={label}>Date Range</div>
        <div style={value}>
          {meta.range?.from} → {meta.range?.to}
        </div>
      </div>
      <div>
        <div style={label}>Generated</div>
        <div style={value}>{new Date(meta.generatedAt).toLocaleString()}</div>
      </div>
      <div>
        <div style={label}>Timezone</div>
        <div style={value}>{meta.tz}</div>
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '1rem',
  background: '#fff',
  borderRadius: 12,
  padding: '0.75rem 1rem',
  border: '1px solid #e2e8f0'
}
const label: React.CSSProperties = { fontSize: 12, color: '#64748b' }
const value: React.CSSProperties = { fontWeight: 600 }

