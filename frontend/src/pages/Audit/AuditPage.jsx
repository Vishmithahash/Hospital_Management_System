import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import apiClient from '../../app/apiClient'
import { useAuthStore } from '../../app/store'
import { toastError } from '../../app/toastHelpers.js'

dayjs.extend(relativeTime)

function formatRelative(date) {
  if (!date) return 'Unknown time'
  const d = dayjs(date)
  if (!d.isValid()) return 'Unknown time'
  return `${d.fromNow()} · ${d.format('YYYY-MM-DD HH:mm')}`
}

function diffToObject(diff) {
  if (!diff) return {}
  if (Array.isArray(diff)) {
    return diff.reduce((acc, item) => {
      if (!item) return acc
      const key = item.path || item.field || item.key
      if (!key) return acc
      const value = item.value ?? item.after ?? item.to ?? item.current ?? item.newValue ?? item
      acc[key] = value
      return acc
    }, {})
  }
  if (typeof diff === 'object') return diff
  return {}
}

function formatCode(code) {
  if (!code || typeof code !== 'string') return null
  return code
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function resolveReportLabel(diffMap) {
  if (!diffMap) return null
  if (diffMap.reportLabel && typeof diffMap.reportLabel === 'string') return diffMap.reportLabel
  const code = typeof diffMap.reportType === 'string' ? diffMap.reportType : diffMap.type
  if (code) {
    const label = formatCode(code)
    if (!label) return null
    return label.toLowerCase().includes('report') ? label : `${label} report`
  }
  return null
}

function EmptyState() {
  return (
    <div style={emptyState}>
      <h3 style={{ margin: 0, color: '#0f172a' }}>No activity yet</h3>
      <p style={{ margin: '6px 0 0', color: '#64748b' }}>
        Once you start interacting with the system, updates will show up here for quick reference.
      </p>
    </div>
  )
}

function TimelineItem({ entry }) {
  const actor = entry.actor?.name || 'Someone'
  const target = entry.entity || 'Record'
  const diffMap = diffToObject(entry.diff)
  const reportLabel = resolveReportLabel(diffMap)
  const reportFormat = typeof diffMap.format === 'string' ? diffMap.format.toUpperCase() : null
  const hasDiff = Array.isArray(entry.diff)
    ? entry.diff.length > 0
    : entry.diff && typeof entry.diff === 'object' && Object.keys(entry.diff).length > 0
  return (
    <li style={timelineItem}>
      <div style={timelineMarker} />
      <div style={timelineContent}>
        <div style={timelineHeader}>
          <span style={timelineTitle}>{entry.summary || `${actor} acted on ${target}`}</span>
          <span style={timelineTime}>{formatRelative(entry.at)}</span>
        </div>
        <div style={timelineMeta}>
          <span>{actor}</span>
          <span>Action: {entry.action}</span>
          <span>Entity: {target}</span>
          {reportLabel ? <span>Report: {reportLabel}</span> : null}
          {reportFormat ? <span>Format: {reportFormat}</span> : null}
          {entry.changed?.length ? <span>Fields: {entry.changed.join(', ')}</span> : null}
        </div>
        {hasDiff ? (
          <details style={timelineDetails}>
            <summary style={timelineSummary}>View raw changes</summary>
            <pre style={timelineDiff}>{JSON.stringify(entry.diff, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    </li>
  )
}

export default function AuditPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const user = useAuthStore((s) => s.user)

  const headline = useMemo(() => {
    if (!user?.role) return 'Audit'
    const name = user.profile?.firstName ? `${user.profile.firstName}'s audit` : 'Audit'
    return name
  }, [user])

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiClient.get('/audit', { params: { limit: 75 }, skipErrorToast: true })
      const incoming = Array.isArray(data?.entries) ? data.entries : []
      setEntries(incoming)
    } catch (err) {
      setError('Unable to load audit history right now.')
      toastError('Unable to load audit timeline', 'Audit')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  return (
    <main style={shell}>
      <header style={hero}>
        <div>
          <h1 style={heroTitle}>Audit</h1>
          <p style={heroSubtitle}>Track every critical change you or your team made across the platform.</p>
        </div>
        <div style={heroActions}>
          <button onClick={fetchEntries} style={refreshButton} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error ? <div style={errorBanner}>{error}</div> : null}

      {loading ? (
        <div style={skeletonList}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} style={skeletonItem} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <section style={timelineSection}>
          <h2 style={timelineHeadline}>{headline}</h2>
          <ul style={timelineList}>
            {entries.map((entry) => (
              <TimelineItem key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

const shell = {
  padding: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem'
}

const hero = {
  background: 'linear-gradient(120deg, #0ea5e9 0%, #22d3ee 100%)',
  borderRadius: 20,
  padding: '1.75rem 2.25rem',
  color: '#fff',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}

const heroTitle = { margin: 0, fontSize: 28, fontWeight: 700 }
const heroSubtitle = { margin: '0.5rem 0 0', opacity: 0.9 }
const heroActions = { display: 'flex', gap: '0.75rem' }
const refreshButton = {
  background: '#fff',
  color: '#0f172a',
  borderRadius: 999,
  border: 'none',
  padding: '0.55rem 1.4rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 8px 20px rgba(15,23,42,0.18)'
}

const errorBanner = {
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  color: '#b91c1c',
  borderRadius: 12,
  padding: '0.75rem 1rem'
}

const skeletonList = {
  display: 'grid',
  gap: '1rem'
}

const skeletonItem = {
  height: '84px',
  borderRadius: 16,
  background: 'linear-gradient(90deg, #e2e8f0 0%, #f8fafc 50%, #e2e8f0 100%)',
  animation: 'pulse 1.5s ease-in-out infinite'
}

const emptyState = {
  border: '1px dashed #94a3b8',
  borderRadius: 16,
  padding: '2rem',
  textAlign: 'center',
  background: '#fff'
}

const timelineSection = {
  borderRadius: 20,
  background: '#fff',
  padding: '1.5rem 2rem',
  boxShadow: '0 20px 45px rgba(15,23,42,0.08)'
}

const timelineHeadline = {
  margin: '0 0 1.25rem 0',
  fontSize: 20,
  color: '#0f172a'
}

const timelineList = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  position: 'relative'
}

const timelineItem = {
  display: 'grid',
  gridTemplateColumns: '24px 1fr',
  gap: '1rem',
  position: 'relative',
  paddingBottom: '1.5rem'
}

const timelineMarker = {
  justifySelf: 'center',
  width: '10px',
  height: '10px',
  background: '#0ea5e9',
  borderRadius: '50%',
  position: 'relative',
  marginTop: '0.35rem'
}

const timelineContent = {
  background: '#f8fafc',
  borderRadius: 16,
  padding: '1rem 1.25rem',
  border: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
}

const timelineHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem'
}

const timelineTitle = { fontWeight: 600, color: '#0f172a' }
const timelineTime = { color: '#64748b', fontSize: 12 }
const timelineMeta = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  fontSize: 13,
  color: '#475569'
}

const timelineDetails = {
  borderTop: '1px solid #e2e8f0',
  paddingTop: '0.5rem'
}

const timelineSummary = {
  cursor: 'pointer',
  color: '#0ea5e9',
  fontSize: 13
}

const timelineDiff = {
  background: '#0f172a',
  color: '#f8fafc',
  padding: '0.75rem',
  borderRadius: 12,
  marginTop: '0.5rem',
  fontSize: 12,
  overflowX: 'auto'
}

export { TimelineItem }