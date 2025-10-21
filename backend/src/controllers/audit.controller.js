const { Types } = require('mongoose')
const asyncHandler = require('../utils/asyncHandler')
const AuditEntry = require('../models/AuditEntry')
const User = require('../models/User')

const ENTITY_LABELS = {
  Patient: 'Patient record',
  Appointment: 'Appointment',
  Consultation: 'Consultation',
  Prescription: 'Prescription',
  ImageAttachment: 'Medical image',
  Payment: 'Payment',
  CorrectionRequest: 'Correction request',
  Notification: 'Notification',
  Report: 'Report'
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

function toObjectId(id) {
  try {
    return new Types.ObjectId(id)
  } catch (error) {
    return null
  }
}

function buildSummary(entry, actorLabel) {
  const actor = actorLabel || 'Someone'
  const target = ENTITY_LABELS[entry.entity] || entry.entity || 'record'
  const action = entry.action || 'updated'
  const meta = diffToObject(entry.diff)
  const rawType = meta.reportType || meta.type
  let reportLabel = meta.reportLabel || (rawType ? formatCode(rawType) : null)
  if (reportLabel && !reportLabel.toLowerCase().includes('report')) {
    reportLabel = `${reportLabel} report`
  }
  const format = typeof meta.format === 'string' ? meta.format.toUpperCase() : null

  if (action === 'update') return `${actor} updated a ${target}`
  if (action === 'create') return `${actor} created a ${target}`
  if (action === 'delete') return `${actor} deleted a ${target}`
  if (action === 'correction_approved') return `${actor} approved a correction`
  if (action === 'correction_rejected') return `${actor} rejected a correction`
  if (action === 'submit') return `${actor} submitted a ${target}`
  if (action === 'report_generate') {
    if (reportLabel) return `${actor} generated ${reportLabel}`
    return `${actor} generated a ${target}`
  }
  if (action === 'report_export') {
    if (reportLabel && format) return `${actor} exported ${reportLabel} as ${format}`
    if (reportLabel) return `${actor} exported ${reportLabel}`
    if (format) return `${actor} exported a ${target} as ${format}`
    return `${actor} exported a ${target}`
  }

  return `${actor} performed ${action} on ${target}`
}

function buildKeyChanges(diff) {
  const meta = diffToObject(diff)
  const keys = Object.keys(meta)
  if (keys.length === 0) return []
  return keys.filter((key) => !['reportLabel', 'fingerprint', 'source'].includes(key))
}

const listMine = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' })
    return
  }

  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200)
  const before = req.query.before ? new Date(req.query.before) : null

  const clauses = []
  const actorId = toObjectId(userId)
  if (actorId) clauses.push({ actorId })

  if (req.user.role === 'patient' && req.user.linkedPatientId) {
    const linked = toObjectId(req.user.linkedPatientId)
    if (linked) clauses.push({ entity: 'Patient', entityId: linked })
  }

  const match = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $or: clauses }

  const query = AuditEntry.find(match).sort({ at: -1 }).limit(limit)
  if (before && !Number.isNaN(before.getTime())) {
    query.where('at').lt(before)
  }

  const entries = await query.lean()

  const actorIds = [...new Set(entries.map((e) => e.actorId?.toString()).filter(Boolean))]
  const actors = await User.find({ _id: { $in: actorIds } })
    .select({ email: 1, role: 1, profile: 1 })
    .lean()
  const actorMap = new Map(
    actors.map((a) => [
      a._id.toString(),
      {
        id: a._id.toString(),
        role: a.role,
        email: a.email,
        name: [a.profile?.firstName, a.profile?.lastName].filter(Boolean).join(' ') || a.email
      }
    ])
  )

  const payload = entries.map((entry) => {
    const actor = actorMap.get(entry.actorId?.toString() || '') || null
    return {
      id: entry._id.toString(),
      entity: entry.entity,
      entityId: entry.entityId?.toString?.() || entry.entityId,
      action: entry.action,
      at: entry.at,
      actor,
      summary: buildSummary(entry, actor?.name),
      changed: buildKeyChanges(entry.diff),
      diff: entry.diff ?? null
    }
  })

  res.status(200).json({ entries: payload })
})

module.exports = { listMine }