export default function ReportTable({ columns = [], data = [], emptyMessage = 'No data' }) {
  if (!data.length) {
    return <p style={emptyStyle}>{emptyMessage}</p>
  }

  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={headerCell}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} style={rowStyle}>
              {columns.map((column) => (
                <td key={column.key} style={cell}>
                  {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const tableWrap = {
  overflowX: 'auto'
}

const table = {
  width: '100%',
  borderCollapse: 'collapse'
}

const headerCell = {
  textAlign: 'left',
  padding: '0.75rem',
  background: '#e2e8f0',
  color: '#0f172a'
}

const cell = {
  padding: '0.75rem',
  borderBottom: '1px solid #e2e8f0'
}

const rowStyle = {
  background: '#fff'
}

const emptyStyle = {
  margin: 0,
  padding: '1rem',
  color: '#64748b'
}
