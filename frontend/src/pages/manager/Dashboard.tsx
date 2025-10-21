import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { defaultRange, generateReport } from '../../lib/reportApi'

type TrendPoint = { label: string; value: number }
type PaymentSplit = { method: string; total: number; tx: number }
type StatusHighlight = { status: string; total: number }

type OverviewState = {
  visitsToday: number
  visitsDelta: number
  visitsTrend: TrendPoint[]
  visitsAverage: number
  apptToday: number
  peakHour: string | number
  paymentsToday: number
  paymentsDelta: number
  paymentsAverage: number
  paymentsSplit: PaymentSplit[]
  statusHighlights: StatusHighlight[]
  insights: string[]
}

const initialOverview: OverviewState = {
  visitsToday: 0,
  visitsDelta: 0,
  visitsTrend: [],
  visitsAverage: 0,
  apptToday: 0,
  peakHour: '--',
  paymentsToday: 0,
  paymentsDelta: 0,
  paymentsAverage: 0,
  paymentsSplit: [],
  statusHighlights: [],
  insights: []
}

export default function ManagerDashboard() {
  const [overview, setOverview] = useState<OverviewState>(initialOverview)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const today = { from: dayjs().format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }
      const week = defaultRange(7)
      try {
        const [visitsWeek, apptWeek, peakToday, paymentsToday, paymentsWeek] = await Promise.all([
          generateReport({ type: 'DAILY_VISITS', range: week, preview: true }),
          generateReport({ type: 'APPT_LOAD', range: week, preview: true }),
          generateReport({ type: 'PEAK_HOURS', range: today, preview: true }),
          generateReport({ type: 'PAYMENT_SUMMARY', range: today, preview: true }),
          generateReport({ type: 'PAYMENT_SUMMARY', range: week, preview: true })
        ])

        const visitsTrend = (visitsWeek.table.rows || []).map((row: any) => ({
          label: dayjs(row.day).format('DD MMM'),
          value: Number(row.visits || 0)
        }))
        const visitsTodayVal = visitsTrend.at(-1)?.value ?? 0
        const visitsPrev = visitsTrend.at(-2)?.value ?? visitsTodayVal
        const visitsAverage = visitsTrend.length
          ? Math.round(visitsTrend.reduce((sum, item) => sum + item.value, 0) / visitsTrend.length)
          : 0

        const apptColumns = (apptWeek.table.columns || []).filter((c: string) => c !== 'day')
        const apptRows = apptWeek.table.rows || []
        const todayKey = dayjs(today.to).format('YYYY-MM-DD')
        const todayRow = apptRows.find((row: any) => row.day === todayKey) || apptRows.at(-1) || {}
        const apptTodayTotal = apptColumns.reduce((sum: number, key: string) => sum + Number(todayRow[key] || 0), 0)
        const statusTotals = apptRows.reduce((acc: Record<string, number>, row: any) => {
          apptColumns.forEach((key) => {
            acc[key] = (acc[key] || 0) + Number(row[key] || 0)
          })
          return acc
        }, {})
        const statusHighlights = Object.entries(statusTotals)
          .map(([status, total]) => ({ status, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 3)

        const peakHour = (peakToday.table.rows || []).reduce(
          (best: any, row: any) => (row.count > (best?.count || -1) ? row : best),
          null
        )?.hour ?? '--'

        const paymentsTodayTotal = (paymentsToday.table.rows || []).reduce(
          (sum: number, row: any) => sum + Number(row.total_lkr || 0),
          0
        )
        const paymentsSplit = (paymentsWeek.table.rows || []).map((row: any) => ({
          method: row.method,
          total: Number(row.total_lkr || 0),
          tx: Number(row.tx_count || 0)
        }))
        const paymentsWeekTotal = paymentsSplit.reduce((sum, row) => sum + row.total, 0)
        const paymentsAverage = visitsTrend.length ? paymentsWeekTotal / visitsTrend.length : paymentsWeekTotal

        const insights: string[] = []
        if (visitsTodayVal >= visitsPrev) insights.push(`Visits are up by ${Math.abs(visitsTodayVal - visitsPrev)} vs yesterday.`)
        else insights.push(`Visits dipped by ${Math.abs(visitsTodayVal - visitsPrev)} vs yesterday.`)
        if (paymentsTodayTotal >= paymentsAverage) {
          insights.push('Today’s revenue is tracking above the 7-day average.')
        } else {
          insights.push('Revenue is currently below the rolling weekly average.')
        }
        if (peakHour !== '--') insights.push(`Peak appointment hour is ${peakHour}:00 today.`)
        if (statusHighlights[0]) insights.push(`${formatStatus(statusHighlights[0].status)} leads the weekly volume.`)

        setOverview({
          visitsToday: visitsTodayVal,
          visitsDelta: visitsTodayVal - visitsPrev,
          visitsTrend,
          visitsAverage,
          apptToday: apptTodayTotal,
          peakHour,
          paymentsToday: paymentsTodayTotal,
          paymentsDelta: paymentsTodayTotal - paymentsAverage,
          paymentsAverage,
          paymentsSplit,
          statusHighlights,
          insights
        })
      } catch (error) {
        setOverview(initialOverview)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const sparkPath = useMemo(() => generateSparklinePath(overview.visitsTrend.map((p) => p.value)), [overview.visitsTrend])

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <h1 style={heroTitle}>Manager Dashboard</h1>
          <p style={heroSubtitle}>Live clinic performance, finance health, and quick links in one curated view.</p>
        </div>
        <Link to="/manager/reports" style={heroCta}>Open Reports Suite</Link>
      </section>

      <section style={statsGrid}>
        <StatCard
          title="Visits today"
          value={formatNumber(overview.visitsToday)}
          delta={overview.visitsDelta}
          deltaHint="vs yesterday"
          loading={loading}
        />
        <StatCard
          title="Appointments booked"
          value={formatNumber(overview.apptToday)}
          delta={null}
          deltaHint="Live total"
          loading={loading}
        />
        <StatCard
          title="Peak hour"
          value={loading ? '—' : typeof overview.peakHour === 'number' ? `${String(overview.peakHour).padStart(2, '0')}:00` : '—'}
          delta={null}
          deltaHint="Today's peak"
          loading={loading}
        />
        <StatCard
          title="Revenue today"
          value={formatCurrency(overview.paymentsToday)}
          delta={overview.paymentsDelta}
          deltaHint="vs 7-day avg"
          loading={loading}
          deltaFormatter={(val) => formatCurrency(val)}
        />
      </section>

      <section style={twoColumn}>
        <div style={trendCard}>
          <header style={cardHeader}>
            <div>
              <h3 style={cardTitle}>Visits · last 7 days</h3>
              <p style={cardSubtitle}>Average {formatNumber(Math.round(overview.visitsAverage))} per day</p>
            </div>
          </header>
          <div style={sparklineBox}>
            {loading || !sparkPath ? (
              <div style={sparkSkeleton} />
            ) : (
              <svg viewBox="0 0 260 80" style={{ width: '100%', height: 80 }}>
                <defs>
                  <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={sparkPath} stroke="#0ea5e9" strokeWidth={2} fill="none" />
                <path d={`${sparkPath} L260 80 L0 80 Z`} fill="url(#spark)" opacity={0.4} />
              </svg>
            )}
          </div>
          <ul style={sparkLegend}>
            {overview.visitsTrend.slice(-5).map((point) => (
              <li key={point.label} style={sparkItem}>
                <span>{point.label}</span>
                <strong>{formatNumber(point.value)}</strong>
              </li>
            ))}
          </ul>
        </div>

        <div style={insightsCard}>
          <header style={cardHeader}>
            <div>
              <h3 style={cardTitle}>Operational highlights</h3>
              <p style={cardSubtitle}>Track leading statuses and payment mix.</p>
            </div>
          </header>
          <div style={highlightGrid}>
            <div>
              <h4 style={highlightTitle}>Top appointment statuses</h4>
              <ul style={listReset}>
                {(loading ? [] : overview.statusHighlights).map((item) => (
                  <li key={item.status} style={highlightItem}>
                    <span style={badge}>{formatStatus(item.status)}</span>
                    <strong>{formatNumber(item.total)}</strong>
                  </li>
                ))}
                {loading ? <li style={highlightPlaceholder} /> : null}
              </ul>
            </div>
            <div>
              <h4 style={highlightTitle}>Payment mix (7 days)</h4>
              <ul style={listReset}>
                {(loading ? [] : overview.paymentsSplit).map((item) => (
                  <li key={item.method} style={highlightItem}>
                    <span style={badge}>{formatStatus(item.method)}</span>
                    <span>
                      <strong>{formatCurrency(item.total)}</strong>
                      <small style={smallMuted}>{item.tx} tx</small>
                    </span>
                  </li>
                ))}
                {loading ? <li style={highlightPlaceholder} /> : null}
              </ul>
            </div>
          </div>
          <div style={insightsList}>
            {(loading ? [] : overview.insights).map((line, idx) => (
              <div key={idx} style={insightRow}>
                <span style={dot} />
                <p style={insightText}>{line}</p>
              </div>
            ))}
            {loading ? <div style={insightSkeleton} /> : null}
          </div>
        </div>
      </section>

      <section style={quickSection}>
        <h3 style={cardTitle}>Quick actions</h3>
        <div style={actionGrid}>
          {quickActions.map((action) => (
            <Link key={action.title} to={action.to} style={actionCard}>
              <span style={actionTitle}>{action.title}</span>
              <span style={actionSubtitle}>{action.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}

function StatCard({
  title,
  value,
  delta,
  loading,
  deltaHint = 'vs previous',
  deltaFormatter
}: {
  title: string
  value: string
  delta: number | null
  loading: boolean
  deltaHint?: string
  deltaFormatter?: (value: number) => string
}) {
  const hasDelta = delta !== null && delta !== undefined && !Number.isNaN(delta)
  let deltaLabel = deltaHint
  let deltaColor = '#64748b'
  if (loading) {
    deltaLabel = 'Loading…'
  } else if (hasDelta) {
    const formatted = deltaFormatter ? deltaFormatter(Math.abs(delta!)) : formatNumber(Math.round(Math.abs(delta!)))
    if (delta === 0) {
      deltaLabel = `Stable ${deltaHint}`
    } else if (delta! > 0) {
      deltaLabel = `+${formatted} ${deltaHint}`
      deltaColor = '#15803d'
    } else {
      deltaLabel = `-${formatted} ${deltaHint}`
      deltaColor = '#b91c1c'
    }
  }
  return (
    <div style={statCard}>
      <div style={statLabel}>{title}</div>
      <div style={statValue}>{loading ? '—' : value}</div>
      <div style={{ fontSize: 12, color: deltaColor }}>{deltaLabel}</div>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value || 0)
}

function formatCurrency(value: number) {
  return `LKR ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)}`
}

function formatStatus(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function generateSparklinePath(values: number[]) {
  if (!values.length) return ''
  const width = 260
  const height = 80
  const pad = 6
  const max = Math.max(...values)
  const min = Math.min(...values)
  const diff = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : width
  return values
    .map((value, idx) => {
      const x = idx * step
      const norm = (value - min) / diff
      const y = height - pad - norm * (height - pad * 2)
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

const quickActions = [
  { title: 'Schedule review', description: 'Check doctor availability and waitlists.', to: '/appointments/staff' },
  { title: 'Outbound notifications', description: 'Broadcast updates to patients or staff.', to: '/notifications' },
  { title: 'Financial report', description: 'Jump straight to revenue analytics.', to: '/manager/reports?tab=payments' }
]

const page: React.CSSProperties = {
  padding: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  background: '#f8fafc',
  minHeight: '100vh'
}

const hero: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0ea5e9 0%, #22d3ee 100%)',
  borderRadius: 20,
  padding: '2rem 2.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  color: '#fff'
}

const heroTitle: React.CSSProperties = { margin: 0, fontSize: 28, fontWeight: 700 }
const heroSubtitle: React.CSSProperties = { marginTop: 8, marginBottom: 0, opacity: 0.9 }
const heroCta: React.CSSProperties = {
  background: '#fff',
  color: '#0f172a',
  padding: '0.75rem 1.5rem',
  borderRadius: 999,
  textDecoration: 'none',
  fontWeight: 600,
  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)'
}

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1rem'
}

const statCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 16,
  padding: '1.5rem',
  border: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)'
}

const statLabel: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, color: '#64748b' }
const statValue: React.CSSProperties = { fontSize: 32, fontWeight: 700, color: '#0f172a' }

const twoColumn: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
  gap: '1.5rem'
}

const cardBase: React.CSSProperties = {
  background: '#fff',
  borderRadius: 20,
  border: '1px solid #e2e8f0',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.07)',
  padding: '1.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem'
}

const trendCard: React.CSSProperties = { ...cardBase }
const insightsCard: React.CSSProperties = { ...cardBase }

const cardHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }
const cardTitle: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a' }
const cardSubtitle: React.CSSProperties = { margin: 0, fontSize: 13, color: '#64748b' }

const sparklineBox: React.CSSProperties = { background: '#f1f5f9', borderRadius: 16, padding: '0.75rem 1rem' }
const sparkSkeleton: React.CSSProperties = { height: 80, borderRadius: 12, background: 'linear-gradient(90deg, #e2e8f0, #f8fafc, #e2e8f0)' }
const sparkLegend: React.CSSProperties = { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0 }
const sparkItem: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#0f172a' }

const highlightGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }
const highlightTitle: React.CSSProperties = { margin: 0, marginBottom: 8, fontSize: 14, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }
const listReset: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }
const highlightItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  background: '#f8fafc',
  borderRadius: 12,
  padding: '0.75rem 1rem',
  border: '1px solid #e2e8f0'
}
const highlightPlaceholder: React.CSSProperties = { height: 44, borderRadius: 12, background: '#e2e8f0' }
const badge: React.CSSProperties = { background: '#e0f2fe', color: '#0c4a6e', fontSize: 12, padding: '0.25rem 0.5rem', borderRadius: 8, fontWeight: 600 }
const smallMuted: React.CSSProperties = { display: 'block', fontSize: 11, color: '#64748b' }

const insightsList: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }
const insightRow: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start' }
const insightText: React.CSSProperties = { margin: 0, color: '#334155', fontSize: 13, lineHeight: 1.4 }
const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9', marginTop: 5 }
const insightSkeleton: React.CSSProperties = { height: 16, borderRadius: 4, background: '#e2e8f0', width: '60%' }

const quickSection: React.CSSProperties = { ...cardBase, gap: '1rem' }
const actionGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }
const actionCard: React.CSSProperties = {
  background: '#0ea5e9',
  color: '#fff',
  padding: '1rem 1.25rem',
  borderRadius: 14,
  textDecoration: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  boxShadow: '0 12px 30px rgba(14, 165, 233, 0.25)'
}
const actionTitle: React.CSSProperties = { fontWeight: 600, fontSize: 16 }
const actionSubtitle: React.CSSProperties = { fontSize: 13, opacity: 0.85 }

