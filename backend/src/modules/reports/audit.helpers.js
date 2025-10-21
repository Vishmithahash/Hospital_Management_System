const { Types } = require('mongoose')
const AuditEntry = require('../../models/AuditEntry')

const REPORT_LABELS = {
  DAILY_VISITS: 'Daily visits report',
  APPT_LOAD: 'Appointment load report',
  PEAK_HOURS: 'Peak hours report',
  PAYMENT_SUMMARY: 'Payment summary report'
}

function toTitleCase(input) {
  if (!input || typeof input !== 'string') return ''
  return input
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function resolveReportLabel(type) {
  if (!type) return 'Report'
  const label = REPORT_LABELS[type] || toTitleCase(type)
  return label.toLowerCase().includes('report') ? label : `${label} report`
}

function normalizeRange(range = {}) {
  if (!range || typeof range !== 'object') return {}
  const from = range.from || range.start || range.startDate
  const to = range.to || range.end || range.endDate
  const payload = {}
  if (from) payload.from = from
  if (to) payload.to = to
  return payload
}

function orderObject(value) {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(orderObject)
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = orderObject(value[key])
      return acc
    }, {})
}

function serializeFilters(value) {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return `[${value.map(serializeFilters).join(',')}]`
  return Object.keys(value)
    .sort()
    .map((key) => `${key}:${serializeFilters(value[key])}`)
    .join('|')
}

function buildAuditDiff(action, details = {}) {
  const diff = {}
  const type = details.reportType || details.type
  if (type) {
    diff.reportType = type
    diff.reportLabel = resolveReportLabel(type)
  }

  const range = normalizeRange(details.range)
  if (range.from || range.to) diff.range = range

  const filters = orderObject(details.filters)
  if (filters && Object.keys(filters).length > 0) diff.filters = filters

  if (action === 'REPORT_EXPORT' && details.format) {
    diff.format = String(details.format).toLowerCase()
  }

  if (details.source) diff.source = details.source

  const fingerprintParts = [action]
  if (diff.reportType) fingerprintParts.push(diff.reportType)
  if (diff.format) fingerprintParts.push(diff.format)
  if (diff.range) fingerprintParts.push(`${diff.range.from || ''}|${diff.range.to || ''}`)
  if (diff.filters) fingerprintParts.push(serializeFilters(diff.filters))
  if (details.source) fingerprintParts.push(details.source)

  diff.fingerprint = fingerprintParts.filter(Boolean).join('#') || action

  return diff
}

async function upsertReportAuditEntry({ actorId, action, diff }) {
  if (!actorId || !action) return

  const filter = { actorId, action, entity: 'Report' }
  if (diff.fingerprint) filter['diff.fingerprint'] = diff.fingerprint
  else if (diff.reportType) filter['diff.reportType'] = diff.reportType

  const update = {
    $set: {
      entity: 'Report',
      diff,
      at: new Date()
    },
    $setOnInsert: {
      entityId: new Types.ObjectId(),
      actorId,
      action
    }
  }

  await AuditEntry.findOneAndUpdate(filter, update, { upsert: true, setDefaultsOnInsert: true })
}

module.exports = {
  buildAuditDiff,
  resolveReportLabel,
  upsertReportAuditEntry
}
