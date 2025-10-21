export default function ReportTable({ table, loading }: { table?: { columns: string[]; rows: any[] }; loading?: boolean }) {
  if (loading) {
    return (
      <div style={skeleton}>Loading...</div>
    )
  }
  if (!table || !table.columns?.length) {
    return <div style={nodata}>No data for selected filters</div>
  }
  return (
    <div style={wrap}>
      <table style={tbl}>
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c} style={th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, idx) => (
            <tr key={idx}>
              {table.columns.map((c) => (
                <td key={c} style={td}>
                  {String(r[c] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const wrap: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '0.25rem', border: '1px solid #e2e8f0', overflow: 'auto', maxHeight: 420 }
const tbl: React.CSSProperties = { borderCollapse: 'separate', width: '100%' }
const th: React.CSSProperties = { position: 'sticky', top: 0, background: '#f1f5f9', textAlign: 'left', padding: '8px', fontSize: 12, color: '#334155' }
const td: React.CSSProperties = { padding: '8px', borderTop: '1px solid #e2e8f0', fontSize: 13 }
const nodata: React.CSSProperties = { background: '#fff', padding: '1rem', textAlign: 'center', borderRadius: 12, border: '1px solid #e2e8f0' }
const skeleton: React.CSSProperties = { background: '#f8fafc', padding: '1rem', borderRadius: 12, color: '#64748b' }

