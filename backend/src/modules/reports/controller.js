const dayjs = require('dayjs');
const { GenerateSchema } = require('./schemas');
const cache = require('./cache');
const service = require('./service');
const { exportPDF, exportExcel } = require('./export');
const ReportAudit = require('../../models/ReportAudit');
const { buildAuditDiff, upsertReportAuditEntry } = require('./audit.helpers');

async function audit(userId, action, details) {
  try {
    await ReportAudit.create({ userId, type: action, filters: details });
    if (userId) {
      const auditAction = action === 'REPORT_GENERATE' ? 'report_generate' : 'report_export';
      const diff = buildAuditDiff(action, { ...details, source: 'manager' });
      await upsertReportAuditEntry({ actorId: userId, action: auditAction, diff });
    }
  } catch (_) {
    // best-effort only
  }
}

function buildNoData(type, range, filters) {
  return {
    meta: {
      type,
      range,
      filters,
      tz: service.TZ,
      generatedAt: new Date().toISOString(),
      noData: true
    },
    table: { columns: [], rows: [] },
    chart: { kind: 'bar', series: [], xAxis: [], yAxis: [] }
  };
}

async function getOptions(req, res, next) {
  try {
    const options = await service.listOptions();
    res.json(options);
  } catch (err) {
    next(err);
  }
}

async function generate(req, res, next) {
  try {
    const parsed = GenerateSchema.parse(req.body);
    await service.ensureFilterValidity(parsed.filters || {});

    const key = { endpoint: 'generate', ...parsed };
    let result = parsed.preview ? cache.get(key) : null;

    if (!result) {
      const { fromStr, toStr } = service.normalizeRange(parsed.range);
      const metaBase = {
        type: parsed.type,
        range: { from: fromStr, to: toStr },
        filters: parsed.filters || {},
        tz: service.TZ,
        generatedAt: new Date().toISOString()
      };

      if (parsed.regenerate) metaBase.note = 'Previous report discarded';

      if (parsed.type === 'DAILY_VISITS') {
        const rows = await service.dailyVisits(parsed.range, parsed.filters);
        if (!rows.length) return res.status(200).json(buildNoData(parsed.type, metaBase.range, metaBase.filters));
        result = {
          meta: metaBase,
          table: { columns: ['day', 'visits'], rows },
          chart: { kind: 'line', series: [{ name: 'Visits', data: rows }], xAxis: 'day', yAxis: 'visits' }
        };
      } else if (parsed.type === 'APPT_LOAD') {
        const { rows, statuses } = await service.appointmentLoad(parsed.range, parsed.filters);
        if (!rows.length) return res.status(200).json(buildNoData(parsed.type, metaBase.range, metaBase.filters));
        result = {
          meta: metaBase,
          table: { columns: ['day', ...statuses], rows },
          chart: {
            kind: 'stacked',
            series: statuses.map((s) => ({ name: s, data: rows.map((r) => ({ day: r.day, [s]: r[s] })) })),
            xAxis: 'day',
            yAxis: 'count'
          }
        };
      } else if (parsed.type === 'PEAK_HOURS') {
        const rows = await service.peakHours(parsed.range, parsed.filters);
        if (!rows.length) return res.status(200).json(buildNoData(parsed.type, metaBase.range, metaBase.filters));
        result = {
          meta: metaBase,
          table: { columns: ['hour', 'count'], rows: rows.map((r) => ({ hour: r.hour, count: r.cnt })) },
          chart: { kind: 'bar', series: [{ name: 'Appointments', data: rows }], xAxis: 'hour', yAxis: 'cnt' }
        };
      } else if (parsed.type === 'PAYMENT_SUMMARY') {
        const rows = await service.paymentSummary(parsed.range, parsed.filters);
        if (!rows.length) return res.status(200).json(buildNoData(parsed.type, metaBase.range, metaBase.filters));
        result = {
          meta: metaBase,
          table: { columns: ['method', 'tx_count', 'avg_ticket', 'total_lkr'], rows },
          chart: { kind: 'bar', series: [{ name: 'Total (LKR)', data: rows }], xAxis: 'method', yAxis: 'total_lkr' }
        };
      } else {
        return res.status(400).json({ code: 'INVALID_TYPE', message: 'Unsupported report type' });
      }
      if (parsed.preview) cache.set(key, result);
    }

    await audit(req.user?.id, 'REPORT_GENERATE', {
      type: parsed.type,
      range: parsed.range,
      filters: parsed.filters || null
    });

    res.status(200).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: err.code || 'INVALID', message: err.message });
    if (err.name === 'ZodError') {
      return res.status(400).json({ code: 'A1_INVALID_PARAMS', message: err.issues?.[0]?.message || 'Invalid params' });
    }
    next(err);
  }
}

async function exportReport(req, res, next) {
  try {
    const parsed = GenerateSchema.parse(req.body);
    await service.ensureFilterValidity(parsed.filters || {});

    const { fromStr, toStr } = service.normalizeRange(parsed.range);
    const payload = await (async () => {
      if (parsed.type === 'DAILY_VISITS') {
        const rows = await service.dailyVisits(parsed.range, parsed.filters);
        return { table: { columns: ['day', 'visits'], rows } };
      }
      if (parsed.type === 'APPT_LOAD') {
        const { rows, statuses } = await service.appointmentLoad(parsed.range, parsed.filters);
        return { table: { columns: ['day', ...statuses], rows } };
      }
      if (parsed.type === 'PEAK_HOURS') {
        const rows = await service.peakHours(parsed.range, parsed.filters);
        return { table: { columns: ['hour', 'count'], rows: rows.map((r) => ({ hour: r.hour, count: r.cnt })) } };
      }
      if (parsed.type === 'PAYMENT_SUMMARY') {
        const rows = await service.paymentSummary(parsed.range, parsed.filters);
        return { table: { columns: ['method', 'tx_count', 'avg_ticket', 'total_lkr'], rows } };
      }
      const e = new Error('Unsupported report type');
      e.status = 400;
      throw e;
    })();

    const meta = {
      type: parsed.type,
      range: { from: fromStr, to: toStr },
      filters: parsed.filters || {},
      tz: service.TZ,
      generatedAt: new Date().toISOString()
    };

    const format = (req.body && req.body.format) || 'pdf';
    const fileBase = `report_${parsed.type}_${dayjs().format('YYYYMMDD')}`;
    let buffer;
    if (format === 'xlsx') {
      buffer = await exportExcel({ meta, table: payload.table });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${fileBase}.xlsx`);
    } else {
      const tableForPdf = parsed.type === 'PEAK_HOURS' ? { columns: [], rows: [] } : payload.table;
      buffer = await exportPDF({ meta, table: tableForPdf, chartImage: req.body?.chartImage });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${fileBase}.pdf`);
    }

    await audit(req.user?.id, 'REPORT_EXPORT', {
      type: meta.type,
      range: meta.range,
      filters: meta.filters,
      format
    });

    res.status(200).send(buffer);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ code: 'A1_INVALID_PARAMS', message: err.message });
    if (err.name === 'ZodError') return res.status(400).json({ code: 'A1_INVALID_PARAMS', message: 'Invalid params' });
    next(err);
  }
}

module.exports = { getOptions, generate, exportReport };

