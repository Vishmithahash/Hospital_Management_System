const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/reports/report.service');
const privacyService = require('../services/reports/privacy.service');
const csvService = require('../services/reports/csv.service');
const ReportAudit = require('../models/ReportAudit');
const { buildAuditDiff, upsertReportAuditEntry } = require('../modules/reports/audit.helpers');

async function recordAudit(userId, type, filters, options = {}) {
  if (!userId) {
    return;
  }

  await ReportAudit.create({
    userId,
    type,
    filters
  });

  if (options.auditAction === null) {
    return;
  }

  const range = {
    from: filters?.from,
    to: filters?.to
  };

  const filterOnly = Object.entries(filters || {}).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') return acc;
    if (key === 'from' || key === 'to' || key === 'type' || key === 'format') return acc;
    acc[key] = value;
    return acc;
  }, {});

  const diff = buildAuditDiff(options.auditAction || 'REPORT_GENERATE', {
    type,
    range,
    filters: filterOnly,
    source: 'core'
  });

  const actionKey = (options.auditAction || 'REPORT_GENERATE') === 'REPORT_GENERATE' ? 'report_generate' : 'report_export';
  await upsertReportAuditEntry({ actorId: userId, action: actionKey, diff });
}

const getVisits = asyncHandler(async (req, res) => {
  const filters = req.query;
  const data = await reportService.visitsReport(filters);
  const safeData = privacyService.deidentify(data);

  await recordAudit(req.user?.id, 'visits', filters);

  res.status(200).json(safeData);
});

const getRevenue = asyncHandler(async (req, res) => {
  const filters = req.query;
  const data = await reportService.revenueReport(filters);
  const safeData = privacyService.deidentify(data);

  await recordAudit(req.user?.id, 'revenue', filters);

  res.status(200).json(safeData);
});

const getAppointmentsStatus = asyncHandler(async (req, res) => {
  const filters = req.query;
  const data = await reportService.appointmentsStatusReport(filters);
  const safeData = privacyService.deidentify(data);

  await recordAudit(req.user?.id, 'appointments-status', filters);

  res.status(200).json(safeData);
});

const exportReport = asyncHandler(async (req, res) => {
  const { type = 'visits', format = 'csv' } = req.query;
  let dataset;

  if (type === 'visits') {
    dataset = await reportService.visitsReport(req.query);
  } else if (type === 'revenue') {
    dataset = await reportService.revenueReport(req.query);
  } else if (type === 'appointments') {
    dataset = await reportService.appointmentsStatusReport(req.query);
  } else {
    res.status(400).json({ code: 'INVALID_REPORT', message: 'Unsupported report type' });
    return;
  }

  const safeData = privacyService.deidentify(dataset);

  await recordAudit(req.user?.id, `export-${type}`, req.query, { auditAction: null });

  const range = { from: req.query?.from, to: req.query?.to };
  const filterOnly = Object.entries(req.query || {}).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') return acc;
    if (['from', 'to', 'type', 'format'].includes(key)) return acc;
    acc[key] = value;
    return acc;
  }, {});

  const diff = buildAuditDiff('REPORT_EXPORT', {
    type,
    range,
    filters: filterOnly,
    format,
    source: 'core'
  });

  await upsertReportAuditEntry({ actorId: req.user?.id, action: 'report_export', diff });

  if (format === 'csv') {
    const columns = Object.keys(safeData[0] || {});
    const buffer = csvService.toCsv(columns, safeData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
    res.status(200).send(buffer);
    return;
  }

  res.status(200).json(safeData);
});

module.exports = {
  getVisits,
  getRevenue,
  getAppointmentsStatus,
  exportReport
};
