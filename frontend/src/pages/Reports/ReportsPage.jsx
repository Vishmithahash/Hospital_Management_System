import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import apiClient from '../../app/apiClient.js'
import FiltersBar from './FiltersBar.jsx'
import ReportTable from './ReportTable.jsx'
import ReportChart from './ReportChart.jsx'
import { toastError, toastSuccess } from '../../app/toastHelpers.js'
import { downloadBlob } from '../../lib/formatters.js'

const TABS = [
  { key: 'visits', label: 'Visits', endpoint: '/reports/visits' },
  { key: 'revenue', label: 'Revenue', endpoint: '/reports/revenue' },
  { key: 'appointments', label: 'Appointments', endpoint: '/reports/appointments' }
]

const TABLE_COLUMNS = {
  visits: [
    { key: 'date', label: 'Date' },
    { key: 'count', label: 'Visits' }
  ],
  revenue: [
    { key: 'date', label: 'Date' },
    { key: 'method', label: 'Method' },
    {
      key: 'total',
      label: 'Total ($)',
      render: (value) => (typeof value === 'number' ? value.toFixed(2) : '--')
    },
    { key: 'count', label: 'Count' }
  ],
  appointments: [
    { key: 'status', label: 'Status' },
    { key: 'count', label: 'Count' }
  ]
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('visits')
  const [filters, setFilters] = useState({
    from: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD')
  })
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const tab = TABS.find((item) => item.key === activeTab)
      const { data: result } = await apiClient.get(tab.endpoint, {
        params: filters,
        skipErrorToast: true
      })
      setData(result)
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load report'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [activeTab, filters])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const exportReport = async () => {
    try {
      const { data: blob } = await apiClient.get('/reports/export', {
        params: {
          ...filters,
          type: activeTab,
          format: 'csv'
        },
        responseType: 'blob',
        skipErrorToast: true
      })

      downloadBlob(blob, `${activeTab}-report.csv`)
      toastSuccess('CSV download started', 'Export ready')
    } catch (err) {
      const message = err.response?.data?.message || 'Export failed'
      toastError(message, 'Export error')
    }
  }

  return (
    <main style={layout}>
      <header style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>Reports</h2>
          <p style={{ margin: '0.5rem 0 0', color: '#64748b' }}>
            Operational insights across appointments, revenue, and patient activity.
          </p>
        </div>
        <button style={exportButton} onClick={exportReport}>
          Export CSV
        </button>
      </header>

      <FiltersBar filters={filters} onChange={setFilters} />

      <nav style={tabsStyle}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={tabButton(tab.key === activeTab)}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? <p style={errorStyle}>{error}</p> : null}

      <section style={card}>
        {loading ? (
          <p>Loading report...</p>
        ) : (
          <>
            <ReportChart data={data} />
            <ReportTable columns={TABLE_COLUMNS[activeTab]} data={data} emptyMessage="No results" />
          </>
        )}
      </section>
    </main>
  )
}

const layout = {
  padding: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
}

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}

const exportButton = {
  borderRadius: '9999px',
  border: 'none',
  padding: '0.6rem 1.5rem',
  background: '#0ea5e9',
  color: '#fff',
  cursor: 'pointer'
}

const tabsStyle = {
  display: 'flex',
  gap: '1rem'
}

const tabButton = (active) => ({
  border: 'none',
  background: active ? '#0ea5e9' : '#e2e8f0',
  color: active ? '#fff' : '#1e293b',
  padding: '0.5rem 1.25rem',
  borderRadius: '9999px',
  cursor: 'pointer'
})

const card = {
  background: '#fff',
  borderRadius: '1rem',
  padding: '1.5rem',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
}

const errorStyle = {
  margin: 0,
  color: '#ef4444'
}
